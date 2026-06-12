import type { LayerStackId } from '../types/graphicsStack';
import type { LayerSettings } from '../types/mixer';
import { DEFAULT_LIVE_BUTTON } from '../types/overlays';

const SEED_KEY = 'cloudcast-live-button-seeded';

export function hasSeededLiveButton(): boolean {
  try {
    return localStorage.getItem(SEED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markLiveButtonSeeded(): void {
  try {
    localStorage.setItem(SEED_KEY, '1');
  } catch {
    /* quota */
  }
}

/** First dashboard visit — add LIVE button to stack with PST preview on. */
export function seedFirstTimeLiveButton(partial: Partial<LayerSettings>): Partial<LayerSettings> {
  if (hasSeededLiveButton()) return partial;

  markLiveButtonSeeded();

  const order = partial.graphicsStackOrder ?? [];
  const withLiveButton: LayerStackId[] = order.includes('live-button')
    ? [...order]
    : (() => {
        const next = [...order];
        const ltIdx = next.indexOf('lower-third');
        if (ltIdx >= 0) next.splice(ltIdx, 0, 'live-button');
        else next.splice(1, 0, 'live-button');
        return next;
      })();

  return {
    ...partial,
    showLiveButton: true,
    liveButton: { ...DEFAULT_LIVE_BUTTON, ...partial.liveButton },
    graphicsStackOrder: withLiveButton,
  };
}
