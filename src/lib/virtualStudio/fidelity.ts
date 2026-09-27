/**
 * CloudCast Virtual Studio — the shared high-fidelity rendering standard.
 *
 * Prism runs the same virtual sets across three renderers (three.js/R3F,
 * Babylon.js and Unreal Engine over Pixel Streaming) and every one of them has
 * to hit the same look. This module is the single, engine-agnostic definition of
 * that look: the physical material behaviour, the lighting model and the
 * performance budget, expressed as plain numbers so each adapter translates the
 * same intent into its own API — three's `MeshPhysicalMaterial`, Babylon's
 * `PBRMaterial` blocks, Unreal's scalability CVars.
 *
 * The four pillars of the standard:
 *
 *  1. **PBR materials** — real refraction for glass (transmission + IOR +
 *     chromatic dispersion + absorption), anisotropic highlights for brushed
 *     metals and carpet pile, and displacement/parallax relief so silhouettes
 *     and grazing light carry real surface height.
 *  2. **Global illumination** — HDR image-based lighting plus physically based
 *     bounce, with every emissive fixture (lamps, LED screens, light boxes)
 *     contributing real dynamic light to the scene.
 *  3. **Volumetric lighting** — atmospheric haze that the light rig actually
 *     interacts with: visible shafts from key/practicals, animated at broadcast
 *     quality.
 *  4. **Performance** — tiered budgets for texture memory, shadow casters,
 *     dynamic lights and displacement density so every set holds frame rate.
 *
 * Pure data + pure functions only — no renderer imports — so the mapping is
 * unit-testable without a GPU and shareable by every stage engine.
 */

/** Fidelity ladder. Matches the virtual-studio quality tiers 1:1. */
export type FidelityTier = 'low' | 'balanced' | 'high' | 'ultra';

/**
 * Real-world refraction — glass, acrylic, water. `transmission` refracts the
 * scene behind the surface (not alpha fake-transparency), `ior` sets the bend
 * angle, `dispersion` spreads the bend per wavelength so edges fringe like real
 * float glass, and `attenuation*` tints the light by the distance it travels
 * through the medium.
 */
export interface RefractionSpec {
  /** 0 = opaque, 1 = perfectly clear. */
  transmission: number;
  /** Index of refraction. Water 1.33 · float glass 1.52 · crystal 1.62. */
  ior: number;
  /** Optical path length through the medium, in metres. */
  thickness: number;
  /** Per-wavelength IOR spread (chromatic dispersion). 0 disables the fringing. */
  dispersion: number;
  /** Distance at which the medium absorbs half the light, in metres. */
  attenuationDistance: number;
  /** Absorption tint — the colour light becomes after `attenuationDistance`. */
  attenuationColor: string;
  /** Micro-roughness of the glass surface (frosted glass raises this). */
  roughness: number;
  envMapIntensity: number;
}

/**
 * Anisotropic reflection — brushed aluminium, silk, carpet pile. The highlight
 * smears along a grain direction instead of sitting as a round specular dot.
 */
export interface AnisotropySpec {
  /** 0 = isotropic, 1 = fully smeared along the grain. */
  intensity: number;
  /** Grain direction in tangent space, radians. */
  rotation: number;
  /** Roughness seen along the grain vs across it (Babylon splits these). */
  roughnessAlong: number;
  roughnessAcross: number;
}

/**
 * Surface relief — displaces vertices (or parallax-maps them where the engine
 * cannot afford real displacement) from the material's height field.
 */
export interface DisplacementSpec {
  /** Metres of relief at full white in the height map. */
  scale: number;
  /** Offset so the relief sits centred on the surface. */
  bias: number;
  /** Vertex density (segments per side) required for the relief to resolve. */
  segments: number;
  /** Parallax occlusion strength for engines that map relief instead. */
  parallax: number;
}

/**
 * Global illumination — the environment probe, the bounce fill and the rule
 * that every visible emitter is a real light. `emissiveLightRatio` is the key
 * physical coupling: the light a lamp/screen casts is proportional to how
 * bright its emissive surface reads.
 */
