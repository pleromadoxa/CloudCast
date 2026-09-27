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
  /** Operator picked "off" — hide the plate entirely. */
  enabled?: boolean;
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
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 3.4;

/**
 * Per-scene photorealism overrides — camera look-at, post-processing and
 * environment intensity adjustments that close the fidelity gap between
 * the generic newsroom and scene-specific layouts.
 */
interface ScenePhotorealConfig {
  /** Camera look-at point in world space. */
  target: [number, number, number];
  /** Scene environment intensity multiplier (scales the IBL probe). */
  envIntensity: number;
  /** Bloom weight override (0–2). */
  bloomWeight?: number;
  /** Contrast override (0.8–1.6). */
  contrast?: number;
  /** Exposure bias in stops applied on top of the scene's exposureBias. */
  exposureBias?: number;
  /** Practical light tint hex — overrides the default warm white. */
  practicalTint?: string;
  /** Volumetric beam tint hex — overrides the default warm white. */
  beamTint?: string;
  /** Fog density multiplier (1 = default from fidelity tier). */
  fogMultiplier?: number;
}

const SCENE_PHOTOREAL: Record<string, ScenePhotorealConfig> = {
  // ── Original scenes ──
  newsroom:             { target: [0, 1.35, 0], envIntensity: 1 },
  global_news_arena:    { target: [0, 1.35, 0], envIntensity: 1 },
  classic_blue_news:    { target: [0, 1.35, 0], envIntensity: 1 },
  crimson_ring_studio:  { target: [0, 1.35, 0], envIntensity: 0.92, contrast: 1.12, bloomWeight: 0.35 },
  violet_hud_news:      { target: [0, 1.35, 0], envIntensity: 0.88, contrast: 1.08, bloomWeight: 0.4 },
  sports_arena:         { target: [0, 1.35, 0], envIntensity: 1.05 },
  living_room:          { target: [0, 1.2, 0], envIntensity: 1.1, bloomWeight: 0.22 },
  talk_show:            { target: [0, 1.35, 0], envIntensity: 1 },
  weather_center:       { target: [0, 1.35, 0], envIntensity: 1 },
  kitchen_set:          { target: [0, 1.2, 0], envIntensity: 1.05 },
  bedroom_suite:        { target: [0, 1.2, 0], envIntensity: 1.1, bloomWeight: 0.18 },
  conference_room:      { target: [0, 1.3, 0], envIntensity: 1 },
  house_exterior:       { target: [0, 1.2, 1], envIntensity: 1.2, bloomWeight: 0.2 },
  green_room:           { target: [0, 1.3, 0], envIntensity: 0.95 },
  xr_concert:           { target: [0, 1.4, 0], envIntensity: 0.7, contrast: 1.1, bloomWeight: 0.45 },
  cyclorama:            { target: [0, 1.35, 0], envIntensity: 1 },
  amber_talk_studio:    { target: [0, 1.35, 0], envIntensity: 1, bloomWeight: 0.3 },
  // ── New photorealistic sets ──
  news_premium: {
    target: [0, 1.35, 0],
    envIntensity: 0.95,
    bloomWeight: 0.38,
    contrast: 1.06,
    practicalTint: '#c0f0ff',
    beamTint: '#c0f0ff',
  },
  church_sanctuary: {
    target: [0, 1.6, -3],
    envIntensity: 1.1,
    bloomWeight: 0.28,
    practicalTint: '#ffd9a0',
    beamTint: '#ffe8c0',
    fogMultiplier: 1.3,
  },
  music_ministry: {
    target: [0, 1.5, -2],
    envIntensity: 0.72,
    bloomWeight: 0.52,
    contrast: 1.08,
    practicalTint: '#c8a8ff',
    beamTint: '#b48cff',
    fogMultiplier: 1.5,
  },
  luxury_ballroom: {
    target: [0, 1.4, 0],
    envIntensity: 1.0,
    bloomWeight: 0.4,
    contrast: 1.04,
    practicalTint: '#ffe8b0',
    beamTint: '#ffd88a',
  },
  concert_hall: {
    target: [0, 1.5, -3],
    envIntensity: 0.65,
    bloomWeight: 0.55,
    contrast: 1.1,
    practicalTint: '#ff9090',
    beamTint: '#ff7070',
    fogMultiplier: 1.6,
  },
  podcast_studio: {
    target: [0, 1.3, 0],
    envIntensity: 1.0,
    bloomWeight: 0.2,
    practicalTint: '#a0ffd0',
    beamTint: '#80ffb8',
  },
  fitness_studio: {
    target: [0, 1.3, 0],
    envIntensity: 1.2,
    bloomWeight: 0.15,
    exposureBias: 0.08,
    practicalTint: '#ffffff',
    beamTint: '#f8f8ff',
  },
  real_estate: {
    target: [0, 1.3, 0],
    envIntensity: 1.05,
    bloomWeight: 0.22,
    practicalTint: '#c8d8ff',
    beamTint: '#b0c8ff',
  },
  auction_house: {
    target: [0, 1.5, -1],
    envIntensity: 0.92,
    bloomWeight: 0.32,
    contrast: 1.08,
    practicalTint: '#ffe0a0',
    beamTint: '#ffd080',
  },
  film_noir: {
    target: [-1.5, 1.2, 0],
    envIntensity: 0.55,
    bloomWeight: 0.15,
    contrast: 1.35,
    exposureBias: -0.12,
    practicalTint: '#ffcc66',
    beamTint: '#e8b84a',
    fogMultiplier: 2.0,
  },
  rooftop_terrace: {
    target: [0, 1.2, 1],
    envIntensity: 1.25,
    bloomWeight: 0.2,
    practicalTint: '#ffe8b0',
    beamTint: '#ffd88a',
  },
  library_study: {
    target: [0, 1.3, 1],
    envIntensity: 0.88,
    bloomWeight: 0.25,
    contrast: 1.06,
    practicalTint: '#ffe0a0',
    beamTint: '#ffd080',
    fogMultiplier: 1.2,
  },
};

function getScenePhotorealConfig(sceneId: string): ScenePhotorealConfig {
  return SCENE_PHOTOREAL[sceneId] ?? { target: [0, 1.35, 0], envIntensity: 1 };
}

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

/* ================================================================
   SCENE-SPECIFIC GEOMETRY BUILDERS
   Each builder creates the procedural geometry for one virtual set.
   They all return the same BuiltSet shape so the stage driver can
   bind screens, talent and lights identically regardless of scene.
   ================================================================ */

/** ── Default news studio (original) ── */
function buildNewsStudio(scene: Scene, mats: ReturnType<typeof createStudioMaterialSet>, accent: Color3): BuiltSet {
  const casters: Mesh[] = [];
  const receivers: Mesh[] = [];
  const screenPlanes: { mesh: Mesh; slotId: string }[] = [];
  const practicals: { position: Vector3; glow: PBRMaterial }[] = [];

  // Floor — polished stone with a carpet inset under the desk
  const floor = MeshBuilder.CreateGround('floor', { width: 26, height: 22 }, scene);
  floor.material = mats.marble;
  receivers.push(floor);
  const carpet = MeshBuilder.CreateGround('carpet', { width: 11, height: 8 }, scene);
  carpet.position.set(0, 0.012, 1.2);
  carpet.material = mats.carpet;
  receivers.push(carpet);

  // Cyclorama
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

  // LED video wall
  const videoWall = MeshBuilder.CreatePlane('video-wall', { width: 13.6, height: 5.1 }, scene);
  videoWall.position.set(0, 3.85, -7.92);
  videoWall.rotation.y = Math.PI;
  const wallFrame = MeshBuilder.CreateBox('video-wall-frame', { width: 14.1, height: 5.6, depth: 0.32 }, scene);
  wallFrame.position.set(0, 3.85, -7.72);
  wallFrame.material = mats.anodized;
  casters.push(wallFrame);
  screenPlanes.push({ mesh: videoWall, slotId: 'video-wall' });

  // Flanking accent columns
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

  // Hero desk
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
  const deskReveal = MeshBuilder.CreateBox('desk-reveal', { width: 7.06, height: 0.075, depth: 1.72 }, scene);
  deskReveal.position.set(0, 1, 1.35);
  deskReveal.material = mats.chrome;
  casters.push(deskReveal);

  // Chairs
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

  // Truss with practicals
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

  // Ceiling
  const ceiling = MeshBuilder.CreateBox('ceiling', { width: 24, height: 0.3, depth: 22 }, scene);
  ceiling.position.set(0, 9.6, -1);
  ceiling.material = mats.fabric;
  receivers.push(ceiling);

  // Planters
  for (const side of [-1, 1]) {
    const pot = MeshBuilder.CreateCylinder('pot', { height: 0.9, diameterTop: 1, diameterBottom: 0.78 }, scene);
    pot.position.set(side * 6.4, 0.45, 5.4);
    pot.material = mats.marble;
    casters.push(pot);
    receivers.push(pot);
    for (let i = 0; i < 7; i += 1) {
      const leaf = MeshBuilder.CreatePlane('leaf', { width: 0.55, height: 1.9 }, scene);
      leaf.position.set(side * 6.4 + (i - 3) * 0.19, 1.85 + Math.abs(i - 3) * 0.12, 5.4 + (i % 3) * 0.16);
      leaf.rotation.y = i * 0.6;
      leaf.rotation.x = -0.35 + i * 0.07;
      leaf.material = createPbrMaterial(scene, `leaf-${side}-${i}`, 'black_fabric', {
        tint: '#20402c', metalScale: 0, roughnessScale: 1.1, doubleSided: true,
      });
      casters.push(leaf);
    }
  }

  return { casters, receivers, screenPlanes, practicals, talentPlane: null, talentReflection: null };
}

