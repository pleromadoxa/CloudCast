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
