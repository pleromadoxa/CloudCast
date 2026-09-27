/* eslint-disable react-refresh/only-export-components -- hooks ship with their provider (same pattern as RenderEngineContext) */
import {
  createContext,
  memo,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  fidelityProfile,
  type FidelityTier,
  type GlobalIlluminationSpec,
  type VolumetricSpec,
} from '../../../lib/virtualStudio/fidelity';

/**
 * Fidelity-driven lighting for the photoreal stages.
 *
 * The shared standard (`fidelity.ts`) says every visible emitter — lamp,
 * LED wall, light box — is a real dynamic light scaled by how bright its
 * emissive surface reads (`emissiveLightRatio`), and that every set holds a
 * budget of simultaneously active dynamic lights so the shader never blows the
 * frame budget. This module is the three.js-side plumbing: a context carrying
 * the active tier's lighting spec plus a light-slot budget that fixtures claim
 * slots from (highest priority wins when the set is over budget).
 */

export interface StudioFidelityLighting {
  tier: FidelityTier;
  lights: GlobalIlluminationSpec;
  volumetrics: VolumetricSpec | null;
  budget: LightBudget;
}

/**
 * Dynamic-light budget: every fixture that wants to cast light claims a slot.
 * When more lights want to exist than the tier allows, the lowest-priority
 * slots go dark instead of the frame rate collapsing.
 */
export class LightBudget {
  private readonly slots = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private snapshot: string[] = [];
  limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  claim(id: string, priority: number): void {
    this.slots.set(id, priority);
    this.recompute();
  }

  release(id: string): void {
    if (this.slots.delete(id)) this.recompute();
  }

  /** True while this slot is inside the active set. */
  isActive(id: string): boolean {
    return this.snapshot.includes(id);
  }

  /** Number of lights currently allowed to render. */
  activeCount(): number {
    return this.snapshot.length;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): string[] => this.snapshot;

  private recompute(): void {
    const ranked = [...this.slots.entries()].sort((a, b) => b[1] - a[1]);
    const next = ranked.slice(0, Math.max(0, this.limit)).map(([id]) => id);
    if (
      next.length !== this.snapshot.length ||
      next.some((id, i) => id !== this.snapshot[i])
    ) {
      this.snapshot = next;
      for (const listener of [...this.listeners]) listener();
    }
  }
}

const DEFAULT_LIGHTING: StudioFidelityLighting = (() => {
  const profile = fidelityProfile('high');
  return {
    tier: 'high',
    lights: profile.globalIllumination,
    volumetrics: profile.volumetrics,
    budget: new LightBudget(profile.globalIllumination.maxDynamicLights),
  };
})();

const StudioFidelityContext = createContext<StudioFidelityLighting>(DEFAULT_LIGHTING);

/**
 * Provides the active tier's lighting spec + light budget to the set. Mount
 * once per stage; fixtures read it through `useStudioFidelityLighting`.
 */
export const StudioFidelityProvider = memo(function StudioFidelityProvider({
  tier,
  children,
}: {
  tier: FidelityTier;
  children: ReactNode;
}) {
  const value = useMemo<StudioFidelityLighting>(() => {
    const profile = fidelityProfile(tier);
    return {
      tier,
      lights: profile.globalIllumination,
      volumetrics: profile.volumetrics,
      budget: new LightBudget(profile.globalIllumination.maxDynamicLights),
    };
  }, [tier]);
  return <StudioFidelityContext.Provider value={value}>{children}</StudioFidelityContext.Provider>;
});

export function useStudioFidelityLighting(): StudioFidelityLighting {
  return useContext(StudioFidelityContext);
}

/**
 * Claims a dynamic-light slot for a fixture. Returns `false` when the set is
 * over its light budget and this fixture (by priority) should stay dark —
 * fixtures then render their emissive surface without the 3D light.
 */
export function useLightSlot(priority: number): boolean {
  const { budget } = useStudioFidelityLighting();
  const id = useId();
  const claimed = useRef(false);

  useEffect(() => {
    budget.claim(id, priority);
    claimed.current = true;
    return () => budget.release(id);
    // `budget` changes identity with the tier — the claim must migrate.
  }, [budget, id, priority]);

  const active = useSyncExternalStore(
    budget.subscribe,
    () => budget.isActive(id),
    () => true,
  );
  return active;
}

/**
 * Physically couples an emitter's light to its emissive brightness: the light
 * a fixture casts scales with `emissiveLightRatio × practicalLightIntensity`
 * from the fidelity spec — the same rule the Babylon and Unreal stages apply,
 * so a lamp glows and lights identically on every engine. Normalised to the
 * high tier (≈1.0) so set dressing keeps its hand-tuned look at reference
 * quality while cheaper tiers genuinely emit less light.
 */
const REFERENCE_LIGHTS = fidelityProfile('high').globalIllumination;

export function usePracticalLightScale(): number {
  const { lights } = useStudioFidelityLighting();
  return (
    (lights.emissiveLightRatio * lights.practicalLightIntensity) /
    (REFERENCE_LIGHTS.emissiveLightRatio * REFERENCE_LIGHTS.practicalLightIntensity)
  );
}

export function useScreenLightScale(): number {
  const { lights } = useStudioFidelityLighting();
  return (
    (lights.emissiveLightRatio * lights.screenLightIntensity) /
    (REFERENCE_LIGHTS.emissiveLightRatio * REFERENCE_LIGHTS.screenLightIntensity)
  );
}

/** Gate + scale helper used by volumetric shafts. */
export function useVolumetrics(): VolumetricSpec | null {
  return useStudioFidelityLighting().volumetrics;
}

/** Provider-less variant for components rendered outside a stage (tests). */
export function defaultFidelityLighting(): StudioFidelityLighting {
  return DEFAULT_LIGHTING;
}

/** Re-exported so fixtures don't need a second import path. */
export function lightingForTier(tier: FidelityTier): StudioFidelityLighting {
  const profile = fidelityProfile(tier);
  return {
    tier,
    lights: profile.globalIllumination,
    volumetrics: profile.volumetrics,
    budget: new LightBudget(profile.globalIllumination.maxDynamicLights),
  };
}