export interface GlobalIlluminationSpec {
  /** HDR environment (IBL) intensity multiplier. */
  environmentIntensity: number;
  /** Bounced fill (sky/ground hemisphere or light-probe term). */
  bounceIntensity: number;
  /** Dynamic light emitted per unit of emissive brightness on fixtures. */
  emissiveLightRatio: number;
  /** Ceiling for simultaneously active dynamic lights per set. */
  maxDynamicLights: number;
  /** Multiplier for screen/LED-wall spill light. */
  screenLightIntensity: number;
  /** Multiplier for practical (lamp) point lights. */
  practicalLightIntensity: number;
  /** Soft grounding shadow under set dressing. */
  contactShadows: boolean;
  /** Shadow-casting light budget. */
  shadowCastingLights: number;
}

/** Atmospheric haze that the rig's beams scatter through. */
export interface VolumetricSpec {
  /** Exponential fog density (1/m). */
  hazeDensity: number;
  /** Brightness of visible light shafts. */
  beamIntensity: number;
  /** Cone tessellation — low tiers use a cheap gradient cone. */
  beamSegments: number;
  /** Drifting noise in the shafts so haze feels alive on camera. */
  animated: boolean;
  /** Beam budget per set (key + practicals). */
  maxBeams: number;
}

/**
 * Rendering-pipeline budget. These are the knobs that keep every virtual set at
 * broadcast frame rate: texture memory, filtering cost, shadow cost and how
 * aggressively derived maps are compressed.
 */
export interface PerformanceBudget {
  /** Largest texture edge generated for a surface map. */
  maxTextureSize: number;
  /** Texture anisotropic filtering samples. */
  textureAnisotropy: number;
  /** Soft ceiling for the procedural texture cache, in megabytes. */
  textureBudgetMb: number;
  /**
   * Downsampling factor for derived (roughness/metalness/ORM) maps — they are
   * low-frequency, so 2× compression is visually free and halves the memory.
   */
  derivedMapScale: number;
  /** Half-float HDR render targets (needed for true emissive > 1 values). */
  hdrRenderTargets: boolean;
  /** Release cached procedural textures when the stage unmounts. */
  disposeIdleTextures: boolean;
  /** Displacement/relief resolves on real vertices at this tier and above. */
  vertexDisplacement: boolean;
}

export interface FidelityProfile {
  tier: FidelityTier;
  /** `null` = feature disabled at this tier. */
  refraction: RefractionSpec | null;
  anisotropy: AnisotropySpec | null;
  displacement: DisplacementSpec | null;
  globalIllumination: GlobalIlluminationSpec;
  volumetrics: VolumetricSpec | null;
  performance: PerformanceBudget;
}

/* ------------------------------------------------------------ materials --- */

/** Low-iron float glass — the reference refraction medium. */
export const GLASS_REFRACTION: RefractionSpec = {
  transmission: 1,
  ior: 1.52,
  thickness: 0.012,
  dispersion: 0.028,
  attenuationDistance: 2.4,
  attenuationColor: '#eaf6f2',
  roughness: 0.045,
  envMapIntensity: 1.7,
};

/** Brushed aluminium — the reference anisotropic metal. */
export const BRUSHED_METAL_ANISOTROPY: AnisotropySpec = {
  intensity: 0.72,
  rotation: 0,
  roughnessAlong: 0.22,
  roughnessAcross: 0.44,
};

/**
 * Carpet pile — fibres leaning one way catch the key light as a directional
 * sheen band that walks across the floor as the camera moves.
 */
export const CARPET_ANISOTROPY: AnisotropySpec = {
  intensity: 0.42,
  rotation: Math.PI / 4,
  roughnessAlong: 0.82,
  roughnessAcross: 0.96,
};

/** Wood grain — pores running along the board smear light a subtle amount. */
export const WOOD_ANISOTROPY: AnisotropySpec = {
  intensity: 0.3,
  rotation: 0,
  roughnessAlong: 0.36,
  roughnessAcross: 0.5,
};

/** Plaster / concrete — almost isotropic, just a whisper of trowel direction. */
export const PLASTER_ANISOTROPY: AnisotropySpec = {
  intensity: 0.15,
  rotation: 0,
  roughnessAlong: 0.68,
  roughnessAcross: 0.74,
};

/** Wood grain / lacquered boards — relief that grazes light across the grain. */
export const WOOD_DISPLACEMENT: DisplacementSpec = {
  scale: 0.012,
  bias: -0.006,
  segments: 96,
  parallax: 0.55,
};

