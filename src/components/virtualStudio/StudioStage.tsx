import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, PerformanceMonitor } from '@react-three/drei';
import {
  Bloom,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  LUT,
  N8AO,
  Noise,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  environmentForCategory,
  type StudioEnvironmentProfile,
} from '../../lib/virtualStudio/environmentProfiles';
import { SceneOrbitControls } from '../prism/SceneOrbitControls';
import { LightBeam } from './fixtures/LightBeam';
import type {
  StudioCameraPreset,
  StudioEffectOverrides,
  StudioProductionMode,
  StudioSceneDefinition,
  StudioTransitionSettings,
  StudioTransitionStyle,
} from '../../lib/virtualStudio/types';
import { clampBloomIntensity, clampExposure, clampTemperature } from '../../lib/virtualStudio/productionDesk';
import { kelvinToHex, temperatureToKelvin } from '../../lib/renderEngine/colorTemperature';
import { buildGradeLut } from '../../lib/renderEngine/gradeLut';
import { useRenderEngineSettings } from '../../context/RenderEngineContext';
import { toneMappingModeFor } from '../../lib/renderEngine/toneMappingBridge';
import {
  autoQualityTier,
  degradeQuality,
  improveQuality,
  shouldDegrade,
  shouldImprove,
  studioQualityPreset,
  type StudioQualityTier,
} from '../../lib/virtualStudio/quality';
import {
  fidelityProfile,
  type GlobalIlluminationSpec,
  type VolumetricSpec,
} from '../../lib/virtualStudio/fidelity';
import { acquireProceduralTextureBank, setProceduralTextureBudget } from '../../lib/prism/proceduralTextures';
import { StudioFidelityProvider } from './fixtures/fidelityLighting';

/**
 * The virtual studio stage: a production-grade R3F canvas lit by real HDRI
 * image-based lighting (self-hosted CC0 scans — no CDN), softbox area lights,
 * fitted soft shadows with a contact term, AgX tone mapping graded in the
 * beauty pass, and adaptive quality so the stage holds frame rate while
 * pushing photoreal materials.
 */

export interface StudioStageProps {
  /** Definition from the scene registry (accent, exposure bias, camera). */
  scene: StudioSceneDefinition;
  /**
   * Compositing mode — drives the canvas alpha/fog treatment and lens. Defaults
   * to a full virtual studio; AR renders a transparent plate, XR opens the lens.
   */
  mode?: StudioProductionMode;
  camera: StudioCameraPreset;
  onCameraChange?: (patch: Partial<StudioCameraPreset>) => void;
  /** Transition style used when recalled shots move the camera (jib, whip…). */
  transition?: StudioTransitionSettings;
  /** Quality tier, or `auto` to adapt from measured frame time. */
  quality?: StudioQualityTier | 'auto';
  /** Light rig multiplier (0.6 – 1.6). */
  lighting?: number;
  /** Colour temperature across the rig: 0 cool – 0.5 balanced – 1 warm. */
  temperature?: number;
  /** Extra exposure stop-multiplier on top of the scene bias (0.6 – 1.6). */
  exposure?: number;
  /** Per-effect overrides on top of the quality preset. */
  effects?: StudioEffectOverrides;
  /** Shadow toggle — overrides the quality preset when provided. */
  shadows?: boolean;
  /** Tint the set backlight with the scene accent color. */
  accent?: string;
  /** Drag-to-orbit / wheel-to-zoom. */
  interactive?: boolean;
  /** Called once with the WebGL canvas so callers can captureStream() it. */
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Zoom floor that keeps the camera inside every scene shell. */
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 3.4;
const MIN_FOV = 22;
/** 60° opens up enough for XR establishing shots and wide set extensions. */
const MAX_FOV = 60;

let webglSupport: boolean | null = null;
function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  if (typeof document === 'undefined') {
    webglSupport = false;
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    webglSupport = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

function StageFallback({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#050508] p-6 text-center">
      <p className="text-sm font-bold tracking-wider text-amber-400">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-mixer-muted">{detail}</p>
    </div>
  );
}

/** Keeps a scene/render error from white-screening the whole Prism studio. */
class StageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <StageFallback
          title="SCENE FAILED TO RENDER"
          detail="The photoreal scene hit an unexpected error. Switch scenes or reload the studio — classic sets are unaffected."
        />
      );
    }
    return this.props.children;
  }
}