/** ── News Premium — floating glass desk, triple LED wall, LED floor ── */
function buildNewsPremium(scene: Scene, mats: ReturnType<typeof createStudioMaterialSet>, accent: Color3): BuiltSet {
  const casters: Mesh[] = [];
  const receivers: Mesh[] = [];
  const screenPlanes: { mesh: Mesh; slotId: string }[] = [];
  const practicals: { position: Vector3; glow: PBRMaterial }[] = [];

  // Floor — dark polished with LED strips
  const floor = MeshBuilder.CreateGround('floor', { width: 28, height: 24 }, scene);
  floor.material = mats.marble;
  receivers.push(floor);

  // LED floor strips
  for (const z of [-4, 0, 4]) {
    const strip = MeshBuilder.CreateBox('led-strip', { width: 26, height: 0.02, depth: 0.12 }, scene);
    strip.position.set(0, 0.015, z);
    const stripMat = new PBRMaterial(`led-strip-${z}`, scene);
    stripMat.albedoColor = new Color3(0.01, 0.01, 0.015);
    stripMat.emissiveColor = accent;
    stripMat.emissiveIntensity = 1.8;
    stripMat.metallic = 0;
    stripMat.roughness = 0.3;
    strip.material = stripMat;
    practicals.push({ position: strip.position.clone(), glow: stripMat });
  }

  // Back wall — dark with cyan accent glow
  const backWall = MeshBuilder.CreateBox('back-wall', { width: 26, height: 10, depth: 0.4 }, scene);
  backWall.position.set(0, 5, -9.5);
  backWall.material = mats.fabric;
  receivers.push(backWall);

  // Triple LED wall (3 panels)
  const panelWidth = 4.2;
  for (const [slotId, i] of [['triple_wall', 0], ['holo_data', -1], ['holo_data', 1]] as const) {
    const panel = MeshBuilder.CreatePlane(`panel-${i}`, { width: panelWidth, height: 4.8 }, scene);
    panel.position.set(i * 5.2, 4.2, -9.2);
    panel.rotation.y = Math.PI;
    screenPlanes.push({ mesh: panel, slotId });
    const frame = MeshBuilder.CreateBox(`panel-frame-${i}`, { width: panelWidth + 0.3, height: 5.2, depth: 0.2 }, scene);
    frame.position.set(i * 5.2, 4.2, -9.0);
    frame.material = mats.anodized;
    casters.push(frame);
  }

  // Floating glass desk
  const deskTop = MeshBuilder.CreateBox('desk-top', { width: 7.6, height: 0.08, depth: 1.4 }, scene);
  deskTop.position.set(0, 1.12, 1.0);
  const glassMat = createPbrMaterial(scene, 'glass-desk', 'glass_frost', {
    tint: '#e0f4ff', metalScale: 0, transparency: { alpha: 0.22, indexOfRefraction: 1.52 }, doubleSided: true,
  });
  deskTop.material = glassMat;
  casters.push(deskTop);
  // Chrome legs (minimal)
  for (const x of [-3, 0, 3]) {
    const leg = MeshBuilder.CreateCylinder('desk-leg', { height: 1.04, diameter: 0.06 }, scene);
    leg.position.set(x, 0.52, 1.0);
    leg.material = mats.chrome;
    casters.push(leg);
  }
  // Desk accent glow strip — cyan emissive under the glass top
  const deskAccent = MeshBuilder.CreateBox('desk-accent', { width: 6.8, height: 0.03, depth: 0.08 }, scene);
  deskAccent.position.set(0, 1.08, 1.65);
  const deskAccentMat = new PBRMaterial('desk-accent-mat', scene);
  deskAccentMat.albedoColor = new Color3(0.01, 0.01, 0.015);
  deskAccentMat.metallic = 0;
  deskAccentMat.roughness = 0.2;
  deskAccentMat.emissiveColor = accent;
  deskAccentMat.emissiveIntensity = 1.6;
  deskAccent.material = deskAccentMat;
  practicals.push({ position: deskAccent.position.clone(), glow: deskAccentMat });
  // Desk screen
  const deskScreen = MeshBuilder.CreatePlane('desk-screen', { width: 3.8, height: 0.45 }, scene);
  deskScreen.position.set(0, 0.52, 1.66);
  screenPlanes.push({ mesh: deskScreen, slotId: 'desk_screen' });

  // Accent columns
  for (const side of [-1, 1]) {
    const col = MeshBuilder.CreateBox('accent-col', { width: 0.5, height: 10, depth: 0.5 }, scene);
    col.position.set(side * 9.2, 5, -8);
    col.material = mats.brushedMetal;
    casters.push(col);
  }

  // Floor LED ribbon
  const floorRibbon = MeshBuilder.CreateBox('floor-ribbon', { width: 26, height: 0.015, depth: 0.35 }, scene);
  floorRibbon.position.set(0, 0.018, 4.5);
  const ribbonMat = new PBRMaterial('floor-ribbon-mat', scene);
  ribbonMat.emissiveColor = accent;
  ribbonMat.emissiveIntensity = 1.4;
  ribbonMat.metallic = 0;
  ribbonMat.roughness = 0.2;
  ribbonMat.albedoColor = new Color3(0.01, 0.01, 0.015);
  floorRibbon.material = ribbonMat;
  screenPlanes.push({ mesh: floorRibbon, slotId: 'floor_led' });

  // Truss with practicals
  for (const z of [-4.5, 0.5]) {
    const truss = MeshBuilder.CreateBox('truss', { width: 18, height: 0.24, depth: 0.24 }, scene);
    truss.position.set(0, 8.8, z);
    truss.material = mats.anodized;
    casters.push(truss);
    for (const x of [-6, -3, 0, 3, 6]) {
      const can = MeshBuilder.CreateCylinder('lamp', { height: 0.55, diameter: 0.38 }, scene);
      can.position.set(x, 8.35, z);
      can.material = mats.brushedMetal;
      casters.push(can);
      const lens = MeshBuilder.CreateDisc('lens', { radius: 0.16 }, scene);
      lens.position.set(x, 8.07, z);
      lens.rotation.x = Math.PI / 2;
      const lensMat = new PBRMaterial(`lens-${x}-${z}`, scene);
      lensMat.albedoColor = new Color3(0.03, 0.04, 0.05);
      lensMat.metallic = 0;
      lensMat.roughness = 0.1;
      lensMat.emissiveColor = Color3.FromHexString('#e0f4ff');
      lensMat.emissiveIntensity = 3.2;
      lens.material = lensMat;
      practicals.push({ position: lens.position.clone(), glow: lensMat });
    }
  }

  // Ceiling
  const ceiling = MeshBuilder.CreateBox('ceiling', { width: 28, height: 0.3, depth: 24 }, scene);
  ceiling.position.set(0, 9.8, -0.5);
  ceiling.material = mats.fabric;
  receivers.push(ceiling);

  return { casters, receivers, screenPlanes, practicals, talentPlane: null, talentReflection: null };
}

/** ── Church Sanctuary — pews, altar, stained glass, pendant lights ── */
function buildChurchSanctuary(scene: Scene, mats: ReturnType<typeof createStudioMaterialSet>, accent: Color3): BuiltSet {
  const casters: Mesh[] = [];
  const receivers: Mesh[] = [];
  const screenPlanes: { mesh: Mesh; slotId: string }[] = [];
  const practicals: { position: Vector3; glow: PBRMaterial }[] = [];

  // Floor — warm hardwood
  const floor = MeshBuilder.CreateGround('floor', { width: 24, height: 20 }, scene);
  floor.material = mats.oak;
  receivers.push(floor);

  // Raised altar platform
  const altarPlatform = MeshBuilder.CreateBox('altar-platform', { width: 10, height: 0.6, depth: 4 }, scene);
  altarPlatform.position.set(0, 0.3, -5.5);
  altarPlatform.material = mats.marble;
  casters.push(altarPlatform);
  receivers.push(altarPlatform);

  // Altar table
  const altarTable = MeshBuilder.CreateBox('altar-table', { width: 3.6, height: 0.95, depth: 1.0 }, scene);
  altarTable.position.set(0, 1.1, -5.8);
  altarTable.material = mats.walnut;
  casters.push(altarTable);
  receivers.push(altarTable);

  // Pews (3 rows on each side)
  for (const rowZ of [-2, 0.6, 3.2]) {
    for (const side of [-1, 1]) {
      const pew = MeshBuilder.CreateBox('pew', { width: 3.2, height: 0.45, depth: 0.75 }, scene);
      pew.position.set(side * 3.5, 0.48, rowZ);
      pew.material = mats.walnut;
      casters.push(pew);
      receivers.push(pew);
      // Pew back
      const pewBack = MeshBuilder.CreateBox('pew-back', { width: 3.2, height: 0.75, depth: 0.12 }, scene);
      pewBack.position.set(side * 3.5, 1.0, rowZ + 0.35);
      pewBack.material = mats.walnut;
      casters.push(pewBack);
    }
  }

  // Back wall
  const backWall = MeshBuilder.CreateBox('back-wall', { width: 24, height: 11, depth: 0.4 }, scene);
  backWall.position.set(0, 5.5, -8.5);
  backWall.material = mats.wall;
  casters.push(backWall);
  receivers.push(backWall);
  // Wall accent glow strips — warm amber emissive along base and ceiling
  for (const [y, label] of [[0.12, 'base'], [10.6, 'crown']] as const) {
    const wallAccent = MeshBuilder.CreateBox(`church-wall-${label}`, { width: 22, height: 0.06, depth: 0.06 }, scene);
    wallAccent.position.set(0, y, -8.25);
    const wallAccentMat = new PBRMaterial(`church-wall-${label}-mat`, scene);
    wallAccentMat.albedoColor = new Color3(0.02, 0.015, 0.01);
    wallAccentMat.metallic = 0;
    wallAccentMat.roughness = 0.2;
    wallAccentMat.emissiveColor = accent;
    wallAccentMat.emissiveIntensity = 1.0;
    wallAccent.material = wallAccentMat;
    practicals.push({ position: wallAccent.position.clone(), glow: wallAccentMat });
  }

  // Stained glass window (large slot)
  const stainedGlass = MeshBuilder.CreatePlane('stained-glass', { width: 8, height: 7 }, scene);
  stainedGlass.position.set(0, 5.5, -8.2);
  stainedGlass.rotation.y = Math.PI;
  screenPlanes.push({ mesh: stainedGlass, slotId: 'stained_glass' });

  // Projection wall (above altar)
  const projWall = MeshBuilder.CreatePlane('proj-wall', { width: 7, height: 3.5 }, scene);
  projWall.position.set(0, 5.8, -8.0);
  projWall.rotation.y = Math.PI;
  screenPlanes.push({ mesh: projWall, slotId: 'projection_wall' });

  // Lyric banner (ribbon)
  const lyricRibbon = MeshBuilder.CreatePlane('lyric-ribbon', { width: 14, height: 0.6 }, scene);
  lyricRibbon.position.set(0, 8.8, -4);
  lyricRibbon.rotation.x = -0.15;
  screenPlanes.push({ mesh: lyricRibbon, slotId: 'lyric_banner' });

  // Side monitors
  for (const side of [-1, 1]) {
    const mon = MeshBuilder.CreatePlane('side-mon', { width: 2.2, height: 1.5 }, scene);
    mon.position.set(side * 8.5, 3.5, -7);
    mon.rotation.y = side * -0.3;
    screenPlanes.push({ mesh: mon, slotId: 'side_monitor' });
  }

  // Pendant lights with volumetric rays
  for (const x of [-4, 0, 4]) {
    const pendant = MeshBuilder.CreateCylinder('pendant', { height: 0.5, diameterTop: 0.8, diameterBottom: 0.3 }, scene);
    pendant.position.set(x, 8.5, -2);
    pendant.material = mats.brass;
    casters.push(pendant);
    const lens = MeshBuilder.CreateDisc('lens', { radius: 0.2 }, scene);
    lens.position.set(x, 8.2, -2);
    lens.rotation.x = Math.PI / 2;
    const lensMat = new PBRMaterial(`pendant-lens-${x}`, scene);
    lensMat.albedoColor = new Color3(0.05, 0.04, 0.03);
    lensMat.metallic = 0;
    lensMat.roughness = 0.12;
    lensMat.emissiveColor = Color3.FromHexString('#ffd9a0');
    lensMat.emissiveIntensity = 3.8;
    lens.material = lensMat;
    practicals.push({ position: lens.position.clone(), glow: lensMat });
  }

  // Ceiling
  const ceiling = MeshBuilder.CreateBox('ceiling', { width: 24, height: 0.3, depth: 20 }, scene);
  ceiling.position.set(0, 10.5, -1);
  ceiling.material = mats.fabric;
  receivers.push(ceiling);

  return { casters, receivers, screenPlanes, practicals, talentPlane: null, talentReflection: null };
}

