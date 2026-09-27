import type { StudioCameraPreset, StudioEffectOverrides, StudioRundownStep, StudioSceneCategory } from './types';
import { kelvinToHex, temperatureToKelvin } from '../renderEngine/colorTemperature';

/**
 * Pure logic behind the production desk UI: camera shot presets and memories,
 * look/mood presets, and clamps for every operator control. Framework-free so
 * the whole desk is unit-testable without WebGL.
 */

/* ------------------------------------------------------------ camera */

export const MIN_ZOOM = 0.55;
export const MAX_ZOOM = 3.4;

/** Lens field-of-view limits in degrees — 24° tele through 55° wide. */
export const MIN_FOV = 22;
export const MAX_FOV = 55;

export type StudioShotId = 'wide' | 'medium' | 'close' | 'two';

export const SHOT_ORDER: StudioShotId[] = ['wide', 'medium', 'close', 'two'];

export const SHOT_LABELS: Record<StudioShotId, string> = {
  wide: 'WIDE',
  medium: 'MEDIUM',
  close: 'CLOSE-UP',
  two: 'TWO-SHOT',
};

export function clampCameraPreset(p: StudioCameraPreset): StudioCameraPreset {
  return {
    yaw: Math.max(-Math.PI, Math.min(Math.PI, p.yaw)),
    pitch: Math.max(-1.25, Math.min(1.35, p.pitch)),
    zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, p.zoom)),
    ...(p.fov !== undefined ? { fov: Math.max(MIN_FOV, Math.min(MAX_FOV, p.fov)) } : {}),
    ...(p.target !== undefined
      ? {
          target: [
            Math.max(-9, Math.min(9, p.target[0])),
            Math.max(0.15, Math.min(4.5, p.target[1])),
            Math.max(-7, Math.min(8, p.target[2])),
          ] as [number, number, number],
        }
      : {}),
  };
}

/**
 * Shot framing relative to the scene's base camera — the wide keeps the whole
 * set in frame, close-up pushes onto talent, two-shot swings camera-left.
 */
export function resolveShot(base: StudioCameraPreset, shot: StudioShotId): StudioCameraPreset {
  switch (shot) {
    case 'wide':
      return clampCameraPreset({ yaw: base.yaw - 0.1, pitch: base.pitch + 0.03, zoom: base.zoom * 0.85 });
    case 'medium':
      return clampCameraPreset({ yaw: base.yaw, pitch: base.pitch, zoom: base.zoom * 1.3 });
    case 'close':
      return clampCameraPreset({ yaw: base.yaw + 0.1, pitch: base.pitch - 0.03, zoom: base.zoom * 1.95 });
    case 'two':
      return clampCameraPreset({ yaw: base.yaw + 0.3, pitch: base.pitch + 0.01, zoom: base.zoom * 1.1 });
  }
}

/** How many custom shots the camera desk can remember. */
export const MAX_SHOT_MEMORIES = 4;

/**
 * Depth-of-field parameters for a shot — pure camera-desk math consumed by
 * every stage's post chain.
 *
 * The lens behaves like a real broadcast camera: the focal plane is racked
 * onto the framing anchor (the point the rig looks at) and the depth of the
 * sharp slice depends on how tight the shot is.
 *
 *  - **Wide / medium shots** — a deep slice keeps the whole dressed set
 *    readable; only the far background rolls off, which is what separates a
 *    photographed set from a flat render.
 *  - **Close-ups** — the slice narrows onto the talent and the bokeh
 *    strengthens, so the set melts behind them (fast-prime look). The push-in
 *    zoom and a telephoto FOV both count as tightness.
 */
export interface StudioDepthOfField {
  /** World point the lens auto-focuses on (the rig's look-at). */
  focusTarget: [number, number, number];
  /** Half-width (± metres) of the sharp slice around the focal plane. */
  focusRange: number;
  /** Circle-of-confusion strength — grows as the shot tightens. */
  bokehScale: number;
}

/** Normal (non-tele) lens the tightness scale is referenced against. */
const REFERENCE_FOV = 38;