/** Woven upholstery + carpet — deeper pile relief. */
export const TEXTILE_DISPLACEMENT: DisplacementSpec = {
  scale: 0.018,
  bias: -0.009,
  segments: 72,
  parallax: 0.8,
};

/** Plaster / concrete — subtle trowel relief. */
export const PLASTER_DISPLACEMENT: DisplacementSpec = {
  scale: 0.008,
  bias: -0.004,
  segments: 64,
  parallax: 0.35,
};

/* --------------------------------------------------------------- tiers --- */

const LOW: FidelityProfile = {
  tier: 'low',
  // Refraction is the first thing to go: transmission renders the scene twice.
  refraction: null,
  anisotropy: null,
  displacement: null,
  globalIllumination: {
    environmentIntensity: 0.9,
    bounceIntensity: 0.16,
    emissiveLightRatio: 1.1,
    maxDynamicLights: 2,
    screenLightIntensity: 0.45,
    practicalLightIntensity: 0.5,
    contactShadows: true,
    shadowCastingLights: 1,
  },
  // No visible shafts below balanced — plain exponential haze only.
  volumetrics: null,
  performance: {
    maxTextureSize: 256,
    textureAnisotropy: 4,
    textureBudgetMb: 24,
    derivedMapScale: 2,
    hdrRenderTargets: false,
    disposeIdleTextures: true,
    vertexDisplacement: false,
  },
};

const BALANCED: FidelityProfile = {
  tier: 'balanced',
  refraction: {
    ...GLASS_REFRACTION,
    // No dispersion below high tier — it needs a wide sample spread.
    dispersion: 0,
  },
  anisotropy: { ...BRUSHED_METAL_ANISOTROPY, intensity: 0.5 },
  displacement: null,
  globalIllumination: {
    environmentIntensity: 1,
    bounceIntensity: 0.22,
    emissiveLightRatio: 1.6,
    maxDynamicLights: 4,
    screenLightIntensity: 0.7,
    practicalLightIntensity: 0.75,
    contactShadows: true,
    shadowCastingLights: 1,
  },
  volumetrics: {
    hazeDensity: 0.011,
    beamIntensity: 0.045,
    beamSegments: 20,
    animated: true,
    maxBeams: 2,
  },
  performance: {
    maxTextureSize: 512,
    textureAnisotropy: 8,
    textureBudgetMb: 48,
    derivedMapScale: 2,
    hdrRenderTargets: true,
    disposeIdleTextures: true,
    vertexDisplacement: false,
  },
};

const HIGH: FidelityProfile = {
  tier: 'high',
  refraction: GLASS_REFRACTION,
  anisotropy: BRUSHED_METAL_ANISOTROPY,
  displacement: {
    ...WOOD_DISPLACEMENT,
    parallax: 0.7,
  },
  globalIllumination: {
    environmentIntensity: 1.05,
    bounceIntensity: 0.28,
    emissiveLightRatio: 2.1,
    maxDynamicLights: 6,
    screenLightIntensity: 0.9,
    practicalLightIntensity: 1,
    contactShadows: true,
    shadowCastingLights: 2,
  },
  volumetrics: {
    hazeDensity: 0.014,
    beamIntensity: 0.06,
    beamSegments: 28,
    animated: true,
    maxBeams: 3,
  },
  performance: {
    maxTextureSize: 1024,
    textureAnisotropy: 16,
    textureBudgetMb: 96,
    derivedMapScale: 1,
    hdrRenderTargets: true,
    disposeIdleTextures: true,
    vertexDisplacement: true,
  },
};

const ULTRA: FidelityProfile = {
  tier: 'ultra',
  refraction: GLASS_REFRACTION,
  anisotropy: BRUSHED_METAL_ANISOTROPY,
  displacement: {
    ...WOOD_DISPLACEMENT,
    segments: 128,
    parallax: 1,
  },
  globalIllumination: {
    environmentIntensity: 1.1,
    bounceIntensity: 0.34,
    emissiveLightRatio: 2.5,
    maxDynamicLights: 8,
    screenLightIntensity: 1.05,
    practicalLightIntensity: 1.15,
    contactShadows: true,
    shadowCastingLights: 2,
  },
  volumetrics: {
    hazeDensity: 0.016,
    beamIntensity: 0.075,
    beamSegments: 36,
    animated: true,
    maxBeams: 4,
  },
  performance: {
    maxTextureSize: 2048,
    textureAnisotropy: 16,
    textureBudgetMb: 256,
    derivedMapScale: 1,
    hdrRenderTargets: true,
    disposeIdleTextures: true,
    vertexDisplacement: true,
  },
};

