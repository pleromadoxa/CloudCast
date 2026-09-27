/**
 * Prism Babylon Studio Stage — a second, fully independent photoreal renderer.
 *
 * This is the Babylon.js counterpart to `StudioStage.tsx` (three.js). It builds
 * a broadcast studio entirely from physically based materials:
 *
 *  - HDR image-based lighting from the self-hosted Poly Haven probes
 *  - metallic/roughness PBR with clear coat, sheen and anisotropy
 *  - percentage-closer soft shadows from the key light
 *  - screen-space ambient occlusion
 *  - an ACES / neutral display transform with bloom, depth of field and grain
 *
 * Everything is generated procedurally at runtime — no scene assets to ship —
 * so the stage is a true material test bench as well as a usable set.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { SpotLight } from '@babylonjs/core/Lights/spotLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { ColorGradingTexture } from '@babylonjs/core/Materials/Textures/colorGradingTexture';
import { VideoTexture } from '@babylonjs/core/Materials/Textures/videoTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
import { Scene } from '@babylonjs/core/scene';
import { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
// Must run before any texture or render-target is created — registers the
// WebGPUEngine feature patches the granular imports above don't pull in.
import './engineExtensions';
import { createPbrMaterial, createStudioMaterialSet } from './materials';
import { makeEmissiveTexture } from './textures';
import {
  fidelityProfile,
} from '../../../lib/virtualStudio/fidelity';
import type { FidelityTier } from '../../../lib/virtualStudio/fidelity';
import { kelvinToHex, temperatureToKelvin } from '../../../lib/renderEngine/colorTemperature';
import { buildGradeStripCanvas } from '../../../lib/renderEngine/gradeLut';
import { environmentForCategory } from '../../../lib/virtualStudio/environmentProfiles';
import { getStudioScene } from '../../../lib/virtualStudio/sceneRegistry';
import type {
  StudioCameraPreset,
  StudioScreenSource,
  StudioTalentPlacement,
} from '../../../lib/virtualStudio/types';
import type { BabylonStageSettings } from '../../../lib/stageEngines';

export interface BabylonTalentPlate {
  keyedCanvas?: HTMLCanvasElement | null;
  rawVideo?: HTMLVideoElement | null;
  keyerEnabled?: boolean;
  showReflections?: boolean;
  placement?: StudioTalentPlacement;
}

export interface BabylonStudioStageProps {
  sceneId?: string;
  camera?: StudioCameraPreset;
  onCameraChange?: (patch: {
    yaw?: number;
    pitch?: number;
    zoom?: number;
    fov?: number;
    target?: [number, number, number];
  }) => void;
  /** 0.6 – 1.6 master light intensity. */
  lighting?: number;
  /** 0 cool – 1 warm. */
  temperature?: number;
  /** 0.6 – 1.6 exposure multiplier. */
  exposure?: number;
  accent?: string;
  shadows?: boolean;
  /** Fidelity tier driving GI, dynamic-light budget and volumetrics. */
  fidelity?: FidelityTier;
  talent?: BabylonTalentPlate;
  bindings?: Record<string, StudioScreenSource>;
  settings: BabylonStageSettings;
  visible?: boolean;
  interactive?: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  onEngineReady?: (info: { backend: 'webgpu' | 'webgl2'; renderer: string }) => void;
  className?: string;
  style?: CSSProperties;
}

const BASE_RADIUS = 8.4;
const TARGET = new Vector3(0, 1.35, 0);
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 3.4;

