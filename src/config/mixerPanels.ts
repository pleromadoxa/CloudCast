import type { LucideIcon } from 'lucide-react';
import {
  Film,
  Globe,
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

/** Panels surfaced in simple production view (small live events). */
export const SIMPLE_PRODUCTION_PANELS: MixerPanel[] = ['sources', 'transitions', 'stream', 'audio'];

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
  {
    id: 'media',
    icon: Film,
    label: 'Media',
    description: 'Upload images and videos — overlay on preview or program, drag to position.',
  },
  {
    id: 'browser',
    icon: Globe,
    label: 'Browser',
    description: 'Open a webpage or YouTube shot, interact, mute, and take to PGM.',
  },
];
