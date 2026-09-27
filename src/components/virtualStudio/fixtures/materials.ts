import { useMemo } from 'react';
import { pbrFromTexture, pbrSolid } from '../../../lib/prism/pbrMaterials';
import {
  anisotropyFor,
  displacementFor,
  type AnisotropySpec,
  type DisplacementSpec,
  type FidelityTier,
} from '../../../lib/virtualStudio/fidelity';
import { useStudioFidelityLighting } from './fidelityLighting';

/**
 * Shared PBR palette for set dressing. Built once per mount and reused by
 * every fixture in a scene — materials are the expensive part of a render.
 *
 * The palette follows the shared fidelity standard (`fidelity.ts`): brushed
 * metals and carpet pile carry anisotropic highlights, wood and textile carry
 * displacement relief, and the whole set degrades together with the tier the
 * stage is running at (read from the stage's fidelity context when mounted
 * under one).
 *
 * Lives in its own module (not alongside the fixture components) so React Fast
 * Refresh keeps working for the component files.
 */
export function useStudioMaterials(tier?: FidelityTier) {
  const contextTier = useStudioFidelityLighting().tier;
  const activeTier = tier ?? contextTier;
  return useMemo(() => {
    const metalGrain = anisotropyFor(activeTier, 'metal');
    const pileGrain = anisotropyFor(activeTier, 'textile');
    const woodGrain = anisotropyFor(activeTier, 'wood');
    const plasterGrain = anisotropyFor(activeTier, 'plaster');
    const woodRelief = displacementFor(activeTier, 'wood');
    const textileRelief = displacementFor(activeTier, 'textile');
    const plasterRelief = displacementFor(activeTier, 'plaster');

    /** Anisotropic lobe params from the tier's grain spec. */
    const grain = (spec: AnisotropySpec | null) =>
      spec ? { anisotropy: spec.intensity, anisotropyRotation: spec.rotation } : {};
    /** Displacement relief params from the tier's relief spec. */
    const relief = (spec: DisplacementSpec | null) =>
      spec ? { displacement: spec.scale, displacementBias: spec.bias } : {};

    return {
      walnut: pbrFromTexture('wood_walnut', 3, {
        roughness: 0.38,
        envMapIntensity: 1.15,
        normalScale: 1.0,
        ...grain(woodGrain),
        ...relief(woodRelief),
      }),
      oak: pbrFromTexture('wood_oak', 1, {
        roughness: 0.46,
        normalScale: 1.05,
        ...grain(woodGrain),
        ...relief(woodRelief),
      }),
      fabric: pbrFromTexture('fabric_velvet', 5, {
        roughness: 0.88,
        normalScale: 1.35,
        envMapIntensity: 0.75,
        ...grain(pileGrain),
        ...relief(textileRelief),
      }),
      linen: pbrFromTexture('fabric_linen', 2, {
        roughness: 0.92,
        normalScale: 1.25,
        envMapIntensity: 0.7,
        ...grain(pileGrain),
        ...relief(textileRelief),
      }),
      leather: pbrFromTexture('leather', 7, { roughness: 0.5, normalScale: 1.6, envMapIntensity: 1.1 }),
      // Carpet: `pbrFromTexture('carpet')` applies the full wool-fibre BRDF
      // automatically (sheen, low dielectric specular, pile-lay anisotropy via
      // `CARPET_GRADE`) — here the tier adds the tuft relief on top.
      carpet: pbrFromTexture('carpet', 4, {
        roughness: 0.94,
        normalScale: 1.9,
        envMapIntensity: 0.55,
        // Carpet pile: the anisotropic sheen band + tuft relief are what make a
        // floor read as fibre instead of flat paint.
        ...grain(pileGrain),
        ...relief(textileRelief),
      }),
      concrete: pbrFromTexture('concrete', 6, {
        roughness: 0.7,
        normalScale: 1.1,
        ...grain(plasterGrain),
        ...relief(plasterRelief),
      }),
      marble: pbrFromTexture('marble', 8, { roughness: 0.16, metalness: 0.06, envMapIntensity: 1.45, normalScale: 0.55 }),
      metal: pbrSolid('#3f3f46', { metalness: 0.92, roughness: 0.26, envMapIntensity: 1.5, ...grain(metalGrain) }),
      chrome: pbrSolid('#9ca3af', { metalness: 1, roughness: 0.1, envMapIntensity: 1.7, ...grain(metalGrain) }),
      brass: pbrSolid('#b08d4f', { metalness: 1, roughness: 0.32, envMapIntensity: 1.5, ...grain(metalGrain) }),
      blackGlass: pbrSolid('#0a0a0d', { metalness: 0.65, roughness: 0.06, envMapIntensity: 1.6 }),
      dark: pbrSolid('#18181b', { metalness: 0.42, roughness: 0.42 }),
      white: pbrSolid('#e7e5e4', { roughness: 0.55 }),
      /** Warm lampshade / diffuser plastic — lets light sit softly on fixtures. */
      shade: pbrSolid('#f5efe4', {
        roughness: 0.65,
        emissive: '#ffd9a0',
        emissiveIntensity: 0.32,
      }),
    };
  }, [activeTier]);
}