/** Style profiles for camera transitions between recalled shots. */
const TRANSITION_PROFILES: Record<
  StudioTransitionStyle,
  { speed: number; arc: number; punch: number; ease: (t: number) => number }
> = {
  cut: { speed: 1, arc: 0, punch: 0, ease: (t) => t },
  dissolve: { speed: 1.25, arc: 0, punch: 0, ease: (t) => 0.5 - Math.cos(Math.PI * t) / 2 },
  jib: { speed: 1, arc: 0.55, punch: 0, ease: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) },
  whip: { speed: 0.55, arc: 0.12, punch: 6, ease: (t) => 1 - Math.pow(1 - t, 3.2) },
  crane: { speed: 1.15, arc: 0.95, punch: 4, ease: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) },
  zoom: { speed: 0.8, arc: 0, punch: -7, ease: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) },
};

interface RigPose {
  yaw: number;
  pitch: number;
  zoom: number;
  fov: number;
  tx: number;
  ty: number;
  tz: number;
}

function poseDistance(a: RigPose, b: RigPose): number {
  return (
    Math.abs(a.yaw - b.yaw) +
    Math.abs(a.pitch - b.pitch) +
    Math.abs(a.zoom - b.zoom) * 0.6 +
    Math.abs(a.fov - b.fov) * 0.012 +
    Math.hypot(a.tx - b.tx, a.ty - b.ty, a.tz - b.tz) * 0.22
  );
}