/** ── Music Ministry — band stage, LED floor, haze beams ── */
function buildMusicMinistry(scene: Scene, mats: ReturnType<typeof createStudioMaterialSet>, accent: Color3): BuiltSet {
  const casters: Mesh[] = [];
  const receivers: Mesh[] = [];
  const screenPlanes: { mesh: Mesh; slotId: string }[] = [];
  const practicals: { position: Vector3; glow: PBRMaterial }[] = [];

  // Stage floor — dark with LED inset
  const floor = MeshBuilder.CreateGround('floor', { width: 28, height: 22 }, scene);
  floor.material = mats.fabric;
  receivers.push(floor);

  // Raised stage platform
  const stage = MeshBuilder.CreateBox('stage', { width: 22, height: 0.5, depth: 10 }, scene);
  stage.position.set(0, 0.25, -2);
  stage.material = mats.carpet;
  casters.push(stage);
  receivers.push(stage);

  // LED floor panels (grid of emissive planes)
  for (let x = -8; x <= 8; x += 4) {
    for (let z = -6; z <= 2; z += 4) {
      const panel = MeshBuilder.CreateGround(`led-panel-${x}-${z}`, { width: 3.5, height: 3.5 }, scene);
      panel.position.set(x, 0.52, z);
      const panelMat = new PBRMaterial(`led-panel-mat-${x}-${z}`, scene);
      panelMat.albedoColor = new Color3(0.01, 0.01, 0.02);
      panelMat.emissiveColor = accent;
      panelMat.emissiveIntensity = 0.6;
      panelMat.metallic = 0;
      panelMat.roughness = 0.2;
      panel.material = panelMat;
      practicals.push({ position: panel.position.clone(), glow: panelMat });
      screenPlanes.push({ mesh: panel, slotId: 'led_floor' });
    }
  }

  // Main projection wall
  const mainWall = MeshBuilder.CreatePlane('main-wall', { width: 16, height: 7 }, scene);
  mainWall.position.set(0, 4.8, -7.2);
  mainWall.rotation.y = Math.PI;
  screenPlanes.push({ mesh: mainWall, slotId: 'main_wall' });
  const wallFrame = MeshBuilder.CreateBox('wall-frame', { width: 16.6, height: 7.5, depth: 0.28 }, scene);
  wallFrame.position.set(0, 4.8, -7.0);
  wallFrame.material = mats.anodized;
  casters.push(wallFrame);

  // Back wall
  const backWall = MeshBuilder.CreateBox('back-wall', { width: 24, height: 11, depth: 0.4 }, scene);
  backWall.position.set(0, 5.5, -9);
  backWall.material = mats.fabric;
  casters.push(backWall);
  receivers.push(backWall);
  // Wall accent glow strips — violet emissive LED rails
  const mmAccent = MeshBuilder.CreateBox('mm-wall-accent', { width: 22, height: 0.06, depth: 0.06 }, scene);
  mmAccent.position.set(0, 0.15, -8.75);
  const mmAccentMat = new PBRMaterial('mm-wall-accent-mat', scene);
  mmAccentMat.albedoColor = new Color3(0.015, 0.01, 0.025);
  mmAccentMat.metallic = 0;
  mmAccentMat.roughness = 0.2;
  mmAccentMat.emissiveColor = accent;
  mmAccentMat.emissiveIntensity = 1.6;
  mmAccent.material = mmAccentMat;
  practicals.push({ position: mmAccent.position.clone(), glow: mmAccentMat });

  // Side screens
  for (const side of [-1, 1]) {
    const sideScreen = MeshBuilder.CreatePlane('side-screen', { width: 3.5, height: 2.5 }, scene);
    sideScreen.position.set(side * 9.5, 3.5, -6);
    sideScreen.rotation.y = side * -0.35;
    screenPlanes.push({ mesh: sideScreen, slotId: 'side_screen' });
  }

  // Truss with spotlights and haze beam practicals
  for (const z of [-7, -2, 3]) {
    const truss = MeshBuilder.CreateBox('truss', { width: 20, height: 0.3, depth: 0.3 }, scene);
    truss.position.set(0, 9.5, z);
    truss.material = mats.anodized;
    casters.push(truss);
    for (const x of [-7, -3.5, 0, 3.5, 7]) {
      const can = MeshBuilder.CreateCylinder('lamp', { height: 0.5, diameter: 0.35 }, scene);
      can.position.set(x, 9.1, z);
      can.material = mats.brushedMetal;
      casters.push(can);
      const lens = MeshBuilder.CreateDisc('lens', { radius: 0.14 }, scene);
      lens.position.set(x, 8.85, z);
      lens.rotation.x = Math.PI / 2;
      const lensMat = new PBRMaterial(`lens-${x}-${z}`, scene);
      lensMat.albedoColor = new Color3(0.03, 0.02, 0.05);
      lensMat.metallic = 0;
      lensMat.roughness = 0.1;
      lensMat.emissiveColor = accent;
      lensMat.emissiveIntensity = 3.6;
      lens.material = lensMat;
      practicals.push({ position: lens.position.clone(), glow: lensMat });
    }
  }

  // Ceiling
  const ceiling = MeshBuilder.CreateBox('ceiling', { width: 28, height: 0.3, depth: 22 }, scene);
  ceiling.position.set(0, 10.5, -1);
  ceiling.material = mats.fabric;
  receivers.push(ceiling);

  return { casters, receivers, screenPlanes, practicals, talentPlane: null, talentReflection: null };
}

/** ── Luxury Ballroom — chandeliers, marble, wall frames, gold ── */
function buildLuxuryBallroom(scene: Scene, mats: ReturnType<typeof createStudioMaterialSet>, accent: Color3): BuiltSet {
  const casters: Mesh[] = [];
  const receivers: Mesh[] = [];
  const screenPlanes: { mesh: Mesh; slotId: string }[] = [];
  const practicals: { position: Vector3; glow: PBRMaterial }[] = [];

  // Marble floor with gold inlay lines
  const floor = MeshBuilder.CreateGround('floor', { width: 30, height: 26 }, scene);
  floor.material = mats.marble;
  receivers.push(floor);
  // Gold inlay lines
  for (const x of [-6, 0, 6]) {
    const line = MeshBuilder.CreateBox('inlay', { width: 0.08, height: 0.005, depth: 24 }, scene);
    line.position.set(x, 0.005, -1);
    const goldMat = new PBRMaterial(`gold-inlay-${x}`, scene);
    goldMat.albedoColor = accent;
    goldMat.metallic = 1;
    goldMat.roughness = 0.25;
    line.material = goldMat;
    receivers.push(line);
  }

  // Walls with crown molding
  const backWall = MeshBuilder.CreateBox('back-wall', { width: 28, height: 12, depth: 0.4 }, scene);
  backWall.position.set(0, 6, -10);
  backWall.material = mats.wall;
  receivers.push(backWall);
  casters.push(backWall);
  // Crown molding
  const molding = MeshBuilder.CreateBox('molding', { width: 28, height: 0.4, depth: 0.6 }, scene);
  molding.position.set(0, 11.6, -9.8);
  molding.material = mats.brass;
  casters.push(molding);

  // Side walls
  for (const side of [-1, 1]) {
    const wall = MeshBuilder.CreateBox('side-wall', { width: 0.4, height: 12, depth: 26 }, scene);
    wall.position.set(side * 13.8, 6, -1);
    wall.material = mats.wall;
    receivers.push(wall);
    // Wall accent glow strip — gold emissive along the base
    const wallAccent = MeshBuilder.CreateBox('wall-accent', { width: 0.06, height: 0.08, depth: 24 }, scene);
    wallAccent.position.set(side * 13.55, 0.15, -1);
    const wallAccentMat = new PBRMaterial(`wall-accent-${side}`, scene);
    wallAccentMat.albedoColor = new Color3(0.02, 0.015, 0.005);
    wallAccentMat.metallic = 0;
    wallAccentMat.roughness = 0.2;
    wallAccentMat.emissiveColor = accent;
    wallAccentMat.emissiveIntensity = 1.2;
    wallAccent.material = wallAccentMat;
    practicals.push({ position: wallAccent.position.clone(), glow: wallAccentMat });
  }

  // Feature wall — hero video wall
  const heroWall = MeshBuilder.CreatePlane('hero-wall', { width: 12, height: 5.5 }, scene);
  heroWall.position.set(0, 4.5, -9.7);
  heroWall.rotation.y = Math.PI;
  screenPlanes.push({ mesh: heroWall, slotId: 'hero_wall' });

  // Mirror display
  const mirrorScreen = MeshBuilder.CreatePlane('mirror-screen', { width: 3, height: 4 }, scene);
  mirrorScreen.position.set(-8, 4, -9.7);
  mirrorScreen.rotation.y = Math.PI;
  screenPlanes.push({ mesh: mirrorScreen, slotId: 'mirror_screen' });

  // Entrance screen
  const entranceScreen = MeshBuilder.CreatePlane('entrance-screen', { width: 3, height: 4 }, scene);
  entranceScreen.position.set(8, 4, -9.7);
  entranceScreen.rotation.y = Math.PI;
  screenPlanes.push({ mesh: entranceScreen, slotId: 'entrance_screen' });

  // Gold ticker ribbon
  const tickerRibbon = MeshBuilder.CreatePlane('ticker', { width: 20, height: 0.5 }, scene);
  tickerRibbon.position.set(0, 9.5, -8);
  tickerRibbon.rotation.x = -0.12;
  screenPlanes.push({ mesh: tickerRibbon, slotId: 'ticker' });

  // Crystal chandeliers (3)
  for (const x of [-6, 0, 6]) {
    // Chandelier body — tiered rings
    for (const [r, h] of [[0.8, 0.3], [1.4, 0.15], [2.0, 0.08]] as const) {
      const ring = MeshBuilder.CreateTorus(`chand-ring-${x}-${h}`, { diameter: r * 2, thickness: 0.04, tessellation: 48 }, scene);
      ring.position.set(x, 10.5 - h, -1);
      ring.material = mats.chrome;
      casters.push(ring);
    }
    // Central pendant
    const pendant = MeshBuilder.CreateCylinder('pendant', { height: 0.6, diameter: 0.25 }, scene);
    pendant.position.set(x, 10.8, -1);
    pendant.material = mats.chrome;
    casters.push(pendant);
    // Glowing lens
    const lens = MeshBuilder.CreateDisc('lens', { radius: 0.25 }, scene);
    lens.position.set(x, 10.1, -1);
    lens.rotation.x = Math.PI / 2;
    const lensMat = new PBRMaterial(`chand-lens-${x}`, scene);
    lensMat.albedoColor = new Color3(0.06, 0.05, 0.04);
    lensMat.metallic = 0;
    lensMat.roughness = 0.1;
    lensMat.emissiveColor = Color3.FromHexString('#fff0d0');
    lensMat.emissiveIntensity = 4.2;
    lens.material = lensMat;
    practicals.push({ position: lens.position.clone(), glow: lensMat });
  }

  // Velvet drape panels
  for (const side of [-1, 1]) {
    const drape = MeshBuilder.CreateBox('drape', { width: 0.15, height: 10, depth: 4 }, scene);
    drape.position.set(side * 13.5, 5, -6);
    const drapeMat = createPbrMaterial(scene, `drape-${side}`, 'black_fabric', {
      tint: '#5c1a1a', metalScale: 0, roughnessScale: 1.2, sheen: { intensity: 0.5, color: '#8b2020' },
    });
    drape.material = drapeMat;
    casters.push(drape);
  }

  // Elegant sofa seating
  for (const side of [-1, 1]) {
    const sofa = MeshBuilder.CreateBox('sofa', { width: 3, height: 0.5, depth: 1.2 }, scene);
    sofa.position.set(side * 5, 0.45, 4);
    sofa.material = mats.leather;
    casters.push(sofa);
    const sofaBack = MeshBuilder.CreateBox('sofa-back', { width: 3, height: 0.9, depth: 0.2 }, scene);
    sofaBack.position.set(side * 5, 1.0, 3.5);
    sofaBack.rotation.x = -0.1;
    sofaBack.material = mats.upholstery;
    casters.push(sofaBack);
  }

  // Ceiling
  const ceiling = MeshBuilder.CreateBox('ceiling', { width: 30, height: 0.4, depth: 26 }, scene);
  ceiling.position.set(0, 12, -1);
  ceiling.material = mats.fabric;
  receivers.push(ceiling);

  return { casters, receivers, screenPlanes, practicals, talentPlane: null, talentReflection: null };
}

