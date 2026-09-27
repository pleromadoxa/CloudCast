/**
 * Prism Babylon — physically based material library.
 *
 * Thin, typed factories over `PBRMaterial` so the stage builder can say
 * "brushed aluminium with a clear coat" instead of hand-tuning forty fields.
 * The goal is a surface that reads as the real thing: metal that tints its own
 * reflections and smears its highlight along the grain, lacquer that carries a
 * distinct coat lobe, fabric with a sheen rim, leather with polished high
 * points over a matte base — plus the rest of the shared fidelity standard:
 * real refraction through glass (sub-surface IOR + Beer–Lambert absorption) and
 * height-field displacement (parallax occlusion on screen, real vertex relief
 * on budgeted geometry via `displaceMeshFromHeight`).
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { getPbrMaps, type ProceduralPbrKind, type ProceduralPbrMaps } from './textures';
import {
  anisotropyFor,
  displacementFor,
  refractionFor,
  type FidelityTier,
} from '../../../lib/virtualStudio/fidelity';

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
  /**
   * Anisotropic response — brushed metal, silk, carpet pile. Either a strength
   * (0–1) or a full spec with the grain rotation in radians. The grain field is
   * attached automatically from the surface's derived direction map.
   */
  anisotropy?: number | { intensity: number; rotation?: number };
  /** Environment (IBL) intensity multiplier. */
  environmentIntensity?: number;
  /** Direct light intensity multiplier. */
  directIntensity?: number;
  /** Emissive tint + level for screens and practicals. */
  emissive?: { color: string; intensity: number };
  /** Transparent materials (glass, haze). */
  transparency?: { alpha: number; indexOfRefraction?: number; roughness?: number };
  /**
   * Real refraction through the surface — the scene genuinely bends through
   * the medium (sub-surface IOR + intensity + Beer–Lambert tint). Implies
   * transparency; use instead of `transparency` for glass and liquids.
   */
  refraction?: { ior?: number; tint?: string; intensity?: number; absorptionDistance?: number };
  /**
   * Height-field relief: `parallax` walks the surface per-pixel (cheap, always
   * available); `scale`/`bias` are the world-space relief used by
   * `displaceMeshFromHeight` on subdivided geometry.
   */
  displacement?: { scale?: number; bias?: number; parallax?: number };
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
    const spec = typeof options.anisotropy === 'number' ? { intensity: options.anisotropy } : options.anisotropy;
    material.anisotropy.isEnabled = true;
    material.anisotropy.intensity = spec.intensity;
    if (spec.rotation !== undefined) material.anisotropy.angle = spec.rotation;
    // Direction field derived from the surface's own grain (RG direction,
    // B strength) — the same physics the three.js stage reads.
    material.anisotropy.texture = maps.anisotropy;
  }

  if (options.emissive) {
    material.emissiveColor = parseColor(options.emissive.color);
    material.emissiveIntensity = options.emissive.intensity;
  }

  if (options.refraction) {
    // Real refraction: the scene bends through the medium instead of the
    // surface faking it with alpha. Beer–Lambert tint rides along.
    material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
    material.alpha = 1;
    material.backFaceCulling = false;
    material.subSurface.isRefractionEnabled = true;
    material.subSurface.linkRefractionWithTransparency = true;
    material.subSurface.indexOfRefraction = options.refraction.ior ?? 1.52;
    material.subSurface.refractionIntensity = options.refraction.intensity ?? 1;
    if (options.refraction.tint) {
      material.subSurface.tintColor = parseColor(options.refraction.tint);
      material.subSurface.tintColorAtDistance = options.refraction.absorptionDistance ?? 0.4;
    }
    // Fresnel-weighted reflectivity like real float glass.
    material.reflectivityColor = new Color3(0.04, 0.04, 0.04);
  }

  if (options.displacement) {
    // Parallax occlusion walks the height field per-pixel — detailed relief
    // without extra vertices. Real vertex relief is applied separately through
    // `displaceMeshFromHeight` on budgeted geometry.
    if (options.displacement.parallax !== undefined && options.displacement.parallax > 0) {
      material._useParallax = true;
      material._useParallaxOcclusion = true;
      material._parallaxScaleBias = options.displacement.parallax;
    }
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

/**
 * Real refractive glass — the scene genuinely bends through the surface
 * (sub-surface IOR) with Beer–Lambert absorption tint. Babylon's counterpart
 * to the three.js `refractiveGlassMaterial`. Tiers without a refraction budget
 * fall back to plain alpha glass so the scene never re-renders twice for it.
 */
export function createGlassMaterial(
  scene: Scene,
  name: string,
  opts: {
    tint?: string;
    ior?: number;
    absorptionDistance?: number;
    roughness?: number;
    fidelity?: FidelityTier;
  } = {},
): PBRMaterial {
  const refraction = refractionFor(opts.fidelity ?? 'high');
  if (!refraction) {
    return createPbrMaterial(scene, name, 'glass_frost', {
      metalScale: 0,
      transparency: { alpha: 0.16, indexOfRefraction: opts.ior ?? 1.52 },
      doubleSided: true,
    });
  }
  return createPbrMaterial(scene, name, 'glass_frost', {
    metalScale: 0,
    roughnessScale: (opts.roughness ?? refraction.roughness) * 4,
    tint: opts.tint ?? refraction.attenuationColor,
    refraction: {
      ior: opts.ior ?? refraction.ior,
      tint: opts.tint ?? refraction.attenuationColor,
      intensity: refraction.transmission,
      absorptionDistance: opts.absorptionDistance ?? refraction.attenuationDistance,
    },
    doubleSided: true,
  });
}

/**
 * Real vertex displacement — pushes each vertex along its normal by the
 * surface height field, so silhouettes carry relief (the Babylon counterpart
 * of three's `displacementMap`). Use on subdivided floors/panels; the caller
 * owns the geometry and any re-normalling.
 */
export function displaceMeshFromHeight(
  mesh: Mesh,
  maps: ProceduralPbrMaps,
  scale: number,
  bias = 0,
): void {
  const ctx = maps.height.getContext() as CanvasRenderingContext2D;
  const size = maps.height.getSize();
  const pixels = ctx.getImageData(0, 0, size.width, size.height).data;
  const positions = mesh.getVerticesData('position');
  const normals = mesh.getVerticesData('normal');
  const uvs = mesh.getVerticesData('uv');
  if (!positions || !normals || !uvs) return;

  for (let v = 0; v < uvs.length / 2; v += 1) {
    const u = uvs[v * 2] - Math.floor(uvs[v * 2]);
    const w = uvs[v * 2 + 1] - Math.floor(uvs[v * 2 + 1]);
    const x = Math.min(size.width - 1, Math.max(0, Math.round(u * (size.width - 1))));
    const y = Math.min(size.height - 1, Math.max(0, Math.round((1 - w) * (size.height - 1))));
    const height = pixels[(y * size.width + x) * 4] / 255;
    const offset = height * scale + bias;
    positions[v * 3] += normals[v * 3] * offset;
    positions[v * 3 + 1] += normals[v * 3 + 1] * offset;
    positions[v * 3 + 2] += normals[v * 3 + 2] * offset;
  }
  mesh.updateVerticesData('position', positions, false, false);
  mesh.createNormals(true);
}

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
  opts: { environmentIntensity?: number; fidelity?: FidelityTier } = {},
): StudioMaterialSet {
  const env = opts.environmentIntensity ?? 1;
  const tier = opts.fidelity ?? 'high';
  // The shared fidelity standard grades the physical lobes: metals smear along
  // their grain, carpet pile sheens directionally, wood/textile/plaster carry
  // height relief — identical physics to the three.js stage.
  const metalGrain = anisotropyFor(tier, 'metal');
  const pileGrain = anisotropyFor(tier, 'textile');
  const woodGrain = anisotropyFor(tier, 'wood');
  const woodRelief = displacementFor(tier, 'wood');
  const textileRelief = displacementFor(tier, 'textile');
  const plasterRelief = displacementFor(tier, 'plaster');
  const grain = (spec: { intensity: number; rotation: number } | null) =>
    spec ? { intensity: spec.intensity, rotation: spec.rotation } : undefined;
  const relief = (spec: { scale: number; bias: number; parallax: number } | null) =>
    spec ? { scale: spec.scale, bias: spec.bias, parallax: spec.parallax } : undefined;

  const set: StudioMaterialSet = {
    brushedMetal: createPbrMaterial(scene, 'brushed-metal', 'brushed_aluminium', {
      metalScale: 1,
      roughnessScale: 0.92,
      anisotropy: grain(metalGrain),
      environmentIntensity: env,
    }),
    chrome: createPbrMaterial(scene, 'chrome', 'polished_chrome', {
      metalScale: 1,
      roughnessScale: 0.85,
      clearCoat: { intensity: 0.25, roughness: 0.02 },
      anisotropy: grain(metalGrain),
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
      anisotropy: grain(metalGrain),
      environmentIntensity: env,
    }),
    walnut: createPbrMaterial(scene, 'walnut', 'lacquered_walnut', {
      metalScale: 0,
      clearCoat: { intensity: 1, roughness: 0.075 },
      anisotropy: grain(woodGrain),
      displacement: relief(woodRelief),
      environmentIntensity: env,
    }),
    oak: createPbrMaterial(scene, 'oak', 'lacquered_oak', {
      metalScale: 0,
      clearCoat: { intensity: 0.9, roughness: 0.11 },
      anisotropy: grain(woodGrain),
      displacement: relief(woodRelief),
      environmentIntensity: env,
    }),
    upholstery: createPbrMaterial(scene, 'upholstery', 'upholstery', {
      metalScale: 0,
      roughnessScale: 1,
      sheen: { intensity: 0.65, color: '#8fa3c8', roughness: 0.42 },
      anisotropy: grain(pileGrain),
      displacement: relief(textileRelief),
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
      // Wool-fibre BRDF — matches `CARPET_GRADE` on the three.js side: the
      // sheen lobe is what makes grazing light catch the fibre tips.
      sheen: { intensity: 1, color: '#cfc4b6', roughness: 0.48 },
      anisotropy: grain(pileGrain),
      displacement: relief(textileRelief),
      environmentIntensity: env * 0.85,
    }),
    wall: createPbrMaterial(scene, 'wall', 'painted_wall', {
      metalScale: 0,
      displacement: relief(plasterRelief),
      environmentIntensity: env * 0.9,
    }),
    fabric: createPbrMaterial(scene, 'fabric', 'black_fabric', {
      metalScale: 0,
      sheen: { intensity: 0.35, color: '#7c8aa8', roughness: 0.6 },
      anisotropy: grain(pileGrain),
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
