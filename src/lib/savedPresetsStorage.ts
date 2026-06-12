import type { SavedLowerThirdPreset } from '../types/overlays';

const STORAGE_KEY = 'cloudcast-lower-third-presets';

export function loadSavedLowerThirdPresets(): SavedLowerThirdPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedLowerThirdPreset[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

export function saveSavedLowerThirdPresets(presets: SavedLowerThirdPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets.slice(0, 24)));
  } catch {
    /* quota */
  }
}

export function upsertSavedLowerThirdPreset(preset: SavedLowerThirdPreset): SavedLowerThirdPreset[] {
  const existing = loadSavedLowerThirdPresets().filter((p) => p.id !== preset.id);
  const next = [{ ...preset, updatedAt: Date.now() }, ...existing];
  saveSavedLowerThirdPresets(next);
  return next;
}

export function deleteSavedLowerThirdPreset(id: string): SavedLowerThirdPreset[] {
  const next = loadSavedLowerThirdPresets().filter((p) => p.id !== id);
  saveSavedLowerThirdPresets(next);
  return next;
}
