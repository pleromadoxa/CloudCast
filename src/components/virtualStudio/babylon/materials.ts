/**
 * Prism Babylon — physically based material library.
 *
 * Thin, typed factories over `PBRMaterial` so the stage builder can say
 * "brushed aluminium with a clear coat" instead of hand-tuning forty fields.
 * The goal is a surface that reads as the real thing: metal that tints its own
 * reflections and smears its highlight along the grain, lacquer that carries a
 * distinct coat lobe, fabric with a sheen rim, leather with polished high
 * points over a matte base.
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';
import { getPbrMaps, type ProceduralPbrKind } from './textures';

export interface PbrOptions {
  /** Multiplies the metallic channel (1 = as authored). */
  metalScale?: number;
  /** Multiplies the roughness channel (1 = as authored). */
  roughnessScale?: number;
  /** Tints the base colour / metal F0. */
  tint?: string;
  /** Clear coat over the base layer (lacquer, car paint, glazed ceramic). */
  clearCoat?: { intensity?: number; roughness?: number };
  /** Fabric sheen rim. */
  sheen?: { intensity?: number; color?: string; roughness?: number };
  /** Anisotropic response — brushed metal, silk. */
  anisotropy?: number;
  /** Environment (IBL) intensity multiplier. */
  environmentIntensity?: number;
  /** Direct light intensity multiplier. */
  directIntensity?: number;
  /** Emissive tint + level for screens and practicals. */
  emissive?: { color: string; intensity: number };
  /** Transparent materials (glass, haze). */
  transparency?: { alpha: number; indexOfRefraction?: number; roughness?: number };
  /** Back-face culling off for panels seen from behind. */
  doubleSided?: boolean;
  /** Extra normal-map bite. */
  normalScale?: number;
  /** Repeat the texture set (UV tiling). */
  uvScale?: number;
}

function parseColor(hex: string): Color3 {
  return Color3.FromHexString(hex.startsWith('#') ? hex : `#${hex}`);
}

/** Build a PBR material from the procedural bank. */
export function createPbrMaterial(
  scene: Scene,
  name: string,
  kind: ProceduralPbrKind,
  options: PbrOptions = {},
): PBRMaterial {
  const maps = getPbrMaps(scene, kind);
  const material = new PBRMaterial(name, scene);

  material.albedoTexture = maps.albedo;
  material.metallicTexture = maps.orm;
  material.bumpTexture = maps.normal;
  // glTF channel layout: G = roughness, B = metallic.
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = true;
  material.useRoughnessFromMetallicTextureAlpha = false;

  material.metallic = options.metalScale ?? 1;
  material.roughness = options.roughnessScale ?? 1;

  if (options.tint) material.albedoColor = parseColor(options.tint);

  if (options.normalScale !== undefined && material.bumpTexture) {
    material.bumpTexture.level = options.normalScale;
  }

  if (options.uvScale && options.uvScale !== 1) {
    // `uScale`/`vScale` live on `Texture`, and every map this factory assigns
    // is a `DynamicTexture`, so the narrowing is safe by construction.
    const tiles: (Texture | null)[] = [
      material.albedoTexture as Texture | null,
      material.metallicTexture as Texture | null,
      material.bumpTexture as Texture | null,
    ];
    for (const texture of tiles) {
      if (texture) {
        texture.uScale = options.uvScale;
        texture.vScale = options.uvScale;
      }
    }
  }


  if (options.clearCoat) {
    material.clearCoat.isEnabled = true;
    material.clearCoat.intensity = options.clearCoat.intensity ?? 1;
    material.clearCoat.roughness = options.clearCoat.roughness ?? 0.06;
    material.clearCoat.indexOfRefraction = 1.55;
  }

  if (options.sheen) {
    material.sheen.isEnabled = true;
    material.sheen.intensity = options.sheen.intensity ?? 0.7;
    material.sheen.roughness = options.sheen.roughness ?? 0.35;
    if (options.sheen.color) material.sheen.color = parseColor(options.sheen.color);
  }

  if (options.anisotropy !== undefined) {
    material.anisotropy.isEnabled = true;
    material.anisotropy.intensity = options.anisotropy;
  }

  if (options.emissive) {
    material.emissiveColor = parseColor(options.emissive.color);
    material.emissiveIntensity = options.emissive.intensity;
  }

  if (options.transparency) {
    material.alpha = options.transparency.alpha;
    material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
    material.indexOfRefraction = options.transparency.indexOfRefraction ?? 1.52;
    if (options.transparency.roughness !== undefined) {
      material.roughness = options.transparency.roughness;
    }
    material.backFaceCulling = false;
  }

  if (options.doubleSided) material.backFaceCulling = false;

  material.environmentIntensity = options.environmentIntensity ?? 1;
  material.directIntensity = options.directIntensity ?? 1;
  // A physically-plausible F90: dielectrics saturate to white at grazing,
  // metals keep their tint. Keeps edge highlights from going chalky.
  material.useRadianceOverAlpha = true;
  material.useSpecularOverAlpha = true;
  material.usePhysicalLightFalloff = true;

  return material;
}