const PROFILES: Record<FidelityTier, FidelityProfile> = {
  low: LOW,
  balanced: BALANCED,
  high: HIGH,
  ultra: ULTRA,
};

/** The fidelity profile for a tier — materials, lighting and budget. */
export function fidelityProfile(tier: FidelityTier): FidelityProfile {
  return PROFILES[tier];
}

/** Effective refraction spec for the tier, or `null` when disabled. */
export function refractionFor(tier: FidelityTier): RefractionSpec | null {
  return PROFILES[tier].refraction;
}

/**
 * The anisotropy spec to use for a material family at a tier — metals, textiles
 * (carpet pile, weave), wood grain and plaster each grade differently so a
 * brushed desk leg and a carpet floor never share one look.
 */
export function anisotropyFor(
  tier: FidelityTier,
  material: 'metal' | 'textile' | 'wood' | 'plaster',
): AnisotropySpec | null {
  const base = PROFILES[tier].anisotropy;
  if (!base) return null;
  const source =
    material === 'metal'
      ? BRUSHED_METAL_ANISOTROPY
      : material === 'textile'
        ? CARPET_ANISOTROPY
        : material === 'wood'
          ? WOOD_ANISOTROPY
          : PLASTER_ANISOTROPY;
  // All families scale with the tier's grade-off of the metal reference.
  return {
    ...source,
    intensity: source.intensity * (base.intensity / BRUSHED_METAL_ANISOTROPY.intensity),
  };
}

/** The displacement spec to use for a material family at a tier. */
export function displacementFor(
  tier: FidelityTier,
  material: 'wood' | 'textile' | 'plaster',
): DisplacementSpec | null {
  const base = PROFILES[tier].displacement;
  if (!base) return null;
  const source = material === 'wood' ? WOOD_DISPLACEMENT : material === 'textile' ? TEXTILE_DISPLACEMENT : PLASTER_DISPLACEMENT;
  return {
    ...source,
    segments: base.segments,
    parallax: base.parallax,
  };
}

/* ------------------------------------------------- engine: Unreal Engine --- */

/**
 * Translates the fidelity profile into Unreal Engine console commands pushed
 * through the Pixel Streaming data channel. Unreal renders the set remotely,
 * so "applying the standard" means driving its real-time GI, reflection,
 * shadow and streaming systems at the same fidelity the local engines render:
 *
 *  - Lumen global illumination + reflections (the UE5 GI answer)
 *  - virtual shadow maps with contact-hardening at high tiers
 *  - TSR temporal upscaling, screen percentage per tier
 *  - `r.MaxAnisotropy` for the same anisotropic filtering budget
 *  - texture streaming pool + mip bias = the asset-compression budget
 */
