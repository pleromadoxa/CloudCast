import type { KeySettings } from '../types/mixer';
import { DEFAULT_CHROMA_BACKGROUND_ID } from '../types/chromaBackgrounds';
import { CHROMA_KEY_GREEN } from './chromaKeyColor';
import { resolveChromaBackgroundId } from './chromaBackgrounds';

export const DEFAULT_KEY_SETTINGS: KeySettings = {
  keyType: 'chroma',
  color: CHROMA_KEY_GREEN,
  tolerance: 40,
  lumaThreshold: 28,
  enabled: false,
  fillSource: 'preset',
  backgroundId: DEFAULT_CHROMA_BACKGROUND_ID,
};

export function normalizeKeySettings(partial?: Partial<KeySettings>): KeySettings {
  return {
    ...DEFAULT_KEY_SETTINGS,
    ...partial,
    keyType: partial?.keyType === 'luma' ? 'luma' : 'chroma',
    backgroundId: resolveChromaBackgroundId(partial?.backgroundId ?? DEFAULT_KEY_SETTINGS.backgroundId),
    fillSource: partial?.fillSource === 'camera' ? 'camera' : 'preset',
  };
}