export function depthOfFieldForShot(
  zoom: number,
  fov: number | undefined,
  target: [number, number, number] | undefined,
): StudioDepthOfField {
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  const f = Math.max(MIN_FOV, Math.min(MAX_FOV, fov ?? REFERENCE_FOV));
  // Push-in: base framings sit near 1.0, a close-up recall multiplies by ~1.95.
  const zoomTight = clamp01((z - 0.9) / (2.4 - 0.9));
  // Lens: 38° normal → 22° tele counts as extra tightness.
  const fovTight = clamp01((REFERENCE_FOV - f) / (REFERENCE_FOV - MIN_FOV));
  const tight = clamp01(zoomTight + 0.35 * fovTight);
  return {
    focusTarget: target ?? [0, 1.05, 0],
    // ± metres of sharp focus around the focal plane: deep set → tight slice.
    focusRange: 9 - tight * (9 - 1.6),
    // Bokeh becomes visible exactly when the background sits far from focus.
    bokehScale: 1.1 + tight * (2.4 - 1.1),
  };
}

export function emptyShotMemories(): (StudioCameraPreset | null)[] {
  return Array.from({ length: MAX_SHOT_MEMORIES }, () => null);
}

/** Capture the current pose into a memory slot (immutably). */
export function saveShotMemory(
  shots: (StudioCameraPreset | null)[] | undefined,
  index: number,
  pose: StudioCameraPreset,
): (StudioCameraPreset | null)[] {
  const next = normalizeShotMemories(shots);
  if (index < 0 || index >= MAX_SHOT_MEMORIES) return next;
  next[index] = clampCameraPreset(pose);
  return next;
}

/** Memories always come back as a fixed-length, clamped array. */
export function normalizeShotMemories(
  shots: (StudioCameraPreset | null)[] | null | undefined,
): (StudioCameraPreset | null)[] {
  const next = emptyShotMemories();
  for (let i = 0; i < Math.min(shots?.length ?? 0, MAX_SHOT_MEMORIES); i += 1) {
    const shot = shots?.[i];
    next[i] = shot ? clampCameraPreset(shot) : null;
  }
  return next;
}

/* --------------------------------------------------------- look desk */

export type StudioMoodId = 'broadcast' | 'warm' | 'cool' | 'dramatic';

export interface StudioMoodPreset {
  id: StudioMoodId;
  label: string;
  lighting: number;
  temperature: number;
  exposure: number;
}

export const MOOD_PRESETS: StudioMoodPreset[] = [
  { id: 'broadcast', label: 'BROADCAST', lighting: 1, temperature: 0.5, exposure: 1 },
  { id: 'warm', label: 'WARM', lighting: 1.1, temperature: 0.82, exposure: 1.05 },
  { id: 'cool', label: 'COOL', lighting: 0.95, temperature: 0.18, exposure: 0.98 },
  { id: 'dramatic', label: 'DRAMATIC', lighting: 0.8, temperature: 0.62, exposure: 0.92 },
];

export function clampLighting(v: number): number {
  return Math.max(0.6, Math.min(1.6, v));
}

