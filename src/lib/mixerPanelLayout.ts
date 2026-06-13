import type { MixerPanel } from '../types/mixer';

const PANEL_HEIGHT_TIER: Record<MixerPanel, number> = {
  sources: 1,
  transitions: 1,
  stream: 2,
  audio: 2,
  devices: 3,
  layers: 4,
  settings: 4,
};

const VALID_MIXER_PANELS: MixerPanel[] = [
  'sources',
  'layers',
  'audio',
  'transitions',
  'devices',
  'stream',
  'settings',
];

export function normalizeOpenPanels(
  panels: MixerPanel[] | undefined,
  fallback: MixerPanel = 'sources',
): MixerPanel[] {
  const filtered = (panels ?? []).filter((p) => VALID_MIXER_PANELS.includes(p));
  const unique = [...new Set(filtered)];
  return unique.length > 0 ? unique : [fallback];
}

/** Minimum column width (px) when 1–2 panels are open; scales down as more panels open. */
export const PANEL_MIN_WIDTH: Record<MixerPanel, number> = {
  sources: 260,
  transitions: 220,
  stream: 260,
  audio: 280,
  devices: 300,
  layers: 340,
  settings: 300,
};

const PANEL_TRACK_WEIGHT: Partial<Record<MixerPanel, number>> = {
  layers: 2,
  devices: 1.25,
  settings: 1.2,
  audio: 1.15,
};

function scaledPanelMin(panel: MixerPanel, openCount: number): number {
  const base = PANEL_MIN_WIDTH[panel];
  if (openCount <= 2) return base;
  if (openCount === 3) return Math.round(base * 0.82);
  return Math.round(base * 0.7);
}

export function resolveMultiPanelGridColumns(panels: MixerPanel[]): string {
  const openCount = panels.length;
  return panels
    .map((panel) => {
      const min = scaledPanelMin(panel, openCount);
      const weight = PANEL_TRACK_WEIGHT[panel] ?? 1;
      return `minmax(${min}px, ${weight}fr)`;
    })
    .join(' ');
}

/** Pick the tallest open panel so multi-panel mode gets enough vertical space. */
export function resolveChassisPanelClass(
  openPanels: MixerPanel[],
  activePanel: MixerPanel,
): string {
  const panels = openPanels.length > 0 ? openPanels : [activePanel];
  let tallest: MixerPanel = panels[0];
  let maxTier = PANEL_HEIGHT_TIER[tallest];

  for (const panel of panels) {
    const tier = PANEL_HEIGHT_TIER[panel];
    if (tier > maxTier) {
      maxTier = tier;
      tallest = panel;
    }
  }

  return `atem-chassis--${tallest}`;
}