/** ── Concert Hall — arena stage, truss rig, LED wall ── */
function buildConcertHall(scene: Scene, mats: ReturnType<typeof createStudioMaterialSet>, accent: Color3): BuiltSet {
  const casters: Mesh[] = [];
  const receivers: Mesh[] = [];
  const screenPlanes: { mesh: Mesh; slotId: string }[] = [];
  const practicals: { position: Vector3; glow: PBRMaterial }[] = [];

  // Dark stage floor
  const floor = MeshBuilder.CreateGround('floor', { width: 32, height: 28 }, scene);
  floor.material = mats.carpet;
  receivers.push(floor);

  // Raised stage platform (2 tiers)
  const mainStage = MeshBuilder.CreateBox('main-stage', { width: 24, height: 0.6, depth: 12 }, scene);
  mainStage.position.set(0, 0.3, -4);
  mainStage.material = mats.fabric;
  casters.push(mainStage);
  receivers.push(mainStage);
  const riser = MeshBuilder.CreateBox('riser', { width: 16, height: 0.35, depth: 4 }, scene);
  riser.position.set(0, 0.77, -8);
  riser.material = mats.fabric;
  casters.push(riser);
  receivers.push(riser);

  // Main LED wall
  const mainWall = MeshBuilder.CreatePlane('main-wall', { width: 20, height: 8 }, scene);
  mainWall.position.set(0, 5.5, -10);
  mainWall.rotation.y = Math.PI;
  screenPlanes.push({ mesh: mainWall, slotId: 'main_wall' });
  const wallFrame = MeshBuilder.CreateBox('wall-frame', { width: 20.6, height: 8.6, depth: 0.35 }, scene);
  wallFrame.position.set(0, 5.5, -9.8);
  wallFrame.material = mats.anodized;
  casters.push(wallFrame);

  // Wing walls
  for (const [side, slotId] of [[-1, 'left_wing'], [1, 'right_wing']] as const) {
    const wing = MeshBuilder.CreatePlane(`wing-${side}`, { width: 6, height: 6 }, scene);
    wing.position.set(side * 11, 4.5, -7);
    wing.rotation.y = side * -0.4;
    screenPlanes.push({ mesh: wing, slotId });
  }

  // Stage ribbon
  const ribbon = MeshBuilder.CreatePlane('ribbon', { width: 22, height: 0.55 }, scene);
  ribbon.position.set(0, 8.5, -5);
  ribbon.rotation.x = -0.08;
  screenPlanes.push({ mesh: ribbon, slotId: 'ribbon' });

  // Back wall
  const backWall = MeshBuilder.CreateBox('back-wall', { width: 30, height: 12, depth: 0.4 }, scene);
  backWall.position.set(0, 6, -12);
  backWall.material = mats.fabric;
  casters.push(backWall);
  receivers.push(backWall);
  // Wall accent glow strips — red emissive LED rails along base
  const concertAccent = MeshBuilder.CreateBox('concert-wall-accent', { width: 28, height: 0.06, depth: 0.06 }, scene);
  concertAccent.position.set(0, 0.15, -11.75);
  const concertAccentMat = new PBRMaterial('concert-wall-accent-mat', scene);
  concertAccentMat.albedoColor = new Color3(0.02, 0.01, 0.01);
  concertAccentMat.metallic = 0;
  concertAccentMat.roughness = 0.2;
  concertAccentMat.emissiveColor = accent;
  concertAccentMat.emissiveIntensity = 1.8;
  concertAccent.material = concertAccentMat;
  practicals.push({ position: concertAccent.position.clone(), glow: concertAccentMat });

  // Truss rig (2 rows)
  for (const z of [-10, -3]) {
    const truss = MeshBuilder.CreateBox('truss', { width: 24, height: 0.35, depth: 0.35 }, scene);
    truss.position.set(0, 10.5, z);
    truss.material = mats.anodized;
    casters.push(truss);
    for (const x of [-8, -4, 0, 4, 8]) {
      const can = MeshBuilder.CreateCylinder('lamp', { height: 0.55, diameter: 0.4 }, scene);
      can.position.set(x, 10.05, z);
      can.material = mats.brushedMetal;
      casters.push(can);
      const lens = MeshBuilder.CreateDisc('lens', { radius: 0.17 }, scene);
      lens.position.set(x, 9.77, z);
      lens.rotation.x = Math.PI / 2;
      const lensMat = new PBRMaterial(`lens-${x}-${z}`, scene);
      lensMat.albedoColor = new Color3(0.04, 0.02, 0.02);
      lensMat.metallic = 0;
      lensMat.roughness = 0.1;
      lensMat.emissiveColor = accent;
      lensMat.emissiveIntensity = 4.0;
      lens.material = lensMat;
      practicals.push({ position: lens.position.clone(), glow: lensMat });
    }
  }

  // Stage monitors
  for (const x of [-5, 0, 5]) {
    const monitor = MeshBuilder.CreateBox('monitor', { width: 1.2, height: 0.7, depth: 0.8 }, scene);
    monitor.position.set(x, 0.65, -1.2);
    monitor.rotation.x = -0.3;
    monitor.material = mats.screenPanel;
    casters.push(monitor);
  }

  // Ceiling
  const ceiling = MeshBuilder.CreateBox('ceiling', { width: 32, height: 0.3, depth: 28 }, scene);
  ceiling.position.set(0, 11.5, -1);
  ceiling.material = mats.fabric;
  receivers.push(ceiling);

  return { casters, receivers, screenPlanes, practicals, talentPlane: null, talentReflection: null };
}