export function clampTemperature(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function clampExposure(v: number): number {
  return Math.max(0.6, Math.min(1.6, v));
}

export function clampBloomIntensity(v: number): number {
  return Math.max(0.15, Math.min(1.2, v));
}

export function clampTickerSpeed(v: number): number {
  return Math.max(0, Math.min(400, v));
}

/* ------------------------------------------------------- light rig grade */

/**
 * Per-category balance of the stage light rig.
 *
 * A real set is lit for its genre: a news desk is a textbook three-point setup
 * (hard-ish key, clean fill, crisp rim that separates the anchor from the LED
 * wall) while a concert stage runs a dark ambient with punchy key/rim, and a
 * living room is soft, warm and bounce-heavy. These multipliers grade the one
 * shared rig per scene category so every set gets the balance its genre
 * demands without hand-tuning each scene.
 */
export interface StudioRigGrade {
  /** Key (main shadow-casting directional) multiplier. */
  key: number;
  /** Softbox fill + ceiling bounce multiplier. */
  fill: number;
  /** Kicker/rim spot multiplier — what separates talent from the set. */
  rim: number;
  /** Hemisphere sky/ground bounce multiplier (ambient fill level). */
  bounce: number;
  /** HDRI image-based lighting multiplier for the set. */
  environment: number;
}

const RIG_GRADES: Record<StudioSceneCategory, StudioRigGrade> = {
  // Broadcast standard three-point: contrasty key, tight ambient, strong rim —
  // the look every news/weather/business set is judged by.
  news: { key: 1.12, fill: 1, rim: 1.18, bounce: 0.95, environment: 1 },
  business: { key: 1.08, fill: 1.02, rim: 1.12, bounce: 1, environment: 1 },
  weather: { key: 1.12, fill: 1.02, rim: 1.18, bounce: 0.95, environment: 1 },
  blank: { key: 1, fill: 1.1, rim: 1, bounce: 1.1, environment: 1 },
  realestate: { key: 1.04, fill: 1.12, rim: 1.06, bounce: 1.1, environment: 1.1 },
  // Arena energy: punchy key + rim so talent pops against a bright bowl.
  sports: { key: 1.15, fill: 1.05, rim: 1.2, bounce: 1, environment: 1.05 },
  // Talk/home/academic: soft and warm — bounce does most of the work.
  talk: { key: 0.95, fill: 1.15, rim: 0.92, bounce: 1.2, environment: 1.1 },
  home: { key: 0.95, fill: 1.18, rim: 0.9, bounce: 1.2, environment: 1.12 },
  academic: { key: 0.98, fill: 1.1, rim: 0.95, bounce: 1.15, environment: 1.08 },
  podcast: { key: 0.95, fill: 1.1, rim: 1, bounce: 1.1, environment: 1.05 },
  // Prestige sets: glinty speculars, controlled ambient.
  luxury: { key: 1.05, fill: 1, rim: 1.15, bounce: 1, environment: 1.15 },
  auction: { key: 1.05, fill: 1, rim: 1.15, bounce: 1, environment: 1.12 },
  // Performance stages: dark room, punchy key and rim, beams read on camera.
  worship: { key: 1.15, fill: 0.85, rim: 1.25, bounce: 0.85, environment: 0.9 },
  music: { key: 1.2, fill: 0.8, rim: 1.3, bounce: 0.8, environment: 0.85 },
  concert: { key: 1.2, fill: 0.78, rim: 1.3, bounce: 0.8, environment: 0.85 },
  // Noir chiaroscuro: nearly all key, ambient almost off.
  cinematic: { key: 1.25, fill: 0.62, rim: 1.2, bounce: 0.7, environment: 0.72 },
  // Bright, even, high-key.
  fitness: { key: 1, fill: 1.22, rim: 1, bounce: 1.18, environment: 1.15 },
  exterior: { key: 1.02, fill: 1.15, rim: 1.05, bounce: 1.12, environment: 1.12 },
  outdoor: { key: 1.02, fill: 1.15, rim: 1.05, bounce: 1.12, environment: 1.12 },
};

/** Rig balance for a scene category (defaults to the broadcast standard). */
export function rigGradeFor(category: StudioSceneCategory): StudioRigGrade {
  return RIG_GRADES[category] ?? RIG_GRADES.news;
}

/** Force every effect override back into its safe range (and boolean). */
export function clampEffectOverrides(
  effects: StudioEffectOverrides | undefined,
): StudioEffectOverrides | undefined {
  if (!effects) return undefined;
  return {
    ...(effects.bloom !== undefined ? { bloom: Boolean(effects.bloom) } : {}),
    ...(effects.bloomIntensity !== undefined
      ? { bloomIntensity: clampBloomIntensity(effects.bloomIntensity) }
      : {}),
    ...(effects.depthOfField !== undefined ? { depthOfField: Boolean(effects.depthOfField) } : {}),
    ...(effects.vignette !== undefined ? { vignette: Boolean(effects.vignette) } : {}),
    ...(effects.ao !== undefined ? { ao: Boolean(effects.ao) } : {}),
    ...(effects.smaa !== undefined ? { smaa: Boolean(effects.smaa) } : {}),
  };
}

/**
 * The rig's white-balance colour for a 0…1 temperature fader.
 *
 * Physically based: the fader is remapped to a kelvin value along the Planckian
 * locus (cool 7500 K → balanced 5600 K → warm 2700 K) and converted through a
 * black-body fit, so the tint matches what a real fixture of that CCT emits.
 */
export function temperatureColor(temperature: number): string {
  return kelvinToHex(temperatureToKelvin(clampTemperature(temperature)));
}

/** The kelvin CCT the temperature fader currently resolves to. */
export function temperatureKelvin(temperature: number): number {
  return temperatureToKelvin(clampTemperature(temperature));
}

/* ------------------------------------------------------------- autocam */

export const MAX_RUNDOWN_STEPS = 24;

/** Rundown steps hold for a sane duration and always carry clamped poses. */
export function clampRundown(
  steps: StudioRundownStep[] | undefined,
): StudioRundownStep[] | undefined {
  if (!steps) return undefined;
  return steps.slice(0, MAX_RUNDOWN_STEPS).map((step) => ({
    label: (step.label || 'Shot').slice(0, 24),
    pose: clampCameraPreset(step.pose),
    duration: Math.max(1, Math.min(60, step.duration)),
  }));
}
