import type { StudioCameraPreset, StudioEffectOverrides, StudioRundownStep } from './types';
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