/** ── Podcast Studio — intimate booth, acoustic panels, boom mics ── */
function buildPodcastStudio(scene: Scene, mats: ReturnType<typeof createStudioMaterialSet>, accent: Color3): BuiltSet {
  const casters: Mesh[] = [];
  const receivers: Mesh[] = [];
  const screenPlanes: { mesh: Mesh; slotId: string }[] = [];
  const practicals: { position: Vector3; glow: PBRMaterial }[] = [];

  // Floor — carpet
  const floor = MeshBuilder.CreateGround('floor', { width: 16, height: 14 }, scene);
  floor.material = mats.carpet;
  receivers.push(floor);

  // Back wall with acoustic panels
  const backWall = MeshBuilder.CreateBox('back-wall', { width: 16, height: 8, depth: 0.4 }, scene);
  backWall.position.set(0, 4, -5.5);
  backWall.material = mats.fabric;
  receivers.push(backWall);
  casters.push(backWall);

  // Acoustic foam panels on back wall
  for (let x = -5; x <= 5; x += 2.5) {
    const panel = MeshBuilder.CreateBox('acoustic-panel', { width: 2, height: 4, depth: 0.15 }, scene);
    panel.position.set(x, 4, -5.2);
    const panelMat = createPbrMaterial(scene, `acoustic-${x}`, 'black_fabric', {
      tint: '#1a1a2e', metalScale: 0, roughnessScale: 1.2,
    });
    panel.material = panelMat;
    casters.push(panel);
  }

  // Side walls
  for (const side of [-1, 1]) {
    const wall = MeshBuilder.CreateBox('side-wall', { width: 0.4, height: 8, depth: 14 }, scene);
    wall.position.set(side * 7.8, 4, -0.5);
    wall.material = mats.wall;
    receivers.push(wall);
  }

  // Main screen
  const mainScreen = MeshBuilder.CreatePlane('main-screen', { width: 8, height: 3.5 }, scene);
  mainScreen.position.set(0, 5, -5.2);
  mainScreen.rotation.y = Math.PI;
  screenPlanes.push({ mesh: mainScreen, slotId: 'main_screen' });

  // Round podcast table
  const table = MeshBuilder.CreateCylinder('podcast-table', { height: 0.8, diameter: 2.8, tessellation: 32 }, scene);
  table.position.set(0, 0.4, 0.8);
  table.material = mats.walnut;
  casters.push(table);
  receivers.push(table);

  // Microphone boom arms (simplified)
  for (const side of [-1, 1]) {
    const arm = MeshBuilder.CreateCylinder('boom-arm', { height: 1.5, diameter: 0.04 }, scene);
    arm.position.set(side * 0.8, 1.6, 0.8);
    arm.rotation.z = side * 0.6;
    arm.material = mats.anodized;
    casters.push(arm);
    const mic = MeshBuilder.CreateSphere('mic', { diameter: 0.14, segments: 16 }, scene);
    mic.position.set(side * 1.3, 2.2, 0.8);
    mic.material = mats.screenPanel;
    casters.push(mic);
  }

  // LED accent strips on walls
  for (const side of [-1, 1]) {
    const strip = MeshBuilder.CreateBox('led-strip', { width: 0.06, height: 6, depth: 0.06 }, scene);
    strip.position.set(side * 7.6, 4, -3);
    const stripMat = new PBRMaterial(`led-accent-${side}`, scene);
    stripMat.albedoColor = new Color3(0.01, 0.01, 0.015);
    stripMat.emissiveColor = accent;
    stripMat.emissiveIntensity = 1.8;
    stripMat.metallic = 0;
    stripMat.roughness = 0.2;
    strip.material = stripMat;
    practicals.push({ position: strip.position.clone(), glow: stripMat });
  }

  // Ceiling
  const ceiling = MeshBuilder.CreateBox('ceiling', { width: 16, height: 0.3, depth: 14 }, scene);
  ceiling.position.set(0, 8, -0.5);
  ceiling.material = mats.fabric;
  receivers.push(ceiling);

  return { casters, receivers, screenPlanes, practicals, talentPlane: null, talentReflection: null };
}

/** ── Fitness Studio — mirrored wall, open floor, equipment ── */
function buildFitnessStudio(scene: Scene, mats: ReturnType<typeof createStudioMaterialSet>, accent: Color3): BuiltSet {
  const casters: Mesh[] = [];
  const receivers: Mesh[] = [];
  const screenPlanes: { mesh: Mesh; slotId: string }[] = [];
  const practicals: { position: Vector3; glow: PBRMaterial }[] = [];

  // Gym floor
  const floor = MeshBuilder.CreateGround('floor', { width: 24, height: 20 }, scene);
  floor.material = mats.carpet;
  receivers.push(floor);

  // Mirror/display wall (back)
  const mirrorWall = MeshBuilder.CreatePlane('mirror-wall', { width: 16, height: 7 }, scene);
  mirrorWall.position.set(0, 3.5, -8);
  mirrorWall.rotation.y = Math.PI;
  screenPlanes.push({ mesh: mirrorWall, slotId: 'mirror_wall' });

  // Back wall frame
  const backWall = MeshBuilder.CreateBox('back-wall', { width: 22, height: 9, depth: 0.4 }, scene);
  backWall.position.set(0, 4.5, -8.5);
  backWall.material = mats.wall;
  casters.push(backWall);
  receivers.push(backWall);

  // Side walls
  for (const side of [-1, 1]) {
    const wall = MeshBuilder.CreateBox('side-wall', { width: 0.4, height: 9, depth: 20 }, scene);
    wall.position.set(side * 11, 4.5, 0);
    wall.material = mats.wall;
    receivers.push(wall);
  }

  // Timer screen
  const timerScreen = MeshBuilder.CreatePlane('timer', { width: 3, height: 2 }, scene);
  timerScreen.position.set(8, 5, -7.8);
  timerScreen.rotation.y = Math.PI;
  screenPlanes.push({ mesh: timerScreen, slotId: 'timer_screen' });

  // Exercise mat zones (colored ground markers)
  for (let i = -3; i <= 3; i++) {
    const mat = MeshBuilder.CreateGround(`ex-mat-${i}`, { width: 1.5, height: 2.2 }, scene);
    mat.position.set(i * 2.2, 0.008, 1);
    const matMat = new PBRMaterial(`ex-mat-mat-${i}`, scene);
    matMat.albedoColor = accent;
    matMat.metallic = 0;
    matMat.roughness = 0.9;
    matMat.alpha = 0.35;
    matMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
    mat.material = matMat;
    receivers.push(mat);
  }

  // Equipment rack (simplified)
  const rack = MeshBuilder.CreateBox('rack', { width: 4, height: 3.5, depth: 0.8 }, scene);
  rack.position.set(-9, 1.75, -5);
  rack.material = mats.brushedMetal;
  casters.push(rack);
  // Weights
  for (let i = 0; i < 4; i++) {
    const weight = MeshBuilder.CreateCylinder('weight', { height: 0.35, diameter: 0.6 }, scene);
    weight.position.set(-9 + (i - 1.5) * 0.8, 0.7 + i * 0.5, -5);
    weight.rotation.z = Math.PI / 2;
    weight.material = mats.anodized;
    casters.push(weight);
  }

  // Bright overhead practicals
  for (const z of [-4, 2]) {
    const truss = MeshBuilder.CreateBox('truss', { width: 20, height: 0.2, depth: 0.2 }, scene);
    truss.position.set(0, 8.2, z);
    truss.material = mats.anodized;
    casters.push(truss);
    for (const x of [-6, -2, 2, 6]) {
      const panel = MeshBuilder.CreateBox('light-panel', { width: 1.8, height: 0.12, depth: 0.6 }, scene);
      panel.position.set(x, 8.0, z);
      const panelMat = new PBRMaterial(`light-panel-${x}-${z}`, scene);
      panelMat.albedoColor = new Color3(0.05, 0.05, 0.06);
      panelMat.metallic = 0;
      panelMat.roughness = 0.15;
      panelMat.emissiveColor = Color3.White();
      panelMat.emissiveIntensity = 2.8;
      panel.material = panelMat;
      practicals.push({ position: panel.position.clone(), glow: panelMat });
    }
  }

  // Ceiling
  const ceiling = MeshBuilder.CreateBox('ceiling', { width: 24, height: 0.3, depth: 20 }, scene);
  ceiling.position.set(0, 8.8, 0);
  ceiling.material = mats.fabric;
  receivers.push(ceiling);

  return { casters, receivers, screenPlanes, practicals, talentPlane: null, talentReflection: null };
}

/** ── Real Estate Showcase — property listing, display wall, modern furniture ── */
function buildRealEstate(scene: Scene, mats: ReturnType<typeof createStudioMaterialSet>, accent: Color3): BuiltSet {
  const casters: Mesh[] = [];
  const receivers: Mesh[] = [];
  const screenPlanes: { mesh: Mesh; slotId: string }[] = [];
  const practicals: { position: Vector3; glow: PBRMaterial }[] = [];

  // Clean floor
  const floor = MeshBuilder.CreateGround('floor', { width: 22, height: 18 }, scene);
  floor.material = mats.marble;
  receivers.push(floor);

  // Back wall
  const backWall = MeshBuilder.CreateBox('back-wall', { width: 22, height: 9, depth: 0.4 }, scene);
  backWall.position.set(0, 4.5, -7);
  backWall.material = mats.wall;
  casters.push(backWall);
  receivers.push(backWall);

  // Property display wall
  const propWall = MeshBuilder.CreatePlane('prop-wall', { width: 12, height: 5.5 }, scene);
  propWall.position.set(0, 4, -6.7);
  propWall.rotation.y = Math.PI;
  screenPlanes.push({ mesh: propWall, slotId: 'property_wall' });

  // Agent monitor
  const agentMon = MeshBuilder.CreatePlane('agent-mon', { width: 3.5, height: 2 }, scene);
  agentMon.position.set(-7, 3, -6.7);
  agentMon.rotation.y = Math.PI;
  screenPlanes.push({ mesh: agentMon, slotId: 'agent_monitor' });

  // Detail screen
  const detailScreen = MeshBuilder.CreatePlane('detail', { width: 3.5, height: 2 }, scene);
  detailScreen.position.set(7, 3, -6.7);
  detailScreen.rotation.y = Math.PI;
  screenPlanes.push({ mesh: detailScreen, slotId: 'detail_screen' });

  // Presentation desk
  const deskTop = MeshBuilder.CreateBox('desk-top', { width: 4.5, height: 0.12, depth: 1.2 }, scene);
  deskTop.position.set(0, 0.92, 1.5);
  deskTop.material = mats.walnut;
  casters.push(deskTop);
  receivers.push(deskTop);
  const deskBody = MeshBuilder.CreateBox('desk-body', { width: 4.3, height: 0.85, depth: 1.0 }, scene);
  deskBody.position.set(0, 0.42, 1.5);
  deskBody.material = mats.brushedMetal;
  casters.push(deskBody);
  // Desk accent glow strip — blue emissive under the walnut top
  const reDeskAccent = MeshBuilder.CreateBox('desk-accent', { width: 4.0, height: 0.025, depth: 0.06 }, scene);
  reDeskAccent.position.set(0, 0.88, 2.06);
  const reDeskAccentMat = new PBRMaterial('re-desk-accent-mat', scene);
  reDeskAccentMat.albedoColor = new Color3(0.01, 0.01, 0.015);
  reDeskAccentMat.metallic = 0;
  reDeskAccentMat.roughness = 0.2;
  reDeskAccentMat.emissiveColor = accent;
  reDeskAccentMat.emissiveIntensity = 1.4;
  reDeskAccent.material = reDeskAccentMat;
  practicals.push({ position: reDeskAccent.position.clone(), glow: reDeskAccentMat });
  const sofa = MeshBuilder.CreateBox('sofa', { width: 4, height: 0.5, depth: 1.2 }, scene);
  sofa.position.set(5, 0.45, 3);
  sofa.material = mats.upholstery;
  casters.push(sofa);
  const sofaBack = MeshBuilder.CreateBox('sofa-back', { width: 4, height: 0.85, depth: 0.18 }, scene);
  sofaBack.position.set(5, 0.95, 2.5);
  sofaBack.rotation.x = -0.1;
  sofaBack.material = mats.leather;
  casters.push(sofaBack);

  // Accent light strips
  for (const x of [-10, 10]) {
    const strip = MeshBuilder.CreateBox('strip', { width: 0.08, height: 7, depth: 0.08 }, scene);
    strip.position.set(x, 3.5, -6.5);
    const stripMat = new PBRMaterial(`accent-strip-${x}`, scene);
    stripMat.albedoColor = new Color3(0.01, 0.01, 0.015);
    stripMat.emissiveColor = accent;
    stripMat.emissiveIntensity = 1.5;
    stripMat.metallic = 0;
    stripMat.roughness = 0.2;
    strip.material = stripMat;
    practicals.push({ position: strip.position.clone(), glow: stripMat });
  }

  // Ceiling
  const ceiling = MeshBuilder.CreateBox('ceiling', { width: 22, height: 0.3, depth: 18 }, scene);
  ceiling.position.set(0, 9, -0.5);
  ceiling.material = mats.fabric;
  receivers.push(ceiling);

  return { casters, receivers, screenPlanes, practicals, talentPlane: null, talentReflection: null };
}

