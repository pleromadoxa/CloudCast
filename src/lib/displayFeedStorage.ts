import type { DisplayFeedState } from '../types/displayFeed';
import { createDefaultDisplayFeedState } from '../types/displayFeed';

const STORAGE_KEY = 'cloudcast-regal-display';

export function loadDisplayFeedState(): DisplayFeedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultDisplayFeedState();
    const parsed = JSON.parse(raw) as DisplayFeedState;
    if (!parsed.slides?.length) return createDefaultDisplayFeedState();
    return {
      ...createDefaultDisplayFeedState(),
      ...parsed,
      scripturePresets: parsed.scripturePresets ?? [],
      customTemplates: parsed.customTemplates ?? [],
      keyMode: parsed.keyMode ?? false,
      defaultBibleTranslation: parsed.defaultBibleTranslation ?? 'web',
      showCongregationClock: parsed.showCongregationClock ?? false,
    };
  } catch {
    return createDefaultDisplayFeedState();
  }
}

export function saveDisplayFeedState(state: DisplayFeedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}
