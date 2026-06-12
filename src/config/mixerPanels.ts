import type { LucideIcon } from 'lucide-react';
import {
  HardDrive,
  Image,
  Layers,
  Radio,
  Settings,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import type { MixerPanel } from '../types/mixer';

export interface MixerPanelMeta {
  id: MixerPanel;
  icon: LucideIcon;
  label: string;
  description: string;
}

/** Primary production panels shown in the 2×2 multi-panel grid under source inputs. */
export const CORE_MIXER_PANELS: MixerPanel[] = ['sources', 'layers', 'audio', 'transitions'];

export const MIXER_PANELS: MixerPanelMeta[] = [
  {
    id: 'sources',
    icon: Image,
    label: 'Sources',
    description: 'Route cameras to preview and program, PiP, and cuts.',
  },
  {
    id: 'layers',
    icon: Layers,
    label: 'Layers',
    description: 'Lower thirds, logos, and on-screen graphics.',
  },
  {
    id: 'audio',
    icon: SlidersHorizontal,
    label: 'Audio',
    description: 'Monitor and PGM levels, mutes, and input routing.',
  },
  {
    id: 'transitions',
    icon: Zap,
    label: 'Trans',
    description: 'Cut, take, and transition effects between sources.',
  },
  {
    id: 'devices',
    icon: HardDrive,
    label: 'Devices',
    description: 'Pair phones, stream quality, and IP cameras.',
  },
  {
    id: 'stream',
    icon: Radio,
    label: 'Stream',
    description: 'Go live to YouTube, RTMP, and connection tests.',
  },
  {
    id: 'settings',
    icon: Settings,
    label: 'Setup',
    description: 'Layout, shortcuts, recording, display options, and platform guide.',
  },
];