/** ── Auction House — podium, display cases, prestigious ── */
function buildAuctionHouse(scene: Scene, mats: ReturnType<typeof createStudioMaterialSet>, accent: Color3): BuiltSet {
  const casters: Mesh[] = [];
  const receivers: Mesh[] = [];
  const screenPlanes: { mesh: Mesh; slotId: string }[] = [];
  const practicals: { position: Vector3; glow: PBRMaterial }[] = [];

  // Rich floor
  const floor = MeshBuilder.CreateGround('floor', { width: 24, height: 20 }, scene);
  floor.material = mats.oak;
  receivers.push(floor);

  // Back wall
  const backWall = MeshBuilder.CreateBox('back-wall', { width: 24, height: 10, depth: 0.4 }, scene);
  backWall.position.set(0, 5, -8);
  backWall.material = mats.wall;
  casters.push(backWall);
  receivers.push(backWall);

  // Lot display wall
  const lotWall = MeshBuilder.CreatePlane('lot-wall', { width: 14, height: 5.5 }, scene);
  lotWall.position.set(0, 4.5, -7.7);
  lotWall.rotation.y = Math.PI;
  screenPlanes.push({ mesh: lotWall, slotId: 'lot_wall' });

  // Raised auction podium
  const podium = MeshBuilder.CreateBox('podium', { width: 2.5, height: 1.4, depth: 1.8 }, scene);
  podium.position.set(0, 0.7, -2);
  podium.material = mats.walnut;
  casters.push(podium);
  receivers.push(podium);
  // Brass rail on podium
  const podiumRail = MeshBuilder.CreateBox('podium-rail', { width: 2.6, height: 0.06, depth: 0.06 }, scene);
  podiumRail.position.set(0, 1.45, -1.1);
  podiumRail.material = mats.brass;
  casters.push(podiumRail);
  // Podium accent glow strip — warm amber emissive
  const podiumAccent = MeshBuilder.CreateBox('podium-accent', { width: 2.2, height: 0.025, depth: 0.06 }, scene);
  podiumAccent.position.set(0, 1.42, -1.1);
  const podiumAccentMat = new PBRMaterial('podium-accent-mat', scene);
  podiumAccentMat.albedoColor = new Color3(0.02, 0.015, 0.01);
  podiumAccentMat.metallic = 0;
  podiumAccentMat.roughness = 0.2;
  podiumAccentMat.emissiveColor = accent;
  podiumAccentMat.emissiveIntensity = 1.5;
  podiumAccent.material = podiumAccentMat;
  practicals.push({ position: podiumAccent.position.clone(), glow: podiumAccentMat });

  // Bid display screen
  const bidScreen = MeshBuilder.CreatePlane('bid-screen', { width: 4, height: 2.5 }, scene);
  bidScreen.position.set(-6, 3.5, -7.7);
  bidScreen.rotation.y = Math.PI;
  screenPlanes.push({ mesh: bidScreen, slotId: 'bid_screen' });

  // Desk monitor
  const deskMon = MeshBuilder.CreatePlane('desk-mon', { width: 2, height: 1.2 }, scene);
  deskMon.position.set(0, 1.9, -1.1);
  screenPlanes.push({ mesh: deskMon, slotId: 'desk_monitor' });

  // Display cases (glass pedestals)
  for (const side of [-1, 1]) {
    const pedestal = MeshBuilder.CreateBox('pedestal', { width: 1.2, height: 1.1, depth: 1.2 }, scene);
    pedestal.position.set(side * 6, 0.55, -2);
    pedestal.material = mats.marble;
    casters.push(pedestal);
    const glassCase = MeshBuilder.CreateBox('glass-case', { width: 1.1, height: 0.9, depth: 1.1 }, scene);
    glassCase.position.set(side * 6, 1.55, -2);
    const glassMat = createPbrMaterial(scene, `glass-case-${side}`, 'glass_frost', {
      tint: '#f0f0f0', metalScale: 0, transparency: { alpha: 0.15, indexOfRefraction: 1.52 }, doubleSided: true,
    });
    glassCase.material = glassMat;
    casters.push(glassCase);
  }

  // Leather auctioneer chair
  const chair = MeshBuilder.CreateBox('chair', { width: 0.9, height: 0.3, depth: 0.8 }, scene);
  chair.position.set(0, 0.75, -2);
  chair.material = mats.leather;
  casters.push(chair);

  // Spotlights
  for (const x of [-5, 0, 5]) {
    const spot = MeshBuilder.CreateCylinder('spot', { height: 0.4, diameter: 0.3 }, scene);
    spot.position.set(x, 9.2, -2);
    spot.material = mats.brushedMetal;
    casters.push(spot);
    const lens = MeshBuilder.CreateDisc('lens', { radius: 0.12 }, scene);
    lens.position.set(x, 9.0, -2);
    lens.rotation.x = Math.PI / 2;
    const lensMat = new PBRMaterial(`spot-lens-${x}`, scene);
    lensMat.albedoColor = new Color3(0.05, 0.04, 0.03);
    lensMat.metallic = 0;
    lensMat.roughness = 0.1;
    lensMat.emissiveColor = Color3.FromHexString('#ffe8c0');
    lensMat.emissiveIntensity = 3.5;
    lens.material = lensMat;
    practicals.push({ position: lens.position.clone(), glow: lensMat });
  }

  // Ceiling
  const ceiling = MeshBuilder.CreateBox('ceiling', { width: 24, height: 0.3, depth: 20 }, scene);
  ceiling.position.set(0, 9.8, -1);
  ceiling.material = mats.fabric;
  receivers.push(ceiling);

  return { casters, receivers, screenPlanes, practicals, talentPlane: null, talentReflection: null };
}

/** ── Film Noir — dramatic chiaroscuro, venetian shadows, vintage ── */
function buildFilmNoir(scene: Scene, mats: ReturnType<typeof createStudioMaterialSet>, accent: Color3): BuiltSet {
  const casters: Mesh[] = [];
  const receivers: Mesh[] = [];
  const screenPlanes: { mesh: Mesh; slotId: string }[] = [];
  const practicals: { position: Vector3; glow: PBRMaterial }[] = [];

  // Dark floor
  const floor = MeshBuilder.CreateGround('floor', { width: 20, height: 18 }, scene);
  floor.material = mats.oak;
  receivers.push(floor);

  // Dark walls
  const backWall = MeshBuilder.CreateBox('back-wall', { width: 20, height: 9, depth: 0.4 }, scene);
  backWall.position.set(0, 4.5, -7);
  const darkMat = createPbrMaterial(scene, 'dark-wall', 'painted_wall', { tint: '#1a1a1a', metalScale: 0 });
  backWall.material = darkMat;
  casters.push(backWall);
  receivers.push(backWall);
  // Subtle wall accent — warm amber emissive strip along base (noir mood)
  const noirAccent = MeshBuilder.CreateBox('noir-wall-accent', { width: 18, height: 0.04, depth: 0.04 }, scene);
  noirAccent.position.set(0, 0.08, -6.8);
  const noirAccentMat = new PBRMaterial('noir-wall-accent-mat', scene);
  noirAccentMat.albedoColor = new Color3(0.02, 0.015, 0.005);
  noirAccentMat.metallic = 0;
  noirAccentMat.roughness = 0.3;
  noirAccentMat.emissiveColor = accent;
  noirAccentMat.emissiveIntensity = 0.6;
  noirAccent.material = noirAccentMat;
  practicals.push({ position: noirAccent.position.clone(), glow: noirAccentMat });

  // Venetian blinds window (slot)
  const blindsWindow = MeshBuilder.CreatePlane('blinds', { width: 5, height: 6 }, scene);
  blindsWindow.position.set(-5, 4.5, -6.7);
  blindsWindow.rotation.y = Math.PI;
  screenPlanes.push({ mesh: blindsWindow, slotId: 'window_blinds' });

  // Venetian blind slats (geometry creating shadow patterns)
  for (let y = 2; y <= 7.5; y += 0.35) {
    const slat = MeshBuilder.CreateBox('slat', { width: 5.2, height: 0.03, depth: 0.08 }, scene);
    slat.position.set(-5, y, -6.6);
    const slatMat = new PBRMaterial(`slat-${y}`, scene);
    slatMat.albedoColor = new Color3(0.15, 0.12, 0.08);
    slatMat.metallic = 0;
    slatMat.roughness = 0.8;
    slat.material = slatMat;
    casters.push(slat);
  }

  // Vintage desk
  const desk = MeshBuilder.CreateBox('desk', { width: 3, height: 0.82, depth: 1.4 }, scene);
  desk.position.set(-2, 0.41, 0);
  desk.material = mats.walnut;
  casters.push(desk);
  receivers.push(desk);

  // Desk lamp (brass with warm glow)
  const lampBase = MeshBuilder.CreateCylinder('lamp-base', { height: 0.08, diameter: 0.3 }, scene);
  lampBase.position.set(-3, 0.86, 0);
  lampBase.material = mats.brass;
  casters.push(lampBase);
  const lampArm = MeshBuilder.CreateCylinder('lamp-arm', { height: 0.6, diameter: 0.03 }, scene);
  lampArm.position.set(-3, 1.2, 0);
  lampArm.rotation.z = 0.2;
  lampArm.material = mats.brass;
  casters.push(lampArm);
  const lampShade = MeshBuilder.CreateCylinder('lamp-shade', { height: 0.25, diameterTop: 0.08, diameterBottom: 0.28, tessellation: 16 }, scene);
  lampShade.position.set(-2.9, 1.55, 0);
  lampShade.material = mats.brass;
  casters.push(lampShade);
  const lampGlow = MeshBuilder.CreateDisc('lamp-glow', { radius: 0.1 }, scene);
  lampGlow.position.set(-2.9, 1.4, 0);
  lampGlow.rotation.x = Math.PI / 2;
  const lampGlowMat = new PBRMaterial('lamp-glow-mat', scene);
  lampGlowMat.albedoColor = new Color3(0.06, 0.04, 0.02);
  lampGlowMat.metallic = 0;
  lampGlowMat.roughness = 0.1;
  lampGlowMat.emissiveColor = Color3.FromHexString('#ffcc66');
  lampGlowMat.emissiveIntensity = 4.5;
  lampGlow.material = lampGlowMat;
  practicals.push({ position: lampGlow.position.clone(), glow: lampGlowMat });

  // Vintage chair
  const chair = MeshBuilder.CreateBox('chair', { width: 0.85, height: 0.25, depth: 0.8 }, scene);
  chair.position.set(-2, 0.45, 1.5);
  chair.material = mats.leather;
  casters.push(chair);
  const chairBack = MeshBuilder.CreateBox('chair-back', { width: 0.85, height: 1.2, depth: 0.12 }, scene);
  chairBack.position.set(-2, 1.1, 1.95);
  chairBack.rotation.x = -0.15;
  chairBack.material = mats.leather;
  casters.push(chairBack);

  // Desk lamp screen
  const deskScreen = MeshBuilder.CreatePlane('desk-screen', { width: 2.5, height: 1.5 }, scene);
  deskScreen.position.set(3, 1.5, -6.7);
  deskScreen.rotation.y = Math.PI;
  screenPlanes.push({ mesh: deskScreen, slotId: 'desk_lamp_screen' });

  // Dramatic key light practical (single strong overhead)
  const keyLight = MeshBuilder.CreateCylinder('key-light', { height: 0.5, diameter: 0.45 }, scene);
  keyLight.position.set(-2, 8.5, 0);
  keyLight.material = mats.anodized;
  casters.push(keyLight);
  const keyLens = MeshBuilder.CreateDisc('key-lens', { radius: 0.2 }, scene);
  keyLens.position.set(-2, 8.25, 0);
  keyLens.rotation.x = Math.PI / 2;
  const keyLensMat = new PBRMaterial('key-lens-mat', scene);
  keyLensMat.albedoColor = new Color3(0.03, 0.03, 0.04);
  keyLensMat.metallic = 0;
  keyLensMat.roughness = 0.1;
  keyLensMat.emissiveColor = Color3.FromHexString('#fff0d4');
  keyLensMat.emissiveIntensity = 4.5;
  keyLens.material = keyLensMat;
  practicals.push({ position: keyLens.position.clone(), glow: keyLensMat });

  // Ceiling
  const ceiling = MeshBuilder.CreateBox('ceiling', { width: 20, height: 0.3, depth: 18 }, scene);
  ceiling.position.set(0, 9, -0.5);
  ceiling.material = mats.fabric;
  receivers.push(ceiling);

  return { casters, receivers, screenPlanes, practicals, talentPlane: null, talentReflection: null };
}

