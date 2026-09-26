import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer, Text } from '@react-three/drei';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction, type BloomEffect, type ChromaticAberrationEffect, type NoiseEffect } from 'postprocessing';
import * as THREE from 'three';
import {
  bell,
  clamp01,
  easeInCubic,
  easeOutCubic,
  easeOutExpo,
  getParticleSprite,
  getRadialGlowTexture,
  getShaftTexture,
  getSweepTexture,
  mulberry32,
  seg,
} from './motionMath';
import { createMotionClock, type MotionClockState } from './motionClock';
import { layoutExtrudedText } from './extrudedText';
import { MotionLookContext, useMotionLook, type MotionLook } from './motionLook';
import type { PrismBrandKit } from '../../../lib/prism/brandKit';
import type { MotionTemplateOverrides } from '../../../lib/prism/motionGraphics';
import { useRenderEngineSettings } from '../../../context/RenderEngineContext';
import { toneMappingModeFor } from '../../../lib/renderEngine/toneMappingBridge';

/* ------------------------------------------------------------------ clock */

const FALLBACK_CLOCK = createMotionClock();
const MotionClockContext = createContext<MotionClockState>(FALLBACK_CLOCK);

export function MotionClockProvider({
  clock,
  children,
}: {
  clock: MotionClockState;
  children: ReactNode;
}) {
  return <MotionClockContext.Provider value={clock}>{children}</MotionClockContext.Provider>;
}

/** Scene-local timeline — read inside `useFrame`, never during render. */
// eslint-disable-next-line react-refresh/only-export-components -- the hook must live beside the context it reads
export function useMotionClock(): MotionClockState {
  return useContext(MotionClockContext);
}

/** Every template scene is driven by the same three strings + palette. */
export interface MotionSceneProps {
  headline: string;
  subline: string;
  accent: string;
  /** Operator brand kit — uploaded logo / wordmark replaces the procedural mark. */
  brand?: PrismBrandKit;
  /** Operator template extras — kicker, footer, plate colours, logo placement. */
  overrides?: MotionTemplateOverrides;
}

/* -------------------------------------------------------------------- look */

export type { MotionLook } from './motionLook';

/** Publishes the operator grade so scenes, particles and post share it. */
export function MotionLookProvider({ value, children }: { value: MotionLook; children: ReactNode }) {
  return <MotionLookContext.Provider value={value}>{children}</MotionLookContext.Provider>;
}

/* ------------------------------------------------------------- environment */

/**
 * Studio reflections without an HDRI download: a handful of lightformers baked
 * once into an env map, tinted by the template accent.
 */