function StudioCameraRig({
  yaw,
  pitch,
  zoom,
  fov,
  target,
  transition,
}: StudioCameraPreset & { transition?: StudioTransitionSettings }) {
  const { camera } = useThree();
  // Live pose the rig flies from — shot recalls glide with the selected
  // transition style (jib sweep, crane, whip, punch…) while direct drag
  // stays tight and instant like a real pedestal head.
  const pose = useRef<RigPose | null>(null);
  const goal = useRef<RigPose | null>(null);
  const heldFrames = useRef(0);
  const flight = useRef<{ t: number; duration: number; style: StudioTransitionStyle; from: RigPose } | null>(null);
  const style = transition?.style ?? 'jib';
  const duration = Math.max(0.2, Math.min(4, transition?.duration ?? 1.2));
  // The R3F frame loop intentionally drives the live three.js camera + eased pose ref per frame.
  // eslint-disable-next-line react-hooks/immutability
  useFrame((_, delta) => {
    const dt = Math.max(0.001, Math.min(0.1, delta || 0.016));
    const [gx, gy, gz] = target ?? [0, 1.05, 0];
    const incoming: RigPose = {
      yaw,
      pitch,
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)),
      fov: Math.max(MIN_FOV, Math.min(MAX_FOV, fov ?? 38)),
      tx: gx,
      ty: gy,
      tz: gz,
    };

    // First frame: snap to the initial pose.
    if (!pose.current || !goal.current) {
      pose.current = { ...incoming };
      goal.current = { ...incoming };
      return;
    }

    const jump = poseDistance(incoming, goal.current);
    const moved = jump > 1e-4;
    if (moved) {
      // A jump after the pose held still is a shot recall → run a transition.
      // Continuous changes (drag, head-tracking) just retarget the rig.
      const isRecall = jump > 0.11 && heldFrames.current >= 2;
      if (style === 'cut') {
        pose.current = { ...incoming };
        flight.current = null;
      } else if (isRecall && (!flight.current || flight.current.t > 0.85)) {
        flight.current = {
          t: 0,
          duration: duration * TRANSITION_PROFILES[style].speed,
          style,
          from: { ...pose.current },
        };
      }
      goal.current = { ...incoming };
      heldFrames.current = 0;
    } else {
      heldFrames.current += 1;
    }

    const goalPose = goal.current;
    const flight_ = flight.current;
    if (flight_) {
      flight_.t = Math.min(1, flight_.t + dt / Math.max(0.05, flight_.duration));
      const profile = TRANSITION_PROFILES[flight_.style];
      const e = profile.ease(flight_.t);
      const from = flight_.from;
      pose.current.yaw = from.yaw + (goalPose.yaw - from.yaw) * e;
      pose.current.pitch = from.pitch + (goalPose.pitch - from.pitch) * e;
      pose.current.zoom = from.zoom + (goalPose.zoom - from.zoom) * e;
      pose.current.tx = from.tx + (goalPose.tx - from.tx) * e;
      pose.current.ty = from.ty + (goalPose.ty - from.ty) * e;
      pose.current.tz = from.tz + (goalPose.tz - from.tz) * e;
      // Lens breathing (whip punch / dolly punch) peaks mid-move.
      const breathe = Math.sin(Math.PI * flight_.t) * profile.punch;
      pose.current.fov = from.fov + (goalPose.fov - from.fov) * e + breathe;
      if (flight_.t >= 1) flight.current = null;
    } else {
      const lambda = 16;
      pose.current.yaw = THREE.MathUtils.damp(pose.current.yaw, goalPose.yaw, lambda, dt);
      pose.current.pitch = THREE.MathUtils.damp(pose.current.pitch, goalPose.pitch, lambda, dt);
      pose.current.zoom = THREE.MathUtils.damp(pose.current.zoom, goalPose.zoom, lambda, dt);
      pose.current.fov = THREE.MathUtils.damp(pose.current.fov, goalPose.fov, lambda, dt);
      pose.current.tx = THREE.MathUtils.damp(pose.current.tx, goalPose.tx, lambda, dt);
      pose.current.ty = THREE.MathUtils.damp(pose.current.ty, goalPose.ty, lambda, dt);
      pose.current.tz = THREE.MathUtils.damp(pose.current.tz, goalPose.tz, lambda, dt);
    }

    const p = pose.current;
    const radius = 6 / p.zoom;
    // Jib/crane arcs lift the camera through the move like a real crane sweep.
    const arc =
      flight_ && flight_.style !== 'cut'
        ? Math.sin(Math.PI * Math.min(1, flight_.t)) *
          TRANSITION_PROFILES[flight_.style].arc *
          Math.min(1.6, Math.max(0.35, poseDistance(flight_.from, goalPose)))
        : 0;
    const y = Math.sin(p.pitch) * radius + p.ty + 0.3 + arc;
    const xz = Math.cos(p.pitch) * radius;
    camera.position.set(p.tx + Math.sin(p.yaw) * xz, y, p.tz + Math.cos(p.yaw) * xz);
    camera.lookAt(p.tx, p.ty, p.tz);
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - p.fov) > 0.01) {
      // Imperative lens simulation: the three.js camera instance is meant to be driven here.
      // eslint-disable-next-line react-hooks/immutability
      cam.fov = p.fov;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

/**
 * Applies the operator's exposure and the renderer's shadow mode.
 *
 * EffectComposer takes ownership of tone mapping — it pins the renderer to
 * `NoToneMapping` so nothing is baked into the render target, then applies
 * AgX in the beauty pass. That pass compiles three's own tone-mapping chunk,
 * so it reads `gl.toneMappingExposure` directly: the exposure control is a
 * real EV stop on the final image rather than a no-op.
 */
function StageExposure({ exposure }: { exposure: number }) {
  const { gl } = useThree();
  useEffect(() => {
    // Renderer configuration is intentionally imperative — this is the
    // standard three.js/R3F way to set tone mapping and shadow mode.
    // eslint-disable-next-line react-hooks/immutability
    gl.toneMapping = THREE.NoToneMapping;
    gl.toneMappingExposure = exposure;
    // VSM: the rig tunes real penumbrae — `shadow.radius` scales the blur and
    // `shadow-blurSamples` drives the Gaussian pass — so shadows soften with
    // distance from the occluder like a shadow off a soft area light, instead
    // of the fixed hard kernel plain PCF gives. (PCFSoft was deprecated in
    // r184 and silently degrades to PCF, which ignores blurSamples.)
    // eslint-disable-next-line react-hooks/immutability
    if (gl.shadowMap) gl.shadowMap.type = THREE.VSMShadowMap;
  }, [gl, exposure]);
  return null;
}

function CanvasReporter({ onCanvasReady }: { onCanvasReady?: (canvas: HTMLCanvasElement) => void }) {
  const { gl } = useThree();
  useEffect(() => {
    onCanvasReady?.(gl.domElement);
  }, [gl, onCanvasReady]);
  return null;
}

/** LTC lookup tables for area lights — must exist before the first frame. */
let areaLightTablesReady = false;
function ensureAreaLightTables() {
  if (areaLightTablesReady) return;
  RectAreaLightUniformsLib.init();
  areaLightTablesReady = true;
}

/**
 * The light rig. A real HDRI supplies ambient, specular and reflections (the
 * global-illumination base); a fitted key directional and a rim spot give shape
 * (both shadow casters); and two softbox area lights replace the old
 * fill/kicker directionals — area lights are what make metal, glass and skin
 * read like a studio instead of a render.
 *
 * The rig follows the shared fidelity standard: the hemisphere bounce is the
 * profile's `bounceIntensity`, the god-ray shaft is the profile's volumetric
 * beam (disabled with the rest of the volumetrics on cheap tiers), and every
 * fixture in the set couples its light to its emissive brightness through the
 * same `emissiveLightRatio`.
 */
function StudioLighting({
  environment,
  intensity,
  shadows,
  shadowMapSize,
  accent,
  temperature = 0.5,
  contactShadows,
  gi,
  volumetrics,
}: {
  environment: StudioEnvironmentProfile;
  intensity: number;
  shadows: boolean;
  shadowMapSize: number;
  accent?: string;
  /** 0 = cool daylight, 0.5 = balanced, 1 = warm tungsten. */
  temperature?: number;
  /** Soft grounding term under set dressing — off so AR keeps its live plate. */
  contactShadows: boolean;
  /** Global-illumination spec from the shared fidelity standard. */
  gi: GlobalIlluminationSpec;
  /** Volumetric spec — `null` disables visible shafts entirely. */
  volumetrics: VolumetricSpec | null;
}) {
  ensureAreaLightTables();
  // Cool-to-warm balance across the rig — the operator's colour temperature.
  // Physically based: the fader resolves to a correlated colour temperature on
  // the Planckian locus and every fixture emits the black-body chromaticity for
  // its own CCT. Mixed-CCT lighting (a slightly cooler fill against a warmer
  // kicker) is what gives real sets their colour separation — it falls out of
  // the kelvin values rather than hand-picked tints.
  const t = Math.max(0, Math.min(1, temperature));
  const masterKelvin = temperatureToKelvin(t);
  const keyColor = useMemo(() => kelvinToHex(masterKelvin), [masterKelvin]);
  // Fill sits ~350 K cooler than the key (soft daylight bounce).
  const fillColor = useMemo(() => kelvinToHex(masterKelvin + 350), [masterKelvin]);
  // Kicker sits ~450 K warmer (tungsten edge/accent), matching on-set practice.
  const kickerColor = useMemo(() => kelvinToHex(masterKelvin - 450), [masterKelvin]);
  /* Rim spot picks up the set accent so the backlight ties the talent to the
     set instead of sitting on top of it as neutral white. The accent is blended
     onto the fixture's own CCT so the rim reads as a coloured practical. */
  const rimColor = useMemo(
    () =>
      accent
        ? `#${new THREE.Color(kelvinToHex(masterKelvin)).lerp(new THREE.Color(accent), 0.5).getHexString()}`
        : kelvinToHex(masterKelvin),
    [accent, masterKelvin],
  );
  const fillBoost = 1.25 - t * 0.5;
  const kickerBoost = 0.75 + t * 0.5;

  return (
    <>
      {/* self-hosted CC0 scan — the global-illumination base: correct
          speculars, reflections and mood, scaled by the profile's IBL level */}
      <Environment
        files={environment.file}
        environmentIntensity={environment.intensity * intensity * gi.environmentIntensity}
      />

      {/* key light: the one directional, shadow camera fitted to the set.
          The frustum is fitted tight to the dressed set (not the whole stage)
          so every shadow-map texel lands on geometry: contact edges stay crisp
          instead of dissolving into the blocky mush a wide frustum gives.
          blurSamples gives the PCF kernel a real penumbra gradient. */}
      <directionalLight
        position={[4.5, 7, 5]}
        intensity={2.1 * intensity}
        color={keyColor}
        castShadow={shadows}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-bias={-0.00025}
        shadow-normalBias={0.012}
        shadow-radius={2.6}
        shadow-blurSamples={12}
        shadow-camera-near={1}
        shadow-camera-left={-7.5}
        shadow-camera-right={7.5}
        shadow-camera-top={7.5}
        shadow-camera-bottom={-7.5}
        shadow-camera-far={26}
      />
      {/* ceiling bounce: every real studio has light coming back up off a white
          ceiling. Without it the top planes of furniture and shoulders go dead
          black and the render reads as CG. Very low intensity, no shadow. */}
      <rectAreaLight
        position={[0, 6.2, 0.5]}
        width={12}
        height={9}
        intensity={0.55 * intensity * fillBoost}
        color={fillColor}
        rotation={[Math.PI / 2, 0, 0]}
      />
      {/* hemisphere sky/ground term — the global-illumination bounce that tints
          the floor warm and the sky cool, the way an actual room does. Its
          strength is the profile's `bounceIntensity`. */}
      <hemisphereLight args={[fillColor, '#2a2118', gi.bounceIntensity * intensity]} />
      {/* camera-left softbox fill — area light, no shadow map cost */}
      <rectAreaLight
        position={[-5.4, 3.2, 2.2]}
        width={4.6}
        height={3.2}
        intensity={2.4 * intensity * fillBoost}
        color={fillColor}
        onUpdate={(light) => light.lookAt(0, 1.1, 0)}
      />
      {/* camera-right kicker */}
      <rectAreaLight
        position={[5.4, 3.2, 0.8]}
        width={4}
        height={3.2}
        intensity={1.8 * intensity * kickerBoost}
        color={kickerColor}
        onUpdate={(light) => light.lookAt(0, 1.2, 0)}
      />
      {/* rim/overhead spot — physically accurate light falloff: decay = 2 is the
          inverse-square law (energy falls as 1/d²), windowed by `distance` so it
          reaches zero smoothly instead of popping off at range. Colour comes from
          the rig's correlated colour temperature, not a hand-picked tint. */}
      <spotLight
        position={[0, 7.5, -3]}
        angle={0.7}
        penumbra={0.8}
        intensity={18 * intensity}
        distance={22}
        decay={2}
        color={rimColor}
        castShadow={shadows}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-bias={-0.0004}
        shadow-normalBias={0.01}
        shadow-radius={2}
        shadow-blurSamples={8}
      />
      {/* contact term: anchors furniture, talent and set dressing to the floor
          with a soft, blurred shadow the shadow map can't resolve at range */}
      {shadows && contactShadows && (
        <ContactShadows
          position={[0, 0.02, 0]}
          scale={26}
          far={2.2}
          blur={2.1}
          opacity={0.78}
          resolution={1024}
          color="#05070d"
        />
      )}
      {/* god-ray shaft from the overhead studio spot — visible only where the
          volumetric budget exists; the beam reads the profile's haze/segment
          spec so it degrades in lockstep with the rest of the rig */}
      {volumetrics && (
        <LightBeam
          position={[0, 3.85, -1.5]}
          rotation={[-0.4, 0, 0]}
          height={8}
          radius={1.9}
          color={keyColor}
          opacity={volumetrics.beamIntensity}
          segments={volumetrics.beamSegments}
          animated={volumetrics.animated}
        />
      )}
    </>
  );
}

function StudioPostProcessing({
  bloom,
  bloomIntensity,
  vignette,
  vignetteStrength,
  depthOfField,
  ao,
  msaaSamples,
  smaa,
  toneMap,
  grade,
  grain,
  grainAmount,
  chromaticAberration,
  chromaticAberrationAmount,
}: {
  bloom: boolean;
  bloomIntensity: number;
  vignette: boolean;
  vignetteStrength: number;
  depthOfField: boolean;
  ao: boolean;
  msaaSamples: number;
  smaa: boolean;
  toneMap: ToneMappingMode;
  grade: { contrast: number; saturation: number; vibrance: number; temperature: number };
  grain: boolean;
  grainAmount: number;
  chromaticAberration: boolean;
  chromaticAberrationAmount: number;
}) {
  // LUT-based colour grading: white balance, contrast and saturation/vibrance
  // are baked into a 3D lookup texture and applied with tetrahedral
  // interpolation — a real show-LUT transform rather than a chain of ad-hoc
  // per-channel effects. Rebuilt only when a grading control actually moves.
  const lut = useMemo(
    () => buildGradeLut({ contrast: grade.contrast, saturation: grade.saturation, vibrance: grade.vibrance, temperature: grade.temperature }),
    [grade.contrast, grade.saturation, grade.vibrance, grade.temperature],
  );
  // Free the previous lookup texture whenever the grade moves.
  useEffect(() => () => lut.dispose(), [lut]);
  return (
    <EffectComposer multisampling={msaaSamples} enableNormalPass={false}>
      {/* Ambient occlusion grounds furniture/feet — ultra tier only. */}
      {ao && (
        <N8AO
          aoRadius={0.55}
          intensity={1.35}
          distanceFalloff={1}
          quality="high"
          aoSamples={16}
          denoiseSamples={4}
          denoiseRadius={12}
        />
      )}
      {bloom && (
        /* Threshold sits just under clip: bright LEDs and practicals glow
           without a broad veil lifting the whole frame's blacks. */
        <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.25} intensity={bloomIntensity} radius={0.65} />
      )}
      {depthOfField && (
        <DepthOfField
          /* World-space focus locked to the stage: the set and talent stay
             crisp and only the far background melts (a soft telephoto look).

             `focusRange` is the width of the sharp zone in world units. It must
             be wide enough to cover the whole set (near floor to the back wall,
             ~10–12u) — a narrow range racks focus onto a single slice and turns
             every virtual set soft. The old `focalLength`/`worldFocusRange` pair
             fought each other (both map to `focusRange`), collapsing it to a
             razor-thin plane; use the modern `focusDistance` + `focusRange`. */
          focusDistance={6.2}
          focusRange={12}
          bokehScale={1.1}
        />
      )}
      {/* Filmic display transform picked by the render engine (AgX by
          default): it rolls highlights off without ACES' hue skew, so blown
          LED walls and practicals stay believable. It sits after the HDR
          effects (AO, bloom, DOF) and before the display-space grade. */}
      <ToneMapping mode={toneMap} />
      {/* LUT-based display-space grade — white balance, contrast, saturation
          and vibrance resolved through a baked 3D lookup texture (tetrahedral
          interpolation) so every template shares one film-consistent
          transform. */}
      <LUT lut={lut} tetrahedralInterpolation />
      {/* Chromatic aberration fringes the frame edges like a real fast lens. */}
      {chromaticAberration && chromaticAberrationAmount > 0 && (
        <ChromaticAberration
          offset={[chromaticAberrationAmount * 0.0022, chromaticAberrationAmount * 0.0011]}
          radialModulation
          modulationOffset={0.28}
        />
      )}
      {vignette && <Vignette offset={0.26} darkness={vignetteStrength} />}
      {/* Fine film grain breaks up gradient banding in the haze and blacks. */}
      {grain && grainAmount > 0 && <Noise premultiply opacity={grainAmount} />}
      {smaa && <SMAA />}
    </EffectComposer>
  );
}