/** ── Rooftop Terrace — outdoor urban, string lights, skyline ── */
function buildRooftopTerrace(scene: Scene, mats: ReturnType<typeof createStudioMaterialSet>, accent: Color3): BuiltSet {
  const casters: Mesh[] = [];
  const receivers: Mesh[] = [];
  const screenPlanes: { mesh: Mesh; slotId: string }[] = [];
  const practicals: { position: Vector3; glow: PBRMaterial }[] = [];

  // Stone/concrete terrace floor
  const floor = MeshBuilder.CreateGround('floor', { width: 24, height: 20 }, scene);
  floor.material = mats.marble;
  receivers.push(floor);

  // Railing / parapet
  for (const side of [-1, 1]) {
    const wall = MeshBuilder.CreateBox('parapet', { width: 0.25, height: 1.2, depth: 20 }, scene);
    wall.position.set(side * 11, 0.6, 0);
    wall.material = mats.brushedMetal;
    casters.push(wall);
  }
  const backParapet = MeshBuilder.CreateBox('back-parapet', { width: 22, height: 1.2, depth: 0.25 }, scene);
  backParapet.position.set(0, 0.6, -9);
  backParapet.material = mats.brushedMetal;
  casters.push(backParapet);

  // Sky backdrop
  const skyPlane = MeshBuilder.CreatePlane('sky', { width: 22, height: 12 }, scene);
  skyPlane.position.set(0, 6, -10);
  skyPlane.rotation.y = Math.PI;
  screenPlanes.push({ mesh: skyPlane, slotId: 'sky' });

  // Outdoor TV
  const tv = MeshBuilder.CreatePlane('tv', { width: 4, height: 2.5 }, scene);
  tv.position.set(-6, 2.5, -8.5);
  tv.rotation.y = Math.PI;
  screenPlanes.push({ mesh: tv, slotId: 'outdoor_tv' });

  // Accent light panel
  const accentPanel = MeshBuilder.CreatePlane('accent-panel', { width: 2, height: 3 }, scene);
  accentPanel.position.set(6, 2.5, -8.5);
  accentPanel.rotation.y = Math.PI;
  screenPlanes.push({ mesh: accentPanel, slotId: 'accent_light' });

  // Patio furniture — modern table
  const table = MeshBuilder.CreateCylinder('table', { height: 0.06, diameter: 1.8, tessellation: 32 }, scene);
  table.position.set(0, 0.72, 2);
  table.material = mats.brushedMetal;
  casters.push(table);
  const tableLeg = MeshBuilder.CreateCylinder('table-leg', { height: 0.66, diameter: 0.12 }, scene);
  tableLeg.position.set(0, 0.33, 2);
  tableLeg.material = mats.brushedMetal;
  casters.push(tableLeg);

  // Chairs around table
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const chair = MeshBuilder.CreateBox('patio-chair', { width: 0.65, height: 0.08, depth: 0.6 }, scene);
    chair.position.set(Math.sin(angle) * 1.4, 0.45, 2 + Math.cos(angle) * 1.4);
    chair.rotation.y = angle;
    chair.material = mats.upholstery;
    casters.push(chair);
  }

  // Planters
  for (const side of [-1, 1]) {
    const pot = MeshBuilder.CreateCylinder('planter', { height: 0.7, diameterTop: 0.9, diameterBottom: 0.65 }, scene);
    pot.position.set(side * 8, 0.35, -6);
    pot.material = mats.marble;
    casters.push(pot);
    for (let i = 0; i < 5; i++) {
      const leaf = MeshBuilder.CreatePlane('leaf', { width: 0.5, height: 1.5 }, scene);
      leaf.position.set(side * 8 + (i - 2) * 0.15, 1.5 + Math.abs(i - 2) * 0.1, -6 + (i % 3) * 0.12);
      leaf.rotation.y = i * 0.7;
      leaf.rotation.x = -0.3;
      leaf.material = createPbrMaterial(scene, `rt-leaf-${side}-${i}`, 'black_fabric', {
        tint: '#2a5c3c', metalScale: 0, roughnessScale: 1.1, doubleSided: true,
      });
      casters.push(leaf);
    }
  }

  // String lights
  for (let x = -8; x <= 8; x += 2) {
    const bulb = MeshBuilder.CreateSphere('bulb', { diameter: 0.12, segments: 8 }, scene);
    bulb.position.set(x, 3.2, -4 + Math.sin(x * 0.4) * 0.3);
    const bulbMat = new PBRMaterial(`bulb-${x}`, scene);
    bulbMat.albedoColor = new Color3(0.06, 0.05, 0.03);
    bulbMat.metallic = 0;
    bulbMat.roughness = 0.1;
    bulbMat.emissiveColor = Color3.FromHexString('#ffe8b0');
    bulbMat.emissiveIntensity = 3.2;
    bulb.material = bulbMat;
    practicals.push({ position: bulb.position.clone(), glow: bulbMat });
  }

  // String wire
  const wirePoints: Vector3[] = [];
  for (let x = -8; x <= 8; x += 0.5) {
    wirePoints.push(new Vector3(x, 3.15, -4 + Math.sin(x * 0.4) * 0.3));
  }

  // Accent LED wash along the back parapet — carries the set accent colour.
  const accentStrip = MeshBuilder.CreateBox('accent-strip', { width: 21.6, height: 0.08, depth: 0.08 }, scene);
  accentStrip.position.set(0, 1.24, -8.86);
  const accentStripMat = new PBRMaterial('rt-accent-strip', scene);
  accentStripMat.albedoColor = new Color3(0.02, 0.02, 0.02);
  accentStripMat.metallic = 0;
  accentStripMat.roughness = 0.4;
  accentStripMat.emissiveColor = accent;
  accentStripMat.emissiveIntensity = 3.4;
  accentStrip.material = accentStripMat;
  practicals.push({ position: accentStrip.position.clone(), glow: accentStripMat });

  // Ceiling (open sky)
  const ceiling = MeshBuilder.CreateBox('ceiling', { width: 24, height: 0.15, depth: 20 }, scene);
  ceiling.position.set(0, 5, -0.5);
  ceiling.material = mats.fabric;
  receivers.push(ceiling);

  return { casters, receivers, screenPlanes, practicals, talentPlane: null, talentReflection: null };
}

