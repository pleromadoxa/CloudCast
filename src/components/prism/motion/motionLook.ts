import { createContext, useContext } from 'react';

/**
 * Operator-controlled grade injected into every 3D motion scene.
 *
 * Lives in its own module (not `kit.tsx`) so the kit keeps exporting only
 * components — the fast-refresh lint rule allows no function exports there.
 */
export interface MotionLook {
  /** Exposure multiplier for the WebGL renderer (0.5–1.6). */
  exposure: number;
  /** Bloom multiplier (0 = off, 1 = the template's grade). */
  bloom: number;
  /** Extra film grain (0–0.2). */
  grain: number;
  /** Extra chromatic aberration in pixels (0–2.5). */
  chroma: number;
  /** Vignette multiplier (0 = off, 1 = the template's grade). */
  vignette: number;
  /** Particle density multiplier (0–1.5). */
  particleScale: number;
  /** A WebGPU/photo plate is painting behind the scene. */
  backdropActive: boolean;
}

export const DEFAULT_MOTION_LOOK: MotionLook = {
  exposure: 1,
  bloom: 1,
  grain: 0,
  chroma: 0,
  vignette: 1,
  particleScale: 1,
  backdropActive: false,
};

export const MotionLookContext = createContext<MotionLook>(DEFAULT_MOTION_LOOK);

/** Grade + density controls the stage injects into every scene. */
export function useMotionLook(): MotionLook {
  return useContext(MotionLookContext);
}
