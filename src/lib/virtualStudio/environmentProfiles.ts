import type { StudioSceneCategory } from './types';

/**
 * Image-based lighting for the photoreal stage.
 *
 * Every set is lit by a real, unclipped HDRI instead of a procedural light
 * rig: a photographed studio gives correct specular response, believable
 * reflections on metal/glass and a mood that actually matches the set.
 *
 * The files are CC0 scans from Poly Haven, self-hosted under `public/hdri/`
 * so nothing depends on a CDN at runtime. `intensity` scales
 * `scene.environmentIntensity` per environment — daylight scans read far
 * hotter than interior studio scans and need pulling back.
 */
export interface StudioEnvironmentProfile {
  /** Absolute path of the `.hdr` file under `public/`. */
  file: string;
  /** Multiplier applied to `scene.environmentIntensity`. */
  intensity: number;
}

const ENVIRONMENTS = {
  /** Neutral photo studio — even soft-box light, true white balance. */
  studio: { file: '/hdri/studio_small_08_1k.hdr', intensity: 1 },
  /** Large daylight studio hall — talk shows and stages. */
  theatre: { file: '/hdri/photo_studio_01_1k.hdr', intensity: 1 },
  /** Warm brown-wood interior — home sets. */
  home: { file: '/hdri/brown_photostudio_02_1k.hdr', intensity: 1 },
  /** Open stadium in daylight — sports desks and exteriors. */
  arena: { file: '/hdri/stadium_01_1k.hdr', intensity: 1 },
  /** Outdoor music stage at dusk — concert sets. Pulled well down: the scan
      carries full daylight, which would wash a dark stage set to milk. */
  stage: { file: '/hdri/park_music_stage_1k.hdr', intensity: 0.15 },
} satisfies Record<string, StudioEnvironmentProfile>;

export type StudioEnvironmentKey = keyof typeof ENVIRONMENTS;

/** Which environment lights each scene category. Exhaustive by type. */
const CATEGORY_ENVIRONMENT: Record<StudioSceneCategory, StudioEnvironmentKey> = {
  news: 'studio',
  business: 'studio',
  weather: 'studio',
  blank: 'studio',
  talk: 'theatre',
  worship: 'theatre',
  home: 'home',
  sports: 'arena',
  exterior: 'arena',
  concert: 'stage',
};

/** Resolve the HDRI that lights a scene category. */
export function environmentForCategory(category: StudioSceneCategory): StudioEnvironmentProfile {
  return ENVIRONMENTS[CATEGORY_ENVIRONMENT[category]];
}

/** Every hosted HDRI path — used by tests to keep code and assets in sync. */
export function hostedEnvironmentFiles(): string[] {
  return Object.values(ENVIRONMENTS).map((profile) => profile.file);
}