/** ── Library Study — bookshelves, leather chairs, oak desk, brass ── */
function buildLibraryStudy(scene: Scene, mats: ReturnType<typeof createStudioMaterialSet>, accent: Color3): BuiltSet {
  const casters: Mesh[] = [];
  const receivers: Mesh[] = [];
  const screenPlanes: { mesh: Mesh; slotId: string }[] = [];
  const practicals: { position: Vector3; glow: PBRMaterial }[] = [];

  // Wood floor
  const floor = MeshBuilder.CreateGround('floor', { width: 22, height: 18 }, scene);
  floor.material = mats.oak;
  receivers.push(floor);

  // Back wall with bookshelves
  const backWall = MeshBuilder.CreateBox('back-wall', { width: 22, height: 10, depth: 0.4 }, scene);
  backWall.position.set(0, 5, -7);
  backWall.material = mats.wall;
  casters.push(backWall);
  receivers.push(backWall);

  // Bookshelves (3 tall units)
  for (const x of [-6, 0, 6]) {
    const shelf = MeshBuilder.CreateBox('shelf', { width: 3.6, height: 8.5, depth: 0.5 }, scene);
    shelf.position.set(x, 4.25, -6.6);
    shelf.material = mats.walnut;
    casters.push(shelf);
    receivers.push(shelf);
    // Shelf dividers (books)
    for (let row = 0; row < 6; row++) {
      const bookRow = MeshBuilder.CreateBox('books', { width: 3.2, height: 0.8, depth: 0.4 }, scene);
      bookRow.position.set(x, 1.2 + row * 1.2, -6.5);
      const bookColor = ['#8b0000', '#00008b', '#006400', '#8b4513', '#4a0e4e', '#2f4f4f'][row];
      const bookMat = createPbrMaterial(scene, `books-${x}-${row}`, 'black_fabric', {
        tint: bookColor, metalScale: 0, roughnessScale: 1.1,
      });
      bookRow.material = bookMat;
      casters.push(bookRow);
    }
  }

  // Presentation screen
  const screen = MeshBuilder.CreatePlane('screen', { width: 6, height: 3.5 }, scene);
  screen.position.set(0, 5.5, -6.7);
  screen.rotation.y = Math.PI;
  screenPlanes.push({ mesh: screen, slotId: 'presentation_screen' });

  // Oak reading desk
  const desk = MeshBuilder.CreateBox('desk', { width: 2.8, height: 0.82, depth: 1.5 }, scene);
  desk.position.set(0, 0.41, 2);
  desk.material = mats.walnut;
  casters.push(desk);
  receivers.push(desk);
  // Desk accent glow strip — amber emissive under the oak top
  const libDeskAccent = MeshBuilder.CreateBox('desk-accent', { width: 2.4, height: 0.025, depth: 0.06 }, scene);
  libDeskAccent.position.set(0, 0.85, 2.68);
  const libDeskAccentMat = new PBRMaterial('lib-desk-accent-mat', scene);
  libDeskAccentMat.albedoColor = new Color3(0.02, 0.015, 0.01);
  libDeskAccentMat.metallic = 0;
  libDeskAccentMat.roughness = 0.2;
  libDeskAccentMat.emissiveColor = accent;
  libDeskAccentMat.emissiveIntensity = 1.2;
  libDeskAccent.material = libDeskAccentMat;
  practicals.push({ position: libDeskAccent.position.clone(), glow: libDeskAccentMat });
  // Brass desk lamp
  const lampBase = MeshBuilder.CreateCylinder('lamp-base', { height: 0.06, diameter: 0.22 }, scene);
  lampBase.position.set(1.1, 0.88, 2);
  lampBase.material = mats.brass;
  casters.push(lampBase);
  const lampArm = MeshBuilder.CreateCylinder('lamp-arm', { height: 0.45, diameter: 0.025 }, scene);
  lampArm.position.set(1.1, 1.15, 2);
  lampArm.material = mats.brass;
  casters.push(lampArm);
  const lampShade = MeshBuilder.CreateCylinder('lamp-shade', { height: 0.18, diameterTop: 0.06, diameterBottom: 0.2, tessellation: 16 }, scene);
  lampShade.position.set(1.1, 1.4, 2);
  lampShade.material = mats.brass;
  casters.push(lampShade);
  const lampGlow = MeshBuilder.CreateDisc('lamp-glow', { radius: 0.08 }, scene);
  lampGlow.position.set(1.1, 1.3, 2);
  lampGlow.rotation.x = Math.PI / 2;
  const lampGlowMat = new PBRMaterial('desk-lamp-glow', scene);
  lampGlowMat.albedoColor = new Color3(0.05, 0.04, 0.03);
  lampGlowMat.metallic = 0;
  lampGlowMat.roughness = 0.1;
  lampGlowMat.emissiveColor = Color3.FromHexString('#ffe0a0');
  lampGlowMat.emissiveIntensity = 3.8;
  lampGlow.material = lampGlowMat;
  practicals.push({ position: lampGlow.position.clone(), glow: lampGlowMat });

  // Desk screen
  const deskScreen = MeshBuilder.CreatePlane('desk-screen', { width: 1.5, height: 0.9 }, scene);
  deskScreen.position.set(-0.8, 1.35, 2);
  deskScreen.rotation.x = -0.2;
  screenPlanes.push({ mesh: deskScreen, slotId: 'desk_lamp_screen' });

  // Leather armchairs
  for (const side of [-1, 1]) {
    const chair = MeshBuilder.CreateBox('armchair', { width: 1.1, height: 0.4, depth: 1.0 }, scene);
    chair.position.set(side * 4, 0.5, 3.5);
    chair.material = mats.leather;
    casters.push(chair);
    const chairBack = MeshBuilder.CreateBox('armchair-back', { width: 1.1, height: 1.1, depth: 0.15 }, scene);
    chairBack.position.set(side * 4, 1.1, 3.05);
    chairBack.rotation.x = -0.12;
    chairBack.material = mats.leather;
    casters.push(chairBack);
    // Armrests
    for (const dx of [-0.5, 0.5]) {
      const arm = MeshBuilder.CreateBox('armrest', { width: 0.12, height: 0.12, depth: 0.7 }, scene);
      arm.position.set(side * 4 + dx, 0.78, 3.4);
      arm.material = mats.walnut;
      casters.push(arm);
    }
  }

  // Pendant lamps
  for (const x of [-4, 4]) {
    const pendant = MeshBuilder.CreateCylinder('pendant', { height: 0.4, diameterTop: 0.15, diameterBottom: 0.5 }, scene);
    pendant.position.set(x, 8.5, 2);
    pendant.material = mats.brass;
    casters.push(pendant);
    const lens = MeshBuilder.CreateDisc('lens', { radius: 0.16 }, scene);
    lens.position.set(x, 8.3, 2);
    lens.rotation.x = Math.PI / 2;
    const lensMat = new PBRMaterial(`pendant-lens-${x}`, scene);
    lensMat.albedoColor = new Color3(0.05, 0.04, 0.03);
    lensMat.metallic = 0;
    lensMat.roughness = 0.1;
    lensMat.emissiveColor = Color3.FromHexString('#ffe0a0');
    lensMat.emissiveIntensity = 3.5;
    lens.material = lensMat;
    practicals.push({ position: lens.position.clone(), glow: lensMat });
  }

  // Ceiling
  const ceiling = MeshBuilder.CreateBox('ceiling', { width: 22, height: 0.3, depth: 18 }, scene);
  ceiling.position.set(0, 9.5, -0.5);
  ceiling.material = mats.fabric;
  receivers.push(ceiling);

  return { casters, receivers, screenPlanes, practicals, talentPlane: null, talentReflection: null };
}

/* ================================================================
   SCENE DISPATCHER — routes sceneId to the correct geometry builder
   ================================================================ */

function buildStudioSet(
  scene: Scene,
  sceneId: string,
  accentHex: string,
  talent: BabylonTalentPlate | undefined,
): BuiltSet {
  const mats = createStudioMaterialSet(scene);
  const accent = accentColor(accentHex);
  let built: BuiltSet;

  switch (sceneId) {
    case 'news_premium':
      built = buildNewsPremium(scene, mats, accent);
      break;
    case 'church_sanctuary':
      built = buildChurchSanctuary(scene, mats, accent);
      break;
    case 'music_ministry':
      built = buildMusicMinistry(scene, mats, accent);
      break;
    case 'luxury_ballroom':
      built = buildLuxuryBallroom(scene, mats, accent);
      break;
    case 'concert_hall':
      built = buildConcertHall(scene, mats, accent);
      break;
    case 'podcast_studio':
      built = buildPodcastStudio(scene, mats, accent);
      break;
    case 'fitness_studio':
      built = buildFitnessStudio(scene, mats, accent);
      break;
    case 'real_estate':
      built = buildRealEstate(scene, mats, accent);
      break;
    case 'auction_house':
      built = buildAuctionHouse(scene, mats, accent);
      break;
    case 'film_noir':
      built = buildFilmNoir(scene, mats, accent);
      break;
    case 'rooftop_terrace':
      built = buildRooftopTerrace(scene, mats, accent);
      break;
    case 'library_study':
      built = buildLibraryStudy(scene, mats, accent);
      break;
    default:
      built = buildNewsStudio(scene, mats, accent);
      break;
  }

  /* ── Talent plate + optional floor reflection (shared across all scenes) ── */
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

  built.talentPlane = talentPlane;
  built.talentReflection = talentReflection;
  return built;
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
      const sceneConfig = getScenePhotorealConfig(sceneId);
      const hdr = new HDRCubeTexture(environment.file, scene, 256, false, true, false, true);
      scene.environmentTexture = hdr;
      scene.environmentIntensity = environment.intensity * settings.environmentIntensity * sceneConfig.envIntensity;

      const built = buildStudioSet(scene, sceneId, accent, talent);

      /* Camera. */
      const camTarget = new Vector3(...sceneConfig.target);
      const cam = new ArcRotateCamera(
        'stage-camera',
        Math.PI / 2,
        Math.PI / 2 - 0.12,
        BASE_RADIUS,
        camTarget,
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
        scene.fogDensity = volumetrics.hazeDensity * 0.85 * (sceneConfig.fogMultiplier ?? 1);
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
        const talentOff = talent?.enabled === false;
        built.talentPlane.isVisible = !talentOff;
        if (talentOff && built.talentReflection) built.talentReflection.isVisible = false;
        const keyerOn = talentOff ? false : talent?.keyerEnabled !== false;
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
          const practicalColor = sceneConfig.practicalTint
            ? Color3.FromHexString(sceneConfig.practicalTint)
            : Color3.FromHexString('#fff2dd');
          light.diffuse = practicalColor;
          light.specular = practicalColor;
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
          beamMat.emissiveColor = sceneConfig.beamTint
            ? Color3.FromHexString(sceneConfig.beamTint)
            : Color3.FromHexString('#fff2dd');
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
      pipeline.bloomWeight = sceneConfig.bloomWeight ?? settings.bloomIntensity;
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
      ipc.exposure = settings.exposure * exposure + (sceneConfig.exposureBias ?? 0);
      ipc.contrast = sceneConfig.contrast ?? settings.contrast;
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
    const tuningConfig = getScenePhotorealConfig(sceneId);
    const ipc = runtime.scene.imageProcessingConfiguration;
    ipc.toneMappingEnabled = settings.imageProcessing;
    ipc.toneMappingType = toneMapConstant(settings.toneMapping);
    ipc.exposure = settings.exposure * exposure + (tuningConfig.exposureBias ?? 0);
    ipc.contrast = tuningConfig.contrast ?? settings.contrast;
    ipc.vignetteEnabled = settings.vignette && settings.imageProcessing;
    runtime.pipeline.bloomEnabled = settings.bloom;
    runtime.pipeline.bloomWeight = tuningConfig.bloomWeight ?? settings.bloomIntensity;
    runtime.pipeline.depthOfFieldEnabled = settings.depthOfField;
    runtime.pipeline.grainEnabled = settings.grain;
    runtime.pipeline.fxaaEnabled = settings.antiAliasing === 'fxaa';
    runtime.scene.environmentIntensity =
      environment.intensity * settings.environmentIntensity * tuningConfig.envIntensity * lighting;
    // Dynamic fixtures track the master light level live.
    runtime.setDynamicLightLevel(lighting);
  }, [settings, exposure, lighting, environment.intensity, sceneId]);

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