/** Measures sustained frame time and steps the quality tier up/down. */
function AdaptiveQuality({
  tier,
  auto,
  onChange,
}: {
  tier: StudioQualityTier;
  auto: boolean;
  onChange: (next: StudioQualityTier) => void;
}) {
  const acc = useRef(0);
  const frames = useRef(0);
  useFrame((_, delta) => {
    if (!auto) return;
    acc.current += delta * 1000;
    frames.current += 1;
    if (frames.current < 90) return;
    const avg = acc.current / frames.current;
    acc.current = 0;
    frames.current = 0;
    if (shouldDegrade(avg, tier)) onChange(degradeQuality(tier));
    else if (shouldImprove(avg, tier)) onChange(improveQuality(tier));
  });
  return null;
}

export function StudioStage({
  scene,
  mode = 'virtual_studio',
  camera,
  onCameraChange,
  transition,
  quality = 'auto',
  lighting = 1,
  temperature = 0.5,
  exposure: exposureMultiplier = 1,
  effects,
  shadows,
  accent,
  interactive = true,
  onCanvasReady,
  className,
  style,
  children,
}: StudioStageProps) {
  const auto = quality === 'auto';
  // AR composites a live plate — haze would wash it out, so the scene renders
  // clear. XR/VS keep the atmospheric depth that sells the volume.
  const isAr = mode === 'augmented_reality';
  const isXr = mode === 'xr_extension';
  // XR reads as a wide establishing lens by default; operators can still push
  // it wider (up to MAX_FOV) from the camera desk.
  const rigCamera = isXr ? { ...camera, fov: Math.max(camera.fov ?? 38, 50) } : camera;
  const [autoTier, setAutoTier] = useState<StudioQualityTier>(() => autoQualityTier());
  // The background render engine is the source of truth for the look: its
  // settings panel drives display transform, grade, and kernel toggles for
  // every stage in the app.
  const engineSettings = useRenderEngineSettings();
  const tier = auto ? autoTier : quality;
  const preset = studioQualityPreset(tier);
  // The shared fidelity standard: materials, GI, volumetrics and the
  // performance budget all read from the same tier the stage is running.
  const profile = fidelityProfile(tier);
  const shadowsEnabled = (shadows ?? preset.shadows) && engineSettings.shadows;
  // Fine-grained render resolution — steps in small increments as measured
  // frame time moves so weak GPUs stay fluid without dropping whole tiers.
  const [dprScale, setDprScale] = useState(preset.maxDpr);
  const dpr = Math.min(dprScale, preset.maxDpr);

  /* Asset compression + memory management: the tier caps texture generation
     size, anisotropic filtering and derived-map density, and the shared
     procedural bank is reference-counted so its maps are disposed when the
     last stage lets go instead of accumulating across scene swaps. */
  const budget = profile.performance;
  useEffect(() => {
    setProceduralTextureBudget({
      maxSize: budget.maxTextureSize,
      anisotropy: budget.textureAnisotropy,
      derivedMapScale: budget.derivedMapScale,
    });
  }, [budget.maxTextureSize, budget.textureAnisotropy, budget.derivedMapScale]);
  useEffect(() => acquireProceduralTextureBank(), []);

  const exposure = useMemo(
    () =>
      Math.max(
        0.2,
        Math.min(
          2.5,
          (1 + (scene.exposureBias ?? 0)) * clampExposure(exposureMultiplier) * Math.pow(2, engineSettings.grade.exposure * 0.5),
        ),
      ),
    [scene.exposureBias, exposureMultiplier, engineSettings.grade.exposure],
  );

  // Real HDRI image-based lighting, resolved from the scene's category.
  const environment = environmentForCategory(scene.category);

  const fx = effects ?? {};
  const bloom = (fx.bloom ?? preset.bloom) && engineSettings.bloom;
  const bloomIntensity =
    (fx.bloomIntensity != null ? clampBloomIntensity(fx.bloomIntensity) : 0.55) * engineSettings.bloomIntensity;

  const handleCameraChange = useCallback(
    (patch: Partial<StudioCameraPreset>) => onCameraChange?.(patch),
    [onCameraChange],
  );

  if (!hasWebGL()) {
    return (
      <div className={className} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
        <StageFallback
          title="WEBGL UNAVAILABLE"
          detail="Photoreal scenes need WebGL. Enable hardware acceleration or use the classic virtual sets."
        />
      </div>
    );
  }

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}>
      <StageErrorBoundary>
        <Canvas
          shadows={shadowsEnabled}
          dpr={dpr}
          gl={{
            antialias: false,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: true,
            alpha: false,
          }}
          camera={{ fov: 38, near: 0.1, far: 220, position: [0, 1.6, 6] }}
        >
          <StageExposure exposure={exposure} />
          {/* atmospheric haze — aerial depth and a medium the light beams
              scatter through, at the profile's volumetric density. Skipped for
              AR so the live back plate stays crisp. */}
          {!isAr && <fogExp2 attach="fog" args={['#0c1016', profile.volumetrics?.hazeDensity ?? 0.008]} />}
          <CanvasReporter onCanvasReady={onCanvasReady} />
          <Suspense fallback={null}>
            <StudioLighting
              environment={environment}
              intensity={Math.max(0.6, Math.min(1.6, lighting))}
              shadows={shadowsEnabled}
              shadowMapSize={preset.shadowMapSize}
              accent={accent ?? scene.accent}
              temperature={clampTemperature(temperature)}
              /* AR composites over a live plate — a contact shadow would paint
                 a dark pool over the real floor the talent is standing on. */
              contactShadows={!isAr}
              gi={profile.globalIllumination}
              volumetrics={isAr ? null : profile.volumetrics}
            />
            <StudioCameraRig {...rigCamera} transition={transition} />
            {interactive && onCameraChange && (
              <SceneOrbitControls
                yaw={camera.yaw}
                pitch={camera.pitch}
                zoom={camera.zoom}
                target={camera.target}
                enabled
                minZoom={MIN_ZOOM}
                maxZoom={MAX_ZOOM}
                onChange={handleCameraChange}
              />
            )}
            {/* Set dressing reads the active fidelity tier through this: lamps
                and screens claim dynamic-light slots against the tier's budget
                and couple their light to their emissive brightness. */}
            <StudioFidelityProvider tier={tier}>{children}</StudioFidelityProvider>
          <StudioPostProcessing
            bloom={bloom}
            bloomIntensity={bloomIntensity}
            vignette={(fx.vignette ?? preset.vignette) && engineSettings.vignette}
            vignetteStrength={engineSettings.vignetteStrength}
            /* AR keeps the live plate crisp — DOF would rack focus past it and
               AO would halo graphics against a depth-less feed. */
            depthOfField={(fx.depthOfField ?? preset.depthOfField) && engineSettings.depthOfField && !isAr}
            ao={(fx.ao ?? preset.ao) && engineSettings.gtao && !isAr}
            msaaSamples={
              engineSettings.antiAliasing === 'msaa'
                ? engineSettings.msaaSamples
                : preset.antialias === 'msaa'
                  ? preset.msaaSamples
                  : 0
            }
            smaa={
              engineSettings.antiAliasing === 'smaa'
                ? true
                : engineSettings.antiAliasing === 'off'
                  ? false
                  : (fx.smaa ?? preset.antialias === 'smaa')
            }
            toneMap={toneMappingModeFor(engineSettings.toneMapping)}
            grade={engineSettings.grade}
            grain={engineSettings.filmGrain}
            grainAmount={engineSettings.filmGrainAmount}
            chromaticAberration={engineSettings.chromaticAberration && !isAr}
            chromaticAberrationAmount={engineSettings.chromaticAberrationAmount}
          />
            <AdaptiveQuality tier={tier} auto={auto} onChange={setAutoTier} />
            {/* nudges render resolution up/down to hold frame rate — never
                below native (1x) so the picture never goes soft */}
            <PerformanceMonitor
              factor={1}
              flipflops={3}
              onIncline={() => setDprScale((d) => Math.min(preset.maxDpr, Math.min(2, d + 0.25)))}
              /* Floor at 1.5× — dropping to 1× on a retina panel upscales the
                 frame and makes every set look soft/blurry under load. */
              onDecline={() => setDprScale((d) => Math.max(1.5, d - 0.25))}
            />
          </Suspense>
        </Canvas>
      </StageErrorBoundary>
    </div>
  );
}