/* -------------------------------------------------- curated material set --- */

export interface StudioMaterialSet {
  /** Structural metal — desk frames, truss, legs. */
  brushedMetal: PBRMaterial;
  /** Mirror accents — trim, rails, logos. */
  chrome: PBRMaterial;
  /** Satin black — monitor bezels, camera bodies. */
  anodized: PBRMaterial;
  /** Warm accent metal — lamps, trim on premium sets. */
  brass: PBRMaterial;
  /** Lacquered desk tops. */
  walnut: PBRMaterial;
  oak: PBRMaterial;
  /** Seating. */
  upholstery: PBRMaterial;
  leather: PBRMaterial;
  /** Architecture. */
  marble: PBRMaterial;
  carpet: PBRMaterial;
  wall: PBRMaterial;
  /** Curtains, acoustic panels. */
  fabric: PBRMaterial;
  /** Dead screens / bezels. */
  screenPanel: PBRMaterial;
  dispose(): void;
}

export function createStudioMaterialSet(
  scene: Scene,
  opts: { environmentIntensity?: number } = {},
): StudioMaterialSet {
  const env = opts.environmentIntensity ?? 1;
  const set: StudioMaterialSet = {
    brushedMetal: createPbrMaterial(scene, 'brushed-metal', 'brushed_aluminium', {
      metalScale: 1,
      roughnessScale: 0.92,
      anisotropy: 0.55,
      environmentIntensity: env,
    }),
    chrome: createPbrMaterial(scene, 'chrome', 'polished_chrome', {
      metalScale: 1,
      roughnessScale: 0.85,
      clearCoat: { intensity: 0.25, roughness: 0.02 },
      environmentIntensity: env * 1.15,
    }),
    anodized: createPbrMaterial(scene, 'anodized', 'black_anodized', {
      metalScale: 1,
      roughnessScale: 1,
      environmentIntensity: env,
    }),
    brass: createPbrMaterial(scene, 'brass', 'brass', {
      metalScale: 1,
      roughnessScale: 0.9,
      anisotropy: 0.35,
      environmentIntensity: env,
    }),
    walnut: createPbrMaterial(scene, 'walnut', 'lacquered_walnut', {
      metalScale: 0,
      clearCoat: { intensity: 1, roughness: 0.075 },
      environmentIntensity: env,
    }),
    oak: createPbrMaterial(scene, 'oak', 'lacquered_oak', {
      metalScale: 0,
      clearCoat: { intensity: 0.9, roughness: 0.11 },
      environmentIntensity: env,
    }),
    upholstery: createPbrMaterial(scene, 'upholstery', 'upholstery', {
      metalScale: 0,
      roughnessScale: 1,
      sheen: { intensity: 0.65, color: '#8fa3c8', roughness: 0.42 },
      environmentIntensity: env,
    }),
    leather: createPbrMaterial(scene, 'leather', 'leather', {
      metalScale: 0,
      clearCoat: { intensity: 0.32, roughness: 0.32 },
      environmentIntensity: env,
    }),
    marble: createPbrMaterial(scene, 'marble', 'marble', {
      metalScale: 0,
      clearCoat: { intensity: 0.55, roughness: 0.05 },
      environmentIntensity: env * 1.05,
    }),
    carpet: createPbrMaterial(scene, 'carpet', 'carpet', {
      metalScale: 0,
      environmentIntensity: env * 0.85,
    }),
    wall: createPbrMaterial(scene, 'wall', 'painted_wall', {
      metalScale: 0,
      environmentIntensity: env * 0.9,
    }),
    fabric: createPbrMaterial(scene, 'fabric', 'black_fabric', {
      metalScale: 0,
      sheen: { intensity: 0.35, color: '#7c8aa8', roughness: 0.6 },
      environmentIntensity: env * 0.8,
    }),
    screenPanel: createPbrMaterial(scene, 'screen-panel', 'screen_dead', {
      metalScale: 0,
      clearCoat: { intensity: 0.65, roughness: 0.045 },
      environmentIntensity: env * 1.1,
    }),
    dispose() {
      for (const material of [
        set.brushedMetal,
        set.chrome,
        set.anodized,
        set.brass,
        set.walnut,
        set.oak,
        set.upholstery,
        set.leather,
        set.marble,
        set.carpet,
        set.wall,
        set.fabric,
        set.screenPanel,
      ]) {
        material.dispose(false, true);
      }
    },
  };
  return set;
}
