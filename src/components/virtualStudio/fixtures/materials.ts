import { useMemo } from 'react';
import { pbrFromTexture, pbrSolid } from '../../../lib/prism/pbrMaterials';

/**
 * Shared PBR palette for set dressing. Built once per mount and reused by
 * every fixture in a scene — materials are the expensive part of a render.
 *
 * Lives in its own module (not alongside the fixture components) so React Fast
 * Refresh keeps working for the component files.
 */
export function useStudioMaterials() {
  return useMemo(
    () => ({
      walnut: pbrFromTexture('wood_walnut', 3, { roughness: 0.38, envMapIntensity: 1.15, normalScale: 1.0 }),
      oak: pbrFromTexture('wood_oak', 1, { roughness: 0.46, normalScale: 1.05 }),
      fabric: pbrFromTexture('fabric_velvet', 5, { roughness: 0.88, normalScale: 1.35, envMapIntensity: 0.75 }),
      linen: pbrFromTexture('fabric_linen', 2, { roughness: 0.92, normalScale: 1.25, envMapIntensity: 0.7 }),
      leather: pbrFromTexture('leather', 7, { roughness: 0.5, normalScale: 1.6, envMapIntensity: 1.1 }),
      carpet: pbrFromTexture('carpet', 4, { roughness: 0.96, normalScale: 1.8, envMapIntensity: 0.5 }),
      concrete: pbrFromTexture('concrete', 6, { roughness: 0.7, normalScale: 1.1 }),
      marble: pbrFromTexture('marble', 8, { roughness: 0.16, metalness: 0.06, envMapIntensity: 1.45, normalScale: 0.55 }),
      metal: pbrSolid('#3f3f46', { metalness: 0.92, roughness: 0.26, envMapIntensity: 1.5 }),
      chrome: pbrSolid('#9ca3af', { metalness: 1, roughness: 0.1, envMapIntensity: 1.7 }),
      brass: pbrSolid('#b08d4f', { metalness: 1, roughness: 0.32, envMapIntensity: 1.5 }),
      blackGlass: pbrSolid('#0a0a0d', { metalness: 0.65, roughness: 0.06, envMapIntensity: 1.6 }),
      dark: pbrSolid('#18181b', { metalness: 0.42, roughness: 0.42 }),
      white: pbrSolid('#e7e5e4', { roughness: 0.55 }),
      /** Warm lampshade / diffuser plastic — lets light sit softly on fixtures. */
      shade: pbrSolid('#f5efe4', {
        roughness: 0.65,
        emissive: '#ffd9a0',
        emissiveIntensity: 0.32,
      }),
    }),
    [],
  );
}
