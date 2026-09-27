/**
 * Persistent Symphony console preferences (meter ballistics, control feel,
 * texture, export defaults). Stored locally per browser.
 */
import {
  DEFAULT_SYMPHONY_PREFS,
  type ExportSettings,
  type SymphonyPrefs,
} from '../../types/symphony';

const STORAGE_KEY = 'cloudcast.symphony.prefs.v1';

export function loadSymphonyPrefs(): SymphonyPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SYMPHONY_PREFS };
    const parsed = JSON.parse(raw) as Partial<SymphonyPrefs>;
    return {
      ...DEFAULT_SYMPHONY_PREFS,
      ...parsed,
      exportDefaults: { ...parsed.exportDefaults },
    };
  } catch {
    return { ...DEFAULT_SYMPHONY_PREFS };
  }
}

export function saveSymphonyPrefs(prefs: SymphonyPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* storage unavailable — prefs stay in-memory */ }
}

export function mergeExportDefaults(
  prefs: SymphonyPrefs,
  base: ExportSettings,
): ExportSettings {
  return { ...base, ...prefs.exportDefaults, fileName: base.fileName };
}