function toneMapConstant(name: BabylonStageSettings['toneMapping']): number {
  switch (name) {
    case 'aces':
      return ImageProcessingConfiguration.TONEMAPPING_ACES;
    case 'neutral':
      return ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL;
    case 'agx':
    case 'filmic':
    case 'reinhard':
    default:
      // Babylon ships Standard / ACES / KHR-neutral. AgX and Filmic are
      // approximated through the Standard curve plus the contrast stage —
      // the engine settings still round-trip the operator's intent.
      return ImageProcessingConfiguration.TONEMAPPING_STANDARD;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixColor(cold: string, warm: string, t: number): Color3 {
  const a = Color3.FromHexString(cold);
  const b = Color3.FromHexString(warm);
  return new Color3(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t));
}

function accentColor(hex: string): Color3 {
  return Color3.FromHexString(hex.startsWith('#') ? hex : `#${hex}`);
}

/* ------------------------------------------------------------- engine --- */

async function createEngine(
  canvas: HTMLCanvasElement,
  msaaSamples: number,
): Promise<AbstractEngine> {
  const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
  if (gpu) {
    try {
      const webgpu = new WebGPUEngine(canvas, {
        antialias: false,
        adaptToDeviceRatio: true,
        enableAllFeatures: true,
      });
      await webgpu.initAsync();
      return webgpu;
    } catch {
      /* fall through to WebGL2 */
    }
  }
  return new Engine(
    canvas,
    msaaSamples > 1,
    { stencil: true, preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: false },
    true,
  );
}

/* ---------------------------------------------------------------- set --- */

interface BuiltSet {
  casters: Mesh[];
  receivers: Mesh[];
  screenPlanes: { mesh: Mesh; slotId: string }[];
  practicals: { position: Vector3; glow: PBRMaterial }[];
  talentPlane: Mesh | null;
  talentReflection: Mesh | null;
}

function buildStudioSet(
  scene: Scene,
  accentHex: string,
  talent: BabylonTalentPlate | undefined,
): BuiltSet {
  const mats = createStudioMaterialSet(scene);
  const casters: Mesh[] = [];
  const receivers: Mesh[] = [];
  const screenPlanes: { mesh: Mesh; slotId: string }[] = [];
  const practicals: { position: Vector3; glow: PBRMaterial }[] = [];
  const accent = accentColor(accentHex);

  /* Floor — polished stone with a carpet inset under the desk. */
  const floor = MeshBuilder.CreateGround('floor', { width: 26, height: 22 }, scene);
  floor.material = mats.marble;
  receivers.push(floor);

  const carpet = MeshBuilder.CreateGround('carpet', { width: 11, height: 8 }, scene);
  carpet.position.set(0, 0.012, 1.2);
  carpet.material = mats.carpet;
  receivers.push(carpet);

  /* Cyclorama — a soft wide back wall plus angled wings for parallax. */
  const backWall = MeshBuilder.CreateBox('back-wall', { width: 24, height: 10, depth: 0.4 }, scene);
  backWall.position.set(0, 5, -8.2);
  backWall.material = mats.wall;
  receivers.push(backWall);
  casters.push(backWall);

  for (const side of [-1, 1]) {
    const wing = MeshBuilder.CreateBox('wing', { width: 0.35, height: 10, depth: 12 }, scene);
    wing.position.set(side * 11.6, 5, -2.4);
    wing.rotation.y = side * -0.18;
    wing.material = mats.fabric;
    receivers.push(wing);
  }

  /* LED video wall — the hero of the set. */
  const videoWall = MeshBuilder.CreatePlane('video-wall', { width: 13.6, height: 5.1 }, scene);
  videoWall.position.set(0, 3.85, -7.92);
  videoWall.rotation.y = Math.PI;
  const wallFrame = MeshBuilder.CreateBox(
    'video-wall-frame',
    { width: 14.1, height: 5.6, depth: 0.32 },
    scene,
  );
  wallFrame.position.set(0, 3.85, -7.72);
  wallFrame.material = mats.anodized;
  casters.push(wallFrame);
  screenPlanes.push({ mesh: videoWall, slotId: 'video-wall' });

  /* Flanking vertical light boxes carrying the show accent. */
  for (const side of [-1, 1]) {
    const strip = MeshBuilder.CreatePlane('accent-strip', { width: 0.42, height: 6.6 }, scene);
    strip.position.set(side * 7.7, 3.4, -7.62);
    strip.rotation.y = Math.PI;
    const stripMat = new PBRMaterial(`accent-strip-${side}`, scene);
    stripMat.albedoColor = new Color3(0.02, 0.02, 0.03);
    stripMat.metallic = 0;
    stripMat.roughness = 0.42;
    stripMat.emissiveColor = accent;
    stripMat.emissiveIntensity = 2.1;
    strip.material = stripMat;

    const column = MeshBuilder.CreateBox('column', { width: 0.9, height: 9, depth: 0.9 }, scene);
    column.position.set(side * 9.4, 4.5, -6.4);
    column.material = mats.brushedMetal;
    casters.push(column);
    receivers.push(column);
  }

  /* Hero desk — lacquered top on a brushed-metal body with a chrome reveal. */
  const deskTop = MeshBuilder.CreateBox('desk-top', { width: 7.2, height: 0.16, depth: 1.9 }, scene);
  deskTop.position.set(0, 1.06, 1.35);
  deskTop.material = mats.walnut;
  casters.push(deskTop);
  receivers.push(deskTop);

  const deskBody = MeshBuilder.CreateBox('desk-body', { width: 7, height: 1, depth: 1.66 }, scene);
  deskBody.position.set(0, 0.5, 1.35);
  deskBody.material = mats.brushedMetal;
  casters.push(deskBody);
  receivers.push(deskBody);

  const deskReveal = MeshBuilder.CreateBox(
    'desk-reveal',
    { width: 7.06, height: 0.075, depth: 1.72 },
    scene,
  );
  deskReveal.position.set(0, 1, 1.35);
  deskReveal.material = mats.chrome;
  casters.push(deskReveal);

  const deskInset = MeshBuilder.CreatePlane('desk-inset', { width: 5.4, height: 0.52 }, scene);
  deskInset.position.set(0, 0.52, 2.19);
  const insetMat = new PBRMaterial('desk-inset-mat', scene);
  insetMat.albedoColor = new Color3(0.015, 0.017, 0.022);
  insetMat.metallic = 0;
  insetMat.roughness = 0.36;
  insetMat.emissiveColor = accent;
  insetMat.emissiveIntensity = 0.55;
  deskInset.material = insetMat;

  /* Seating — leather + upholstery studio chairs behind the desk. */
  for (const side of [-1, 1]) {
    const seat = MeshBuilder.CreateBox('seat', { width: 1.15, height: 0.22, depth: 1.05 }, scene);
    seat.position.set(side * 1.75, 0.62, 0.15);
    seat.material = mats.leather;
    casters.push(seat);

    const back = MeshBuilder.CreateBox('seat-back', { width: 1.15, height: 1.15, depth: 0.2 }, scene);
    back.position.set(side * 1.75, 1.28, -0.32);
    back.rotation.x = -0.12;
    back.material = mats.upholstery;
    casters.push(back);

    for (const dx of [-0.42, 0.42]) {
      const leg = MeshBuilder.CreateCylinder('chair-leg', { height: 0.62, diameter: 0.075 }, scene);
      leg.position.set(side * 1.75 + dx, 0.31, 0.15);
      leg.material = mats.chrome;
      casters.push(leg);
    }
  }

  /* Overhead truss with practicals — real metal in the top of frame. */
  for (const z of [-3.4, 0.6]) {
    const truss = MeshBuilder.CreateBox('truss', { width: 16, height: 0.28, depth: 0.28 }, scene);
    truss.position.set(0, 8.35, z);
    truss.material = mats.anodized;
    casters.push(truss);

    for (const x of [-5.4, -2.7, 0, 2.7, 5.4]) {
      const can = MeshBuilder.CreateCylinder('lamp', { height: 0.62, diameter: 0.42 }, scene);
      can.position.set(x, 7.86, z);
      can.material = mats.brushedMetal;
      casters.push(can);

      const lens = MeshBuilder.CreateDisc('lens', { radius: 0.19 }, scene);
      lens.position.set(x, 7.55, z);
      lens.rotation.x = Math.PI / 2;
      const lensMat = new PBRMaterial(`lens-${x}-${z}`, scene);
      lensMat.albedoColor = new Color3(0.04, 0.04, 0.05);
      lensMat.metallic = 0;
      lensMat.roughness = 0.12;
      lensMat.emissiveColor = Color3.FromHexString('#fff2dd');
      lensMat.emissiveIntensity = 3.4;
      lens.material = lensMat;
      practicals.push({ position: lens.position.clone(), glow: lensMat });
    }
  }

  /* Ceiling panel so the top of frame is not empty sky. */
  const ceiling = MeshBuilder.CreateBox('ceiling', { width: 24, height: 0.3, depth: 22 }, scene);
  ceiling.position.set(0, 9.6, -1);
  ceiling.material = mats.fabric;
  receivers.push(ceiling);

  /* Foreground planters — asymmetry makes a set read as real. */
  for (const side of [-1, 1]) {
    const pot = MeshBuilder.CreateCylinder(
      'pot',
      { height: 0.9, diameterTop: 1, diameterBottom: 0.78 },
      scene,
    );
    pot.position.set(side * 6.4, 0.45, 5.4);
    pot.material = mats.marble;
    casters.push(pot);
    receivers.push(pot);

    for (let i = 0; i < 7; i += 1) {
      const leaf = MeshBuilder.CreatePlane('leaf', { width: 0.55, height: 1.9 }, scene);
      leaf.position.set(
        side * 6.4 + (i - 3) * 0.19,
        1.85 + Math.abs(i - 3) * 0.12,
        5.4 + (i % 3) * 0.16,
      );
      leaf.rotation.y = i * 0.6;
      leaf.rotation.x = -0.35 + i * 0.07;
      leaf.material = createPbrMaterial(scene, `leaf-${side}-${i}`, 'black_fabric', {
        tint: '#20402c',
        metalScale: 0,
        roughnessScale: 1.1,
        doubleSided: true,
      });
      casters.push(leaf);
    }
  }

  /* Talent plate + optional floor reflection. */
  const placement = talent?.placement;
  const width = placement?.width ?? 2.6;
  const height = width * 0.5625;
  const talentPlane = MeshBuilder.CreatePlane('talent', { width, height }, scene);
  const px = placement?.position?.[0] ?? 0;
  const py = placement?.position?.[1] ?? 0;
  talentPlane.position.set(px, 1.24 + py, 3.35);
  talentPlane.rotation.y = placement?.yaw ?? 0;
  talentPlane.rotation.x = placement?.pitch ?? 0;
  talentPlane.rotation.z = placement?.roll ?? 0;

  let talentReflection: Mesh | null = null;
  if (talent?.showReflections) {
    talentReflection = MeshBuilder.CreatePlane(
      'talent-reflection',
      { width, height: width * 0.9 },
      scene,
    );
    talentReflection.position.set(px, 0.02, 3.35 + width * 0.45);
    talentReflection.rotation.x = Math.PI / 2;
    talentReflection.isVisible = false;
  }

  return { casters, receivers, screenPlanes, practicals, talentPlane, talentReflection };
}

/* -------------------------------------------------------------- screen --- */

function resolveScreenTexture(
  scene: Scene,
  slotId: string,
  source: StudioScreenSource | undefined,
  talentVideo: HTMLVideoElement | null,
): { texture: BaseTexture | null; emissive: number } {
  if (!source || source.kind === 'off') return { texture: null, emissive: 0.12 };

  if (source.kind === 'image-url') {
    if (!source.url) return { texture: null, emissive: 0.12 };
    const texture = new Texture(source.url, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
    return { texture, emissive: 1.35 };
  }

  if (source.kind === 'live-video') {
    const element = source.video ?? talentVideo;
    if (!element) return { texture: null, emissive: 0.12 };
    try {
      return { texture: new VideoTexture(`screen-${slotId}`, element, scene, true), emissive: 1.5 };
    } catch {
      return { texture: null, emissive: 0.12 };
    }
  }

  if (source.kind === 'video-url') {
    if (!source.url) return { texture: null, emissive: 0.12 };
    try {
      const video = document.createElement('video');
      video.src = source.url;
      video.crossOrigin = 'anonymous';
      video.loop = source.loop !== false;
      video.muted = true;
      video.playsInline = true;
      void video.play().catch(() => undefined);
      return { texture: new VideoTexture(`screen-${slotId}`, video, scene, true), emissive: 1.5 };
    } catch {
      return { texture: null, emissive: 0.12 };
    }
  }

  if (source.kind === 'canvas') {
    const texture = new DynamicTexture(`screen-canvas-${slotId}`, { width: 1280, height: 720 }, scene, true);
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    ctx.drawImage(source.canvas, 0, 0, 1280, 720);
    texture.update(true);
    return { texture, emissive: 1.3 };
  }

  // `graphic` — a generated broadcast plate driven by the graphic content.
  const label = source.content?.name ?? 'CLOUDCAST';
  const texture = makeEmissiveTexture(scene, `screen-graphic-${slotId}`, (ctx, size) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, '#0b1220');
    gradient.addColorStop(1, '#16233b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let y = 0; y < size; y += 8) ctx.fillRect(0, y, size, 2);
    ctx.fillStyle = '#e8eefc';
    ctx.font = `bold ${Math.round(size * 0.12)}px system-ui, sans-serif`;
    ctx.fillText(String(label).toUpperCase().slice(0, 18), size * 0.08, size * 0.34);
    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(size * 0.08, size * 0.42, size * 0.42, size * 0.012);
  });
  return { texture, emissive: 1.25 };
}

/**
 * Average colour of a screen source — the tint its pixels throw into the set
 * as bounce light. Babylon counterpart to the R3F `useScreenSpillTint`:
 * content-reactive spill so cuts and graphics relight the studio in 3D.
 */
function sampleScreenTint(source: StudioScreenSource | undefined): Color3 | null {
  const sample = (el: CanvasImageSource | null | undefined): Color3 | null => {
    if (!el) return null;
    try {
      const probe = document.createElement('canvas');
      probe.width = 24;
      probe.height = 14;
      const ctx = probe.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(el, 0, 0, probe.width, probe.height);
      const data = ctx.getImageData(0, 0, probe.width, probe.height).data;
      const pixels = data.length / 4;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      return new Color3(r / pixels / 255, g / pixels / 255, b / pixels / 255);
    } catch {
      return null;
    }
  };
  if (!source) return null;
  if (source.kind === 'live-video') return sample(source.video);
  if (source.kind === 'canvas') return sample(source.canvas);
  return null;
}

/* ------------------------------------------------------------ the stage --- */

interface StageRuntime {
  engine: AbstractEngine;
  scene: Scene;
  camera: ArcRotateCamera;
  pipeline: DefaultRenderingPipeline;
  talentTexture: DynamicTexture | null;
  keyedCanvas: HTMLCanvasElement | null;
  dynamicLights: { light: PointLight; baseIntensity: number }[];
  beams: { material: PBRMaterial; baseAlpha: number; phase: number }[];
  setDynamicLightLevel: (level: number) => void;
}

export function BabylonStudioStage({
  sceneId = 'cyclorama',
  camera: cameraPose,
  onCameraChange,
  lighting = 1,
  temperature = 0.5,
  exposure = 1,
  accent = '#38bdf8',
  shadows = true,
  fidelity = 'high',
  talent,
  bindings,
  settings,
  visible = true,
  interactive = true,
  onCanvasReady,
  onEngineReady,
  className,
  style,
}: BabylonStudioStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<StageRuntime | null>(null);
  const reportRef = useRef(onCameraChange);
  // Latest-callback ref — committed after render so the engine loop always
  // calls the current handler without re-booting the scene on every keystroke.
  useEffect(() => {
    reportRef.current = onCameraChange;
  }, [onCameraChange]);

  const sceneDef = useMemo(() => getStudioScene(sceneId), [sceneId]);
  const environment = useMemo(
    () => environmentForCategory(sceneDef?.category ?? 'news'),
    [sceneDef],
  );

  /* --- boot ------------------------------------------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;

    const boot = async (): Promise<void> => {
      const engine = await createEngine(canvas, settings.msaaSamples);
      if (disposed) {
        engine.dispose();
        return;
      }
      const scene = new Scene(engine);
      scene.clearColor = new Color4(0.02, 0.025, 0.035, 1);
      scene.ambientColor = new Color3(0.18, 0.2, 0.24);

      /* Environment probe — the single biggest lever for photorealism. */
      const hdr = new HDRCubeTexture(environment.file, scene, 256, false, true, false, true);
      scene.environmentTexture = hdr;
      scene.environmentIntensity = environment.intensity * settings.environmentIntensity;

      const built = buildStudioSet(scene, accent, talent);

      /* Camera. */
      const cam = new ArcRotateCamera(
        'stage-camera',
        Math.PI / 2,
        Math.PI / 2 - 0.12,
        BASE_RADIUS,
        TARGET.clone(),
        scene,
      );
      cam.fov = ((cameraPose?.fov ?? 38) * Math.PI) / 180;
      cam.lowerRadiusLimit = BASE_RADIUS / MAX_ZOOM;
      cam.upperRadiusLimit = BASE_RADIUS / MIN_ZOOM;
      cam.lowerBetaLimit = 0.28;
      cam.upperBetaLimit = Math.PI / 2 - 0.02;
      cam.wheelDeltaPercentage = 0.012;
      cam.panningSensibility = 900;
      cam.minZ = 0.1;
      cam.maxZ = 220;
      if (interactive) cam.attachControl(canvas, true);

      /* Lighting rig: the environment does the fill, lights do the direction.
         Colour temperature is physically based — the operator's fader resolves
         to a correlated colour temperature (the same mired mapping the R3F
         stage uses) and every light takes the black-body colour of its CCT, so
         a 3200 K key and a 5950 K fill land on the same whites a real fixture
         would. */
      const masterKelvin = temperatureToKelvin(temperature);
      const keyColor = Color3.FromHexString(kelvinToHex(masterKelvin));
      const fillColor = Color3.FromHexString(kelvinToHex(masterKelvin + 350));
      const ambientColor = Color3.FromHexString(kelvinToHex(masterKelvin - 250));

      const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
      hemi.intensity = 0.28 * lighting;
      hemi.diffuse = ambientColor;
      hemi.groundColor = new Color3(0.08, 0.09, 0.11);

      const key = new DirectionalLight('key', new Vector3(-0.52, -0.72, -0.46), scene);
      key.position = new Vector3(6.2, 9.4, 6.6);
      key.intensity = 2.35 * lighting;
      key.diffuse = keyColor;
      key.specular = keyColor;

      const fill = new DirectionalLight('fill', new Vector3(0.62, -0.5, -0.3), scene);
      fill.position = new Vector3(-7.4, 6.2, 5.2);
      fill.intensity = 0.72 * lighting;
      fill.diffuse = fillColor;

      const rim = new SpotLight(
        'rim',
        new Vector3(0, 8.6, -6.2),
        new Vector3(0, -1, 0.72),
        0.95,
        2.2,
        scene,
      );
      rim.intensity = 22 * lighting;
      rim.diffuse = accentColor(accent);

      /* Global illumination budget — the environment is the bounce, the
         emissives couple to real lights below. */
      const profile = fidelityProfile(fidelity);
      const gi = profile.globalIllumination;

      /* Volumetric haze — exponential scattering at the tier's density, the
         same physical model as the R3F `fogExp2` and Unreal's volumetric fog. */
      const volumetrics = profile.volumetrics;
      if (volumetrics) {
        scene.fogMode = Scene.FOGMODE_EXP2;
        scene.fogDensity = volumetrics.hazeDensity * 0.85;
        // Haze scatters the rig's own light — the fog takes the CCT of the
        // room with a touch of sky blue still in it.
        scene.fogColor = mixColor('#8fb2d6', kelvinToHex(masterKelvin), 0.5);
      } else {
        scene.fogMode = Scene.FOGMODE_NONE;
      }

      /* Shadows — contact-hardening PCSS for a real key-light falloff. */
      if (shadows) {
        const shadowGenerator = new ShadowGenerator(settings.shadowMapSize, key);
        shadowGenerator.bias = 0.0012;
        shadowGenerator.normalBias = 0.018;
        shadowGenerator.transparencyShadow = true;
        if (settings.shadowFilter === 'pcss') {
          shadowGenerator.useContactHardeningShadow = true;
          shadowGenerator.contactHardeningLightSizeUVRatio = 0.08;
          shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;
        } else if (settings.shadowFilter === 'blur') {
          shadowGenerator.useBlurExponentialShadowMap = true;
          shadowGenerator.blurKernel = 24;
          shadowGenerator.depthScale = 48;
        } else {
          shadowGenerator.usePoissonSampling = true;
        }
        for (const mesh of built.casters) shadowGenerator.addShadowCaster(mesh, true);
        for (const mesh of built.receivers) mesh.receiveShadows = true;
      }

      /* Talent plate. */
      let talentTexture: DynamicTexture | null = null;
      let keyedCanvas: HTMLCanvasElement | null = null;
      if (built.talentPlane) {
        const keyerOn = talent?.keyerEnabled !== false;
        const keyed = talent?.keyedCanvas ?? null;
        const raw = talent?.rawVideo ?? null;

        if (keyerOn && keyed) {
          keyedCanvas = keyed;
          talentTexture = new DynamicTexture('talent-tex', { width: 1280, height: 720 }, scene, true);
          talentTexture.hasAlpha = true;
          const mat = new PBRMaterial('talent-mat', scene);
          mat.albedoTexture = talentTexture;
          mat.metallic = 0;
          mat.roughness = 0.62;
          mat.emissiveTexture = talentTexture;
          mat.emissiveIntensity = 0.62;
          mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
          mat.backFaceCulling = false;
          built.talentPlane.material = mat;
          if (built.talentReflection) {
            const mirror = new PBRMaterial('talent-refl-mat', scene);
            mirror.albedoTexture = talentTexture;
            mirror.metallic = 0;
            mirror.roughness = 0.28;
            mirror.alpha = 0.16;
            mirror.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
            mirror.backFaceCulling = false;
            built.talentReflection.material = mirror;
            built.talentReflection.isVisible = true;
          }
        } else if (raw) {
          const videoTexture = new VideoTexture('talent-video', raw, scene, true);
          videoTexture.hasAlpha = true;
          const mat = new PBRMaterial('talent-video-mat', scene);
          mat.albedoTexture = videoTexture;
          mat.metallic = 0;
          mat.roughness = 0.58;
          mat.emissiveTexture = videoTexture;
          mat.emissiveIntensity = 0.68;
          mat.backFaceCulling = false;
          built.talentPlane.material = mat;
        } else {
          const mat = new PBRMaterial('talent-placeholder', scene);
          mat.albedoColor = new Color3(0.05, 0.055, 0.07);
          mat.metallic = 0;
          mat.roughness = 0.72;
          built.talentPlane.material = mat;
        }
      }

      /* Screen bindings — the set's LED wall, TVs and ribbons. */
      const slots = sceneDef?.screens ?? [];
      for (const { mesh, slotId } of built.screenPlanes) {
        const slot = slots.find((s) => s.id === slotId);
        const source = bindings?.[slotId] ?? slot?.defaultSource;
        const { texture, emissive } = resolveScreenTexture(
          scene,
          slotId,
          source,
          talent?.rawVideo ?? null,
        );
        const mat = new PBRMaterial(`screen-${slotId}`, scene);
        mat.metallic = 0;
        mat.roughness = 0.18;
        if (texture) {
          mat.albedoTexture = texture;
          mat.emissiveTexture = texture;
          mat.emissiveIntensity = emissive;
          mat.emissiveColor = Color3.White();
        } else {
          mat.albedoColor = new Color3(0.012, 0.015, 0.02);
          mat.emissiveColor = new Color3(0.02, 0.03, 0.05);
          mat.emissiveIntensity = 0.35;
        }
        mesh.material = mat;
      }

      /* Dynamic 3D light — screens and practicals throw real light into the
         set within the tier's slot budget (screens rank above practicals,
         matching the R3F `LightBudget` priorities). Every emissive couples to
         a real light, so bright fixtures physically relight the assets. */
      const dynamicLights: { light: PointLight; baseIntensity: number }[] = [];
      const spillSamples: { light: PointLight; source: StudioScreenSource | undefined }[] = [];
      const beams: { material: PBRMaterial; baseAlpha: number; phase: number }[] = [];
      // The rig already uses four lights (hemi + key + fill + rim).
      let lightSlots = Math.max(0, gi.maxDynamicLights - 4);
      let beamSlots = volumetrics?.maxBeams ?? 0;
      let fixtureIndex = 0;

      for (const { mesh, slotId } of built.screenPlanes) {
        if (lightSlots <= 0) break;
        lightSlots -= 1;
        fixtureIndex += 1;
        const slot = slots.find((s) => s.id === slotId);
        const source = bindings?.[slotId] ?? slot?.defaultSource;
        const spill = new PointLight(
          `spill-${slotId}`,
          mesh.position.add(new Vector3(0, -0.35, 1.7)),
          scene,
        );
        spill.range = 7.5;
        spill.diffuse = sampleScreenTint(source) ?? new Color3(0.15, 0.26, 0.37);
        spill.specular = spill.diffuse;
        const baseIntensity = gi.screenLightIntensity * 3.2;
        spill.intensity = baseIntensity * lighting;
        dynamicLights.push({ light: spill, baseIntensity });
        spillSamples.push({ light: spill, source });
      }

      for (const practical of built.practicals) {
        // Light-to-emissive coupling: the glow scales with the light budget.
        practical.glow.emissiveIntensity = 3.4 * gi.emissiveLightRatio;
        fixtureIndex += 1;
        if (lightSlots > 0) {
          lightSlots -= 1;
          const light = new PointLight(
            `practical-${fixtureIndex}`,
            practical.position.add(new Vector3(0, -0.3, 0)),
            scene,
          );
          light.range = 8.5;
          light.diffuse = Color3.FromHexString('#fff2dd');
          light.specular = light.diffuse;
          const baseIntensity = gi.practicalLightIntensity * 3.6;
          light.intensity = baseIntensity * lighting;
          dynamicLights.push({ light, baseIntensity });
        }

        /* Volumetric shaft under each can — scattering cones gated by tier. */
        if (volumetrics && beamSlots > 0) {
          beamSlots -= 1;
          const beam = MeshBuilder.CreateCylinder(
            `beam-${fixtureIndex}`,
            {
              height: 6.4,
              diameterTop: 0.34,
              diameterBottom: 1.9,
              tessellation: Math.max(8, volumetrics.beamSegments),
            },
            scene,
          );
          beam.position.copyFrom(practical.position).addInPlace(new Vector3(0, -3.35, 0));
          const beamMat = new PBRMaterial(`beam-mat-${fixtureIndex}`, scene);
          beamMat.emissiveColor = Color3.FromHexString('#fff2dd');
          beamMat.disableLighting = true;
          beamMat.backFaceCulling = false;
          beamMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
          beamMat.alpha = volumetrics.beamIntensity * 0.05;
          beam.material = beamMat;
          beams.push({
            material: beamMat,
            baseAlpha: volumetrics.beamIntensity * 0.05,
            phase: fixtureIndex * 1.37,
          });
        }
      }

      // Scaling closure captured at boot — the live-tuning effect applies the
      // operator's master light level without reaching into the scene graph.
      const setDynamicLightLevel = (level: number): void => {
        for (const entry of dynamicLights) {
          entry.light.intensity = entry.baseIntensity * level;
        }
      };

      /* Post-processing. */
      const pipeline = new DefaultRenderingPipeline('prism-babylon', true, scene, [cam]);
      pipeline.samples = settings.antiAliasing === 'msaa' ? settings.msaaSamples : 1;
      pipeline.fxaaEnabled = settings.antiAliasing === 'fxaa';
      pipeline.bloomEnabled = settings.bloom;
      pipeline.bloomThreshold = 0.82;
      pipeline.bloomWeight = settings.bloomIntensity;
      pipeline.bloomKernel = 64;
      pipeline.bloomScale = 0.5;
      pipeline.depthOfFieldEnabled = settings.depthOfField;
      pipeline.depthOfFieldBlurLevel = 2;
      pipeline.depthOfField.focusDistance = 7200;
      pipeline.depthOfField.focalLength = 52;
      pipeline.depthOfField.fStop = 2.6;
      pipeline.depthOfField.lensSize = 52;
      pipeline.grainEnabled = settings.grain;
      pipeline.grain.intensity = 7;
      pipeline.grain.animated = true;
      pipeline.sharpenEnabled = true;
      pipeline.sharpen.edgeAmount = 0.22;
      pipeline.sharpen.colorAmount = 1;
      // Tone mapping runs in the material's image-processing stage, not post.
      pipeline.imageProcessingEnabled = false;

      const ipc = scene.imageProcessingConfiguration;
      ipc.toneMappingEnabled = settings.imageProcessing;
      ipc.toneMappingType = toneMapConstant(settings.toneMapping);
      ipc.exposure = settings.exposure * exposure;
      ipc.contrast = settings.contrast;
      ipc.vignetteEnabled = settings.vignette && settings.imageProcessing;
      ipc.vignetteWeight = 1.85;
      ipc.vignetteCameraFov = 0.62;

      /* Show LUT — the identical display-space grade the R3F stage bakes into
         its 3D lookup texture, laid out as the flat strip Babylon loads. WB
         stays neutral here (the rig's kelvin already lights the room warm or
         cool); the LUT carries the show's film-consistent vibrance lift. */
      if (settings.imageProcessing) {
        ipc.colorGradingEnabled = true;
        ipc.colorGradingTexture = new ColorGradingTexture(
          buildGradeStripCanvas({
            contrast: 0,
            saturation: 1.02,
            vibrance: 1.08,
            temperature: 0,
          }).toDataURL(),
          scene,
        );
      }

      if (settings.ssao) {
        const ssao = new SSAO2RenderingPipeline('prism-ssao', scene, {
          ratio: 1,
          radius: 0.62,
          totalStrength: 1.25,
          base: 0.22,
        });
        scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline('prism-ssao', cam);
        void ssao;
      }

      /* Feed the keyed canvas into its texture every frame; animate the
         volumetric shafts; re-tint screen spill as the content changes. */
      let frame = 0;
      scene.onBeforeRenderObservable.add(() => {
        frame += 1;
        if (talentTexture && keyedCanvas) {
          const ctx = talentTexture.getContext() as CanvasRenderingContext2D;
          ctx.clearRect(0, 0, 1280, 720);
          ctx.drawImage(keyedCanvas, 0, 0, 1280, 720);
          talentTexture.update(true);
        }
        if (volumetrics?.animated) {
          const t = performance.now() * 0.001;
          for (const beam of beams) {
            beam.material.alpha =
              beam.baseAlpha * (0.82 + 0.18 * Math.sin(t * 0.7 + beam.phase));
          }
        }
        if (frame % 24 === 0) {
          for (const { light, source } of spillSamples) {
            const tint = sampleScreenTint(source);
            if (tint) {
              light.diffuse = Color3.Lerp(light.diffuse, tint, 0.45);
              light.specular = light.diffuse;
            }
          }
        }
        const report = reportRef.current;
        if (report) {
          report({
            yaw: Math.PI / 2 - cam.alpha,
            pitch: (Math.PI / 2 - 0.12 - cam.beta) / 0.62,
            zoom: BASE_RADIUS / cam.radius,
          });
        }
      });

      runtimeRef.current = {
        engine,
        scene,
        camera: cam,
        pipeline,
        talentTexture,
        keyedCanvas,
        dynamicLights,
        beams,
        setDynamicLightLevel,
      };

      onCanvasReady?.(canvas);
      onEngineReady?.({
        backend: engine.getClassName() === 'WebGPUEngine' ? 'webgpu' : 'webgl2',
        renderer: engine.getClassName(),
      });

      engine.runRenderLoop(() => {
        if (visible) scene.render();
      });
    };

    void boot().catch((error: unknown) => {
      console.error('[BabylonStudioStage] failed to start', error);
    });

    return () => {
      disposed = true;
      onCanvasReady?.(null);
      const runtime = runtimeRef.current;
      runtimeRef.current = null;
      if (runtime) {
        runtime.scene.dispose();
        runtime.engine.dispose();
      }
    };
    // Boot once per mount; live tuning is handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- live tuning ------------------------------------------------------- */
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const ipc = runtime.scene.imageProcessingConfiguration;
    ipc.toneMappingEnabled = settings.imageProcessing;
    ipc.toneMappingType = toneMapConstant(settings.toneMapping);
    ipc.exposure = settings.exposure * exposure;
    ipc.contrast = settings.contrast;
    ipc.vignetteEnabled = settings.vignette && settings.imageProcessing;
    runtime.pipeline.bloomEnabled = settings.bloom;
    runtime.pipeline.bloomWeight = settings.bloomIntensity;
    runtime.pipeline.depthOfFieldEnabled = settings.depthOfField;
    runtime.pipeline.grainEnabled = settings.grain;
    runtime.pipeline.fxaaEnabled = settings.antiAliasing === 'fxaa';
    runtime.scene.environmentIntensity =
      environment.intensity * settings.environmentIntensity * lighting;
    // Dynamic fixtures track the master light level live.
    runtime.setDynamicLightLevel(lighting);
  }, [settings, exposure, lighting, environment.intensity]);

  /* --- camera pose ------------------------------------------------------- */
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !cameraPose) return;
    const cam = runtime.camera;
    const yaw = cameraPose.yaw ?? 0;
    const pitch = cameraPose.pitch ?? 0;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cameraPose.zoom ?? 1));
    cam.alpha = Math.PI / 2 - yaw;
    cam.beta = Math.PI / 2 - 0.12 - pitch * 0.62;
    cam.radius = BASE_RADIUS / zoom;
    if (cameraPose.fov) cam.fov = (cameraPose.fov * Math.PI) / 180;
  }, [cameraPose]);

  /* --- visibility / interactivity --------------------------------------- */
  useEffect(() => {
    runtimeRef.current?.engine.resize();
  }, [visible]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    const canvas = canvasRef.current;
    if (!runtime || !canvas) return;
    if (interactive) runtime.camera.attachControl(canvas, true);
    else runtime.camera.detachControl();
  }, [interactive]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block', outline: 'none', ...style }}
      data-stage-engine="prism-babylon"
    />
  );
}

export default BabylonStudioStage;
/* PBR helpers are imported straight from `./materials` and `./textures` — a
   component module must only export components so React Fast Refresh works. */