export function unrealFidelityCommands(tier: FidelityTier): string[] {
  const profile = PROFILES[tier];
  const gi = profile.globalIllumination;
  const commands: string[] = [
    // Global illumination + reflections — Lumen, physically the same job the
    // IBL probes + bounce fill do on the local engines.
    `r.Lumen.GlobalIllumination ${tier === 'low' ? 0 : 1}`,
    `r.Lumen.Reflections ${tier === 'low' ? 0 : 1}`,
    `r.Lumen.HardwareRayTracing ${tier === 'ultra' ? 1 : 0}`,
    // Volumetric lighting interacting with the rig.
    `r.VolumetricFog ${profile.volumetrics ? 1 : 0}`,
    `r.LightFunctionQuality ${tier === 'low' ? 0 : 2}`,
    // Shadows: virtual shadow maps with per-tier resolution bias.
    `r.Shadow.Virtual.Enable ${tier === 'low' ? 0 : 1}`,
    `r.Shadow.Virtual.ResolutionLodBiasDirectional ${tier === 'ultra' ? -1.5 : tier === 'high' ? -0.5 : 0.75}`,
    // Anisotropic filtering budget — matches `performance.textureAnisotropy`.
    `r.MaxAnisotropy ${profile.performance.textureAnisotropy}`,
    // Asset compression / streaming: pool size is the texture memory budget,
    // mip bias trades sharpness for bandwidth on the weaker tiers.
    `r.Streaming.PoolSize ${profile.performance.textureBudgetMb * 16}`,
    `r.Streaming.MipBias ${profile.performance.derivedMapScale - 1}`,
    `r.TextureStreaming ${profile.performance.disposeIdleTextures ? 1 : 0}`,
    // Displacement/detail — Nanite keeps high-density relief affordable.
    `r.Nanite ${profile.performance.vertexDisplacement ? 1 : 0}`,
    `r.MaterialQualityLevel ${tier === 'low' ? 0 : tier === 'balanced' ? 2 : 3}`,
    // Anti-aliasing / temporal reconstruction + render scale.
    `r.AntiAliasingMethod ${tier === 'low' ? 1 : 4}`,
    `r.ScreenPercentage ${tier === 'ultra' ? 125 : tier === 'high' ? 110 : 100}`,
    // Camera-stack parity with the local engines' post chains: the same bloom,
    // lens fringe, depth of field, motion blur and contact-shadow budget the
    // R3F and Babylon stages run, so the photographic language matches.
    `r.Tonemapper.Quality ${tier === 'ultra' ? 4 : tier === 'high' ? 3 : 2}`,
    `r.BloomQuality ${tier === 'low' ? 3 : 5}`,
    `r.SceneColorFringeQuality ${tier === 'low' ? 0 : tier === 'balanced' ? 1 : 2}`,
    `r.DepthOfFieldQuality ${tier === 'low' ? 1 : 2}`,
    `r.MotionBlurQuality ${tier === 'ultra' ? 4 : tier === 'high' ? 3 : 2}`,
    `r.SSR.Quality ${tier === 'low' ? 0 : tier === 'balanced' ? 2 : 4}`,
    `r.ContactShadows ${tier === 'low' ? 0 : 1}`,
    `r.Shadow.CSM.MaxCascades ${tier === 'balanced' ? 3 : 4}`,
    // Practical/screen light budget — mirrors `maxDynamicLights`.
    `r.MaxLights ${gi.maxDynamicLights}`,
  ];
  return commands;
}

/**
 * Composite quality level Unreal's scalability groups snap to, derived from the
 * same tier the local engines use so all renderers degrade together.
 */
export function unrealScalabilityLevel(tier: FidelityTier): 'low' | 'medium' | 'high' | 'epic' | 'cinematic' {
  switch (tier) {
    case 'low':
      return 'low';
    case 'balanced':
      return 'medium';
    case 'high':
      return 'epic';
    case 'ultra':
      return 'cinematic';
  }
}

/* ---------------------------------------------- engine: shared helpers --- */

/**
 * Scales a spec's relief for the tessellation actually available — a
 * 24-segment plane cannot resolve full-strength displacement without pinching,
 * so weak geometry proportionally flattens the relief instead of aliasing.
 */
export function scaledDisplacement(
  spec: DisplacementSpec,
  segments: number,
): { scale: number; bias: number } {
  const resolve = Math.min(1, segments / spec.segments);
  return { scale: spec.scale * resolve, bias: spec.bias * resolve };
}

/** Rough texture-memory estimate (MB) for a full PBR map set at a tier. */
export function textureSetMemoryMb(tier: FidelityTier, setCount: number): number {
  const { maxTextureSize, derivedMapScale } = PROFILES[tier].performance;
  // Compressed (BC7/DXT-class) footprint — the asset pipeline ships block-
  // compressed maps and the runtime procedural bank downscales derived maps to
  // match, so one texel averages ~1 byte in memory.
  const bytesPerTexel = 1;
  const fullMaps = 2; // colour + normal at full size
  const derivedMaps = 2 / (derivedMapScale * derivedMapScale); // roughness + ORM
  const perSet = maxTextureSize * maxTextureSize * bytesPerTexel * (fullMaps + derivedMaps);
  return (perSet * setCount) / (1024 * 1024);
}

/** True when a surface's estimated memory fits the tier's texture budget. */
export function withinTextureBudget(tier: FidelityTier, setCount: number): boolean {
  return textureSetMemoryMb(tier, setCount) <= PROFILES[tier].performance.textureBudgetMb;
}
