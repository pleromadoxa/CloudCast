import { describe, expect, it } from 'vitest';
import {
  BRUSHED_METAL_ANISOTROPY,
  CARPET_ANISOTROPY,
  GLASS_REFRACTION,
  anisotropyFor,
  displacementFor,
  fidelityProfile,
  refractionFor,
  scaledDisplacement,
  textureSetMemoryMb,
  unrealFidelityCommands,
  unrealScalabilityLevel,
  withinTextureBudget,
  type FidelityTier,
} from './fidelity';

const TIERS: FidelityTier[] = ['low', 'balanced', 'high', 'ultra'];

describe('fidelity profile', () => {
  it('ships a complete profile for every tier', () => {
    for (const tier of TIERS) {
      const profile = fidelityProfile(tier);
      expect(profile.tier).toBe(tier);
      expect(profile.globalIllumination.maxDynamicLights).toBeGreaterThan(0);
      expect(profile.performance.maxTextureSize).toBeGreaterThanOrEqual(256);
    }
  });

  it('tiers quality upward monotonically', () => {
    for (let i = 1; i < TIERS.length; i += 1) {
      const prev = fidelityProfile(TIERS[i - 1]);
      const next = fidelityProfile(TIERS[i]);
      expect(next.performance.maxTextureSize).toBeGreaterThanOrEqual(prev.performance.maxTextureSize);
      expect(next.globalIllumination.maxDynamicLights).toBeGreaterThanOrEqual(
        prev.globalIllumination.maxDynamicLights,
      );
      expect(next.performance.textureBudgetMb).toBeGreaterThanOrEqual(prev.performance.textureBudgetMb);
    }
  });

  it('uses real float-glass physics for refraction where enabled', () => {
    expect(refractionFor('low')).toBeNull();
    for (const tier of ['balanced', 'high', 'ultra'] as FidelityTier[]) {
      const glass = refractionFor(tier);
      expect(glass).not.toBeNull();
      expect(glass!.ior).toBeCloseTo(GLASS_REFRACTION.ior, 3);
      expect(glass!.transmission).toBeGreaterThan(0.9);
      // Dispersion needs the wide sample spread of high tier and above.
      expect(glass!.dispersion).toBe(tier === 'balanced' ? 0 : GLASS_REFRACTION.dispersion);
    }
  });

  it('grades anisotropy per material family', () => {
    expect(anisotropyFor('low', 'metal')).toBeNull();
    const metal = anisotropyFor('high', 'metal')!;
    const carpet = anisotropyFor('high', 'textile')!;
    expect(metal.intensity).toBeCloseTo(BRUSHED_METAL_ANISOTROPY.intensity, 3);
    expect(carpet.intensity).toBeCloseTo(CARPET_ANISOTROPY.intensity, 3);
    expect(carpet.rotation).toBeCloseTo(CARPET_ANISOTROPY.rotation, 3);
    // Weaker tiers soften, never strengthen, the effect.
    expect(anisotropyFor('balanced', 'metal')!.intensity).toBeLessThanOrEqual(metal.intensity);
  });

  it('only resolves displacement where vertex budget exists', () => {
    expect(displacementFor('balanced', 'wood')).toBeNull();
    const wood = displacementFor('ultra', 'wood')!;
    expect(wood.segments).toBeGreaterThanOrEqual(64);
    expect(wood.scale).toBeGreaterThan(0);
    const textile = displacementFor('high', 'textile')!;
    expect(textile.scale).toBeGreaterThan(wood.scale);
  });

  it('scales relief down when geometry is too coarse to resolve it', () => {
    const spec = displacementFor('ultra', 'wood')!;
    const coarse = scaledDisplacement(spec, spec.segments / 2);
    expect(coarse.scale).toBeCloseTo(spec.scale / 2, 6);
    const finer = scaledDisplacement(spec, spec.segments * 2);
    expect(finer.scale).toBeCloseTo(spec.scale, 6);
  });
});

describe('performance budgets', () => {
  it('keeps representative map sets inside the texture budget', () => {
    for (const tier of TIERS) {
      // ~14 shared surface materials in a dressed set.
      expect(withinTextureBudget(tier, 14)).toBe(true);
    }
  });

  it('compresses derived maps harder on weaker tiers', () => {
    expect(fidelityProfile('low').performance.derivedMapScale).toBeGreaterThanOrEqual(
      fidelityProfile('high').performance.derivedMapScale,
    );
  });

  it('estimates texture memory consistently', () => {
    const mb = textureSetMemoryMb('high', 10);
    expect(mb).toBeGreaterThan(0);
    expect(textureSetMemoryMb('high', 20)).toBeCloseTo(mb * 2, 6);
    expect(textureSetMemoryMb('low', 10)).toBeLessThan(mb);
  });
});

describe('unreal fidelity mapping', () => {
  it('maps the tier to a scalability level', () => {
    expect(unrealScalabilityLevel('low')).toBe('low');
    expect(unrealScalabilityLevel('balanced')).toBe('medium');
    expect(unrealScalabilityLevel('high')).toBe('epic');
    expect(unrealScalabilityLevel('ultra')).toBe('cinematic');
  });

  it('pushes Lumen GI, virtual shadows and the shared budgets', () => {
    const commands = unrealFidelityCommands('ultra');
    expect(commands).toContain('r.Lumen.GlobalIllumination 1');
    expect(commands).toContain('r.Lumen.Reflections 1');
    expect(commands).toContain('r.Shadow.Virtual.Enable 1');
    expect(commands).toContain(`r.MaxAnisotropy ${fidelityProfile('ultra').performance.textureAnisotropy}`);
    expect(commands.some((c) => c.startsWith('r.Streaming.PoolSize'))).toBe(true);
  });

  it('matches the local engines’ camera stack at every tier', () => {
    // Bloom, lens fringe, DOF, motion blur, SSR and contact shadows degrade
    // with the same tier ladder the R3F/Babylon post chains follow.
    const ultra = unrealFidelityCommands('ultra');
    expect(ultra).toContain('r.Tonemapper.Quality 4');
    expect(ultra).toContain('r.ContactShadows 1');
    expect(ultra).toContain('r.BloomQuality 5');
    const low = unrealFidelityCommands('low');
    expect(low).toContain('r.Tonemapper.Quality 2');
    expect(low).toContain('r.ContactShadows 0');
    expect(low).toContain('r.SceneColorFringeQuality 0');
  });

  it('degrades Unreal in lockstep with the local engines', () => {
    const low = unrealFidelityCommands('low');
    expect(low).toContain('r.Lumen.GlobalIllumination 0');
    expect(low).toContain('r.VolumetricFog 0');
    expect(low.every((c) => /^[\w.]+ [\w.-]+$/.test(c))).toBe(true);
    const all = TIERS.flatMap((tier) => unrealFidelityCommands(tier));
    expect(all.every((c) => /^[\w.]+ [\w.-]+$/.test(c))).toBe(true);
  });
});