export function MotionEnvironment({ accent, intensity = 1 }: { accent: string; intensity?: number }) {
  return (
    <Environment key={accent} resolution={128} frames={1}>
      <Lightformer form="rect" intensity={3 * intensity} color="#ffffff" position={[0, 4.5, -6]} scale={[9, 4, 1]} />
      <Lightformer
        form="rect"
        intensity={1.9 * intensity}
        color={accent}
        position={[-6, 0.5, 2]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[7, 7, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.3 * intensity}
        color="#dbeafe"
        position={[6, -0.5, 2]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[7, 7, 1]}
      />
      <Lightformer form="ring" intensity={2.2 * intensity} color={accent} position={[0, -4, 3]} scale={5} />
    </Environment>
  );
}

/* ---------------------------------------------------------------- backdrop */

/** Full-frame gradient void — the black every good end card sits on. */
export function VoidBackdrop({ position = [0, 0, -16], scale = 46 }: { position?: [number, number, number]; scale?: number }) {
  const look = useMotionLook();
  const map = useMemo(() => getRadialGlowTexture(), []);
  // A WebGPU / video plate is already painting the frame — stay out of its way.
  if (look.backdropActive) return null;
  return (
    <mesh position={position} scale={scale} renderOrder={-10}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={map} color="#0b0d16" transparent depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
  );
}

/** Soft horizon glow that ignites behind the subject. */
export function GlowCore({
  position = [0, 0, -4],
  scale = 10,
  color,
  intensity = 0.5,
  reveal,
  boostAt,
  boost = 1.6,
}: {
  position?: [number, number, number];
  scale?: number;
  color: string;
  intensity?: number;
  /** [fade-in end, fade-out start] seconds on the template timeline. */
  reveal?: [number, number];
  /** One-shot bloom bump (impact flashes). */
  boostAt?: number;
  boost?: number;
}) {
  const clock = useMotionClock();
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const map = useMemo(() => getRadialGlowTexture(), []);
  useFrame(() => {
    const m = matRef.current;
    if (!m) return;
    let o = intensity;
    if (reveal) o *= seg(clock.t, reveal[0], reveal[1], easeOutCubic);
    if (boostAt !== undefined) o += intensity * boost * bell(clock.t, boostAt, 0.22);
    m.opacity = clamp01(o);
    m.visible = m.opacity > 0.004;
  });
  return (
    <mesh position={position} scale={scale} renderOrder={-9}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        map={map}
        color={color}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

/* --------------------------------------------------------------- particles */

export interface AmbientDustProps {
  count?: number;
  radius?: number;
  color: string;
  size?: number;
  drift?: number;
  opacity?: number;
  /** [fade-in end, fade-out start] seconds. */
  reveal?: [number, number];
}

/** Slow gold-dust field — atmosphere for every template. */
export function AmbientDust({
  count = 500,
  radius = 10,
  color,
  size = 0.06,
  drift = 0.05,
  opacity = 0.85,
  reveal,
}: AmbientDustProps) {
  const clock = useMotionClock();
  const look = useMotionLook();
  // Operator particle-density control — quantised so slider drags don't
  // rebuild the geometry every step.
  const effCount = Math.max(0, Math.round((count * Math.max(0, look.particleScale)) / 25) * 25);
  const ref = useRef<THREE.Points>(null);
  const { geometry, material } = useMemo(() => {
    const rand = mulberry32(1337);
    const positions = new Float32Array(effCount * 3);
    for (let i = 0; i < effCount; i++) {
      const r = radius * (0.35 + 0.65 * rand());
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: getParticleSprite(),
      size,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      sizeAttenuation: true,
    });
    return { geometry, material };
  }, [effCount, radius, size, color, opacity]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  /* eslint-disable react-hooks/immutability -- imperative Three.js scene updates in the render loop */
  useFrame((_, dt) => {
    const points = ref.current;
    if (!points) return;
    points.rotation.y += dt * drift;
    points.rotation.x = Math.sin(clock.t * 0.12) * 0.05;
    let o = opacity;
    if (reveal) o *= seg(clock.t, reveal[0], reveal[1], easeOutCubic);
    material.opacity = o;
    points.visible = o > 0.004;
  });
  /* eslint-enable react-hooks/immutability */

  return <points ref={ref} geometry={geometry} material={material} />;
}

/**
 * Cone-burst particles — every point flies outward from `origin` along a
 * precomputed direction, driven by a single 0–1 `amount`.
 */
export function ParticleBurst({
  count = 700,
  color,
  size = 0.11,
  seed = 7,
  spread = 7,
  origin = [0, 0, 0],
  /** [start, end] seconds of the timeline. */
  window,
  fadeOut = 1.6,
}: {
  count?: number;
  color: string;
  size?: number;
  seed?: number;
  spread?: number;
  origin?: [number, number, number];
  window: [number, number];
  fadeOut?: number;
}) {
  const clock = useMotionClock();
  const look = useMotionLook();
  const effCount = Math.max(0, Math.round((count * Math.max(0, look.particleScale)) / 25) * 25);
  const ref = useRef<THREE.Points>(null);
  const { geometry, material, dirs } = useMemo(() => {
    const rand = mulberry32(seed);
    const positions = new Float32Array(effCount * 3);
    const dirs = new Float32Array(effCount * 3);
    for (let i = 0; i < effCount; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const speed = spread * (0.35 + 0.65 * rand());
      dirs[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      dirs[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      dirs[i * 3 + 2] = Math.cos(phi) * speed;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: getParticleSprite(),
      size,
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      sizeAttenuation: true,
    });
    return { geometry, material, dirs };
  }, [effCount, size, color, seed, spread]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  /* eslint-disable react-hooks/immutability -- imperative Three.js scene updates in the render loop */
  useFrame(() => {
    const points = ref.current;
    if (!points) return;
    const raw = clamp01((clock.t - window[0]) / Math.max(1e-6, window[1] - window[0]));
    if (raw <= 0) {
      material.opacity = 0;
      points.visible = false;
      return;
    }
    points.visible = true;
    const travel = easeOutExpo(raw);
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < effCount; i++) {
      arr[i * 3] = origin[0] + dirs[i * 3] * travel;
      arr[i * 3 + 1] = origin[1] + dirs[i * 3 + 1] * travel;
      arr[i * 3 + 2] = origin[2] + dirs[i * 3 + 2] * travel;
    }
    attr.needsUpdate = true;
    material.opacity = 0.95 * (1 - clamp01((clock.t - window[1]) / Math.max(1e-6, fadeOut)));
  });
  /* eslint-enable react-hooks/immutability */

  return <points ref={ref} geometry={geometry} material={material} />;
}

/* ------------------------------------------------------------------ shafts */

export interface MotionShaftProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  height?: number;
  radius?: number;
  color?: string;
  opacity?: number;
  /** [ignite end] seconds — shafts fade up as the piece opens. */
  ignite?: [number, number];
}

/** Volumetric light shaft — additive cone reading as haze. */
export function MotionShaft({
  position,
  rotation,
  height = 7,
  radius = 1.8,
  color = '#fff7ed',
  opacity = 0.14,
  ignite,
}: MotionShaftProps) {
  const clock = useMotionClock();
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const map = useMemo(() => getShaftTexture(), []);
  useFrame(() => {
    const m = matRef.current;
    if (!m) return;
    let o = opacity;
    if (ignite) o *= seg(clock.t, ignite[0], ignite[1], easeOutCubic);
    m.opacity = o;
    m.visible = o > 0.003;
  });
  return (
    <mesh position={position} rotation={rotation} renderOrder={3}>
      <coneGeometry args={[radius, height, 30, 1, true]} />
      <meshBasicMaterial
        ref={matRef}
        map={map}
        color={color}
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

/* ----------------------------------------------------------- flash & ring */

/** Full-frame white-hot flash at an impact point. */
export function ImpactFlash({
  at,
  width = 0.35,
  color = '#ffffff',
  strength = 0.9,
  scale = 26,
  position = [0, 0, 2],
}: {
  at: number;
  width?: number;
  color?: string;
  strength?: number;
  scale?: number;
  position?: [number, number, number];
}) {
  const clock = useMotionClock();
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const map = useMemo(() => getRadialGlowTexture(), []);
  useFrame(() => {
    const m = matRef.current;
    if (!m) return;
    m.opacity = strength * bell(clock.t, at, width);
    m.visible = m.opacity > 0.004;
  });
  return (
    <mesh position={position} scale={scale} renderOrder={20}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        map={map}
        color={color}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

/** Expanding shock ring fired from the impact point. */
export function ShockRing({
  at,
  duration = 1.1,
  color,
  maxRadius = 8,
  thickness = 0.06,
  position = [0, 0, 0],
}: {
  at: number;
  duration?: number;
  color: string;
  maxRadius?: number;
  thickness?: number;
  position?: [number, number, number];
}) {
  const clock = useMotionClock();
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const mesh = ref.current;
    const m = matRef.current;
    if (!mesh || !m) return;
    const p = clamp01((clock.t - at) / Math.max(1e-6, duration));
    if (p <= 0 || p >= 1) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    const eased = easeOutExpo(p);
    mesh.scale.setScalar(0.15 + eased * maxRadius);
    m.opacity = (1 - p) * 0.9;
  });
  return (
    <mesh ref={ref} position={position} visible={false}>
      {/* Ring width is derived from `thickness` (0.06 → inner radius 0.94). */}
      <ringGeometry args={[Math.min(0.97, Math.max(0.02, 1 - thickness)), 1, 96]} />
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

/* -------------------------------------------------------------------- text */

export interface MetalTextProps {
  text: string;
  accent: string;
  size?: number;
  position?: [number, number, number];
  letterSpacing?: number;
  /** [reveal start, reveal end] seconds. */
  reveal?: [number, number];
  /** Lift the glyph plane slightly on reveal (title-card settle). */
  rise?: number;
  metalness?: number;
  roughness?: number;
  /** Horizontal alignment — left for lower thirds, centre for title cards. */
  align?: 'left' | 'center';
}

/**
 * Extruded wordmark — bevelled glyph stock on a clearcoated physical material,
 * so the environment map rakes across the faces, the chamfered edges hold a
 * highlight and each letter settles out of the plate on its own beat. Raster
 * text is kept only as the safety net for strings the typeface can't draw.
 */
export function MetalText({
  text,
  accent,
  size = 0.6,
  position = [0, 0, 0],
  letterSpacing = 0.06,
  reveal,
  rise = 0.18,
  metalness = 0.95,
  roughness = 0.24,
  align = 'center',
}: MetalTextProps) {
  const clock = useMotionClock();
  const layout = useMemo(
    () => layoutExtrudedText(text, letterSpacing, align),
    [text, letterSpacing, align],
  );

  const materials = useMemo(() => {
    const shared = {
      color: new THREE.Color(accent),
      metalness,
      roughness,
      envMapIntensity: 2.4,
      transparent: true,
      // Reveal is driven through the material: troika only samples
      // `fillOpacity` during its own sync, which a custom material bypasses.
      opacity: reveal ? 0 : 1,
    };
    return [
      // Front and back faces: polished lacquer over the accent colour.
      new THREE.MeshPhysicalMaterial({ ...shared, clearcoat: 0.6, clearcoatRoughness: 0.18 }),
      // Extruded flanks: darker, rougher stock so the slab edge reads machined.
      new THREE.MeshPhysicalMaterial({
        ...shared,
        color: new THREE.Color(accent).multiplyScalar(0.7),
        roughness: Math.min(1, roughness + 0.16),
        clearcoat: 0.22,
        clearcoatRoughness: 0.45,
        envMapIntensity: 1.7,
      }),
    ];
  }, [accent, metalness, roughness, reveal]);
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);

  const groupRef = useRef<THREE.Group>(null);
  const textRef = useRef<{
    fillOpacity: number;
    visible: boolean;
    scale: THREE.Vector3;
    position: THREE.Vector3;
  } | null>(null);

  /* eslint-disable react-hooks/immutability -- imperative Three.js updates in the render loop */
  useFrame(() => {
    const p = reveal ? seg(clock.t, reveal[0], reveal[1], easeOutExpo) : 1;
    const targetOpacity = clamp01(p);
    for (const material of materials) {
      if (Math.abs(material.opacity - targetOpacity) > 0.003) material.opacity = targetOpacity;
    }
    const shown = targetOpacity > 0.004;

    const group = groupRef.current;
    if (group && layout) {
      const riseEm = rise / Math.max(size, 1e-4);
      group.visible = shown;
      group.scale.setScalar(0.965 + 0.035 * p);
      group.position.y = layout.centerY + (1 - p) * riseEm;
      const glyphs = group.children;
      for (let i = 0; i < glyphs.length; i++) {
        const letter = layout.letters[i];
        if (!letter) continue;
        // Letters share the reveal window but start on their own beat.
        const lp = reveal
          ? clamp01(
              seg(
                clock.t,
                reveal[0] + (reveal[1] - reveal[0]) * letter.delay,
                reveal[1],
                easeOutExpo,
              ),
            )
          : 1;
        glyphs[i].visible = lp > 0.004;
        // Each slab lifts out of the plate — depth carried through the motion.
        glyphs[i].position.set(letter.x, 0, (1 - lp) * -0.16);
      }
    }

    const flat = textRef.current;
    if (flat) {
      flat.visible = shown;
      flat.scale.setScalar(0.965 + 0.035 * p);
      flat.position.set(position[0], position[1] + (1 - p) * rise, position[2]);
    }
  });
  /* eslint-enable react-hooks/immutability */

  // Typeface gap (exotic glyph, unreadable font) — raster keeps the frame clean.
  if (!layout) {
    return (
      <Text
        ref={textRef as never}
        position={position}
        fontSize={size}
        letterSpacing={letterSpacing}
        anchorX={align}
        textAlign={align}
        anchorY="middle"
        material={materials[0]}
        visible={!reveal}
        renderOrder={4}
      >
        {text}
      </Text>
    );
  }

  return (
    <group position={position} scale={size}>
      <group ref={groupRef}>
        {layout.letters.map((letter, index) => (
          <mesh
            key={`glyph-${index}`}
            geometry={letter.geometry}
            material={materials}
            dispose={null}
            renderOrder={4}
          />
        ))}
      </group>
    </group>
  );
}

/* -------------------------------------------------------------- spec sweep */

/** Specular bar that rakes across metal — the film-studio gleam. */
export function SpecSweep({
  window,
  width = 6,
  height = 1.6,
  position = [0, 0, 0.4],
  intensity = 0.9,
}: {
  window: [number, number];
  width?: number;
  height?: number;
  position?: [number, number, number];
  intensity?: number;
}) {
  const clock = useMotionClock();
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const map = useMemo(() => getSweepTexture(), []);
  useFrame(() => {
    const mesh = ref.current;
    const m = matRef.current;
    if (!mesh || !m) return;
    const p = clamp01((clock.t - window[0]) / Math.max(1e-6, window[1] - window[0]));
    if (p <= 0 || p >= 1) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    const x = -width / 2 + easeOutCubic(p) * width;
    mesh.position.set(position[0] + x, position[1], position[2]);
    m.opacity = intensity * Math.sin(Math.PI * p);
  });
  return (
    <mesh ref={ref} visible={false} renderOrder={12}>
      <planeGeometry args={[width * 0.4, height]} />
      <meshBasicMaterial
        ref={matRef}
        map={map}
        color="#ffffff"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

/** Hairline rule that draws itself out from centre — title-card underlines. */
export function RuleLine({
  y = -2.14,
  x = 0,
  color,
  from,
  to,
  width = 4.6,
}: {
  y?: number;
  x?: number;
  color: string;
  from: number;
  to: number;
  width?: number;
}) {
  const clock = useMotionClock();
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const p = seg(clock.t, from, to, easeOutExpo);
    mesh.visible = p > 0.001;
    mesh.scale.set(Math.max(0.001, p) * width, 1, 1);
  });
  return (
    <mesh ref={ref} position={[x, y, 0]} visible={false}>
      <planeGeometry args={[1, 0.014]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
  );
}

/** Fades the frame to black for the final beat so loops restart seamlessly. */
export function LoopFade({ from, to }: { from: number; to: number }) {
  const clock = useMotionClock();
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;
    const fade = clock.loop ? seg(clock.t, from, to, easeInCubic) : 0;
    mesh.visible = fade > 0.002;
    mat.opacity = fade;
    if (!mesh.visible) return;
    camera.getWorldDirection(dir);
    mesh.position.copy(camera.position).addScaledVector(dir, 1.1);
    mesh.quaternion.copy(camera.quaternion);
  });
  return (
    <mesh ref={meshRef} visible={false} renderOrder={999}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        color="#000000"
        transparent
        opacity={0}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------- post */

export interface MotionPostFxProps {
  bloom?: boolean;
  bloomIntensity?: number;
  /** One-shot bloom spike (impact). */
  pulse?: { at: number; width: number; boost: number };
  /** Base chromatic aberration in pixels. */
  chroma?: number;
  /** Film grain opacity. */
  grain?: number;
  vignette?: number;
  msaa?: number;
}

/** Cinematic grade: bloom, aberration, grain, vignette — pulse-aware.
 *
 *  The background render engine (Settings ▸ Render engine) is the master
 *  control: its toggles gate each kernel and its grade/display-transform
 *  apply to every motion graphic, with the template + operator look layered
 *  on top as scene-relative adjustments. */
export function MotionPostFx({
  bloom = true,
  bloomIntensity = 0.85,
  pulse,
  chroma = 0.0007,
  grain = 0.05,
  vignette = 0.72,
  msaa = 4,
}: MotionPostFxProps) {
  const clock = useMotionClock();
  const look = useMotionLook();
  const engine = useRenderEngineSettings();
  const bloomRef = useRef<BloomEffect>(null);
  const caRef = useRef<ChromaticAberrationEffect>(null);
  const noiseRef = useRef<NoiseEffect>(null);

  // Operator look controls layer on top of the template's own grade:
  // bloom/vignette are multipliers, grain and aberration are additions.
  // Engine settings gate and scale everything below them.
  const bloomOn = bloom && engine.bloom && look.bloom > 0.001;
  const bloomAmt = bloomIntensity * engine.bloomIntensity * look.bloom;
  const chromaAmt = engine.chromaticAberration ? (chroma + look.chroma / 1280) * (engine.chromaticAberrationAmount / 0.25) : 0;
  const grainAmt = engine.filmGrain ? Math.min(0.5, (grain + look.grain) * (engine.filmGrainAmount / 0.05)) : 0;
  const vignetteAmt = engine.vignette
    ? Math.max(0, Math.min(1, vignette * look.vignette * (engine.vignetteStrength / 0.72)))
    : 0;

  useFrame(() => {
    const t = clock.t;
    const spike = pulse ? pulse.boost * bell(t, pulse.at, pulse.width) : 0;
    if (bloomRef.current) bloomRef.current.intensity = bloomAmt + spike * look.bloom;
    if (caRef.current) {
      const kick = pulse ? spike * 0.004 : 0;
      caRef.current.offset.set(chromaAmt + kick, chromaAmt * 0.6 + kick * 0.5);
    }
    if (noiseRef.current) noiseRef.current.blendMode.opacity.value = grainAmt;
  });

  if (!bloomOn && grainAmt <= 0 && chromaAmt <= 0 && vignetteAmt <= 0) return null;

  return (
    <EffectComposer
      multisampling={engine.antiAliasing === 'off' ? 0 : msaa}
      enableNormalPass={false}
    >
      {bloomOn && (
        <Bloom ref={bloomRef} mipmapBlur luminanceThreshold={0.62} luminanceSmoothing={0.28} intensity={bloomAmt} radius={0.8} />
      )}
      {/* Radial modulation keeps the fringe off the subject and at the frame
          edges, like a real fast lens — the setter flips the shader define. */}
      {chromaAmt > 0 && (
        <ChromaticAberration
          ref={caRef}
          offset={[chromaAmt, chromaAmt * 0.6]}
          radialModulation
          modulationOffset={0.15}
        />
      )}
      {grainAmt > 0 && <Noise ref={noiseRef} premultiply blendFunction={BlendFunction.SCREEN} opacity={grainAmt} />}
      <ToneMapping mode={toneMappingModeFor(engine.toneMapping)} />
      {vignetteAmt > 0 && <Vignette offset={0.24} darkness={vignetteAmt} />}
      {engine.antiAliasing !== 'off' && <SMAA />}
    </EffectComposer>
  );
}
