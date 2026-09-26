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
import { SpotLight } from '@babylonjs/core/Lights/spotLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
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
import { createPbrMaterial, createStudioMaterialSet } from './materials';
import { makeEmissiveTexture } from './textures';
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

  return { casters, receivers, screenPlanes, talentPlane, talentReflection };
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

/* ------------------------------------------------------------ the stage --- */

interface StageRuntime {
  engine: AbstractEngine;
  scene: Scene;
  camera: ArcRotateCamera;
  pipeline: DefaultRenderingPipeline;
  talentTexture: DynamicTexture | null;
  keyedCanvas: HTMLCanvasElement | null;
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

      /* Lighting rig: the environment does the fill, lights do the direction. */
      const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
      hemi.intensity = 0.28 * lighting;
      hemi.diffuse = mixColor('#cfe4ff', '#ffe6c2', temperature);
      hemi.groundColor = new Color3(0.08, 0.09, 0.11);

      const key = new DirectionalLight('key', new Vector3(-0.52, -0.72, -0.46), scene);
      key.position = new Vector3(6.2, 9.4, 6.6);
      key.intensity = 2.35 * lighting;
      key.diffuse = mixColor('#e8f2ff', '#ffe2b8', temperature);
      key.specular = mixColor('#ffffff', '#ffe9c8', temperature);

      const fill = new DirectionalLight('fill', new Vector3(0.62, -0.5, -0.3), scene);
      fill.position = new Vector3(-7.4, 6.2, 5.2);
      fill.intensity = 0.72 * lighting;
      fill.diffuse = mixColor('#c3d9ff', '#ffd9ae', temperature);

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

      /* Feed the keyed canvas into its texture every frame. */
      scene.onBeforeRenderObservable.add(() => {
        if (talentTexture && keyedCanvas) {
          const ctx = talentTexture.getContext() as CanvasRenderingContext2D;
          ctx.clearRect(0, 0, 1280, 720);
          ctx.drawImage(keyedCanvas, 0, 0, 1280, 720);
          talentTexture.update(true);
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

      runtimeRef.current = { engine, scene, camera: cam, pipeline, talentTexture, keyedCanvas };

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
