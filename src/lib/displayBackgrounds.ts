import type { CSSProperties } from 'react';
import type { DisplayBackground } from '../types/displayFeed';

export interface DisplayBackgroundPreset {
  id: string;
  name: string;
  category: 'worship' | 'modern' | 'nature' | 'solid' | 'gradient';
  preview: string;
  css: string;
}

/** EasyWorship-style background presets — gradients and atmospheric fills. */
export const DISPLAY_BACKGROUND_PRESETS: DisplayBackgroundPreset[] = [
  {
    id: 'worship-deep-blue',
    name: 'Deep Blue',
    category: 'worship',
    preview: 'linear-gradient(160deg, #0f172a 0%, #1e3a5f 50%, #0c1929 100%)',
    css: 'linear-gradient(160deg, #0f172a 0%, #1e3a5f 50%, #0c1929 100%)',
  },
  {
    id: 'worship-purple-glow',
    name: 'Purple Glow',
    category: 'worship',
    preview: 'radial-gradient(ellipse at 50% 30%, #4c1d95 0%, #1e1b4b 45%, #0f0a1a 100%)',
    css: 'radial-gradient(ellipse at 50% 30%, #4c1d95 0%, #1e1b4b 45%, #0f0a1a 100%)',
  },
  {
    id: 'worship-golden-hour',
    name: 'Golden Hour',
    category: 'worship',
    preview: 'linear-gradient(180deg, #78350f 0%, #451a03 40%, #1c1917 100%)',
    css: 'linear-gradient(180deg, #78350f 0%, #451a03 40%, #1c1917 100%)',
  },
  {
    id: 'worship-emerald',
    name: 'Emerald Sanctuary',
    category: 'worship',
    preview: 'linear-gradient(145deg, #064e3b 0%, #022c22 60%, #0a0a0a 100%)',
    css: 'linear-gradient(145deg, #064e3b 0%, #022c22 60%, #0a0a0a 100%)',
  },
  {
    id: 'modern-slate',
    name: 'Modern Slate',
    category: 'modern',
    preview: 'linear-gradient(135deg, #334155 0%, #1e293b 50%, #0f172a 100%)',
    css: 'linear-gradient(135deg, #334155 0%, #1e293b 50%, #0f172a 100%)',
  },
  {
    id: 'modern-rose',
    name: 'Rose Fade',
    category: 'modern',
    preview: 'radial-gradient(circle at 70% 20%, #881337 0%, #1a1a2e 55%, #0a0a0a 100%)',
    css: 'radial-gradient(circle at 70% 20%, #881337 0%, #1a1a2e 55%, #0a0a0a 100%)',
  },
  {
    id: 'nature-forest',
    name: 'Forest Mist',
    category: 'nature',
    preview: 'linear-gradient(180deg, #14532d 0%, #052e16 50%, #0a0a0a 100%)',
    css: 'linear-gradient(180deg, #14532d 0%, #052e16 50%, #0a0a0a 100%)',
  },
  {
    id: 'nature-ocean',
    name: 'Ocean Depth',
    category: 'nature',
    preview: 'linear-gradient(180deg, #0c4a6e 0%, #082f49 50%, #020617 100%)',
    css: 'linear-gradient(180deg, #0c4a6e 0%, #082f49 50%, #020617 100%)',
  },
  {
    id: 'solid-black',
    name: 'Pure Black',
    category: 'solid',
    preview: '#000000',
    css: '#000000',
  },
  {
    id: 'solid-charcoal',
    name: 'Charcoal',
    category: 'solid',
    preview: '#1a1a1a',
    css: '#1a1a1a',
  },
  {
    id: 'solid-white',
    name: 'Clean White',
    category: 'solid',
    preview: '#f8fafc',
    css: '#f8fafc',
  },
  {
    id: 'gradient-broadcast',
    name: 'Broadcast',
    category: 'gradient',
    preview: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    css: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
  {
    id: 'gradient-sunset',
    name: 'Sunset',
    category: 'gradient',
    preview: 'linear-gradient(180deg, #7c2d12 0%, #431407 30%, #1c1917 100%)',
    css: 'linear-gradient(180deg, #7c2d12 0%, #431407 30%, #1c1917 100%)',
  },
  {
    id: 'gradient-aurora',
    name: 'Aurora',
    category: 'gradient',
    preview: 'linear-gradient(160deg, #312e81 0%, #065f46 40%, #0f172a 100%)',
    css: 'linear-gradient(160deg, #312e81 0%, #065f46 40%, #0f172a 100%)',
  },
];

export function resolveBackgroundStyle(bg: DisplayBackground): CSSProperties {
  if (bg.kind === 'color' && bg.color) {
    return { background: bg.color };
  }
  if (bg.kind === 'image' && bg.imageUrl) {
    return {
      backgroundImage: `url(${bg.imageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  const preset = DISPLAY_BACKGROUND_PRESETS.find((p) => p.id === bg.presetId);
  if (preset) {
    return { background: preset.css };
  }
  return { background: DISPLAY_BACKGROUND_PRESETS[0].css };
}

export function getPresetById(id: string): DisplayBackgroundPreset | undefined {
  return DISPLAY_BACKGROUND_PRESETS.find((p) => p.id === id);
}
