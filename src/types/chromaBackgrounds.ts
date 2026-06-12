export type ChromaBackgroundCategory = 'plain' | 'gradient' | 'animated';

export type ChromaBackgroundId =
  | 'plain-white'
  | 'plain-black'
  | 'plain-studio-gray'
  | 'plain-soft-blue'
  | 'gradient-sunset'
  | 'gradient-ocean'
  | 'gradient-purple-haze'
  | 'gradient-broadcast'
  | 'gradient-emerald'
  | 'gradient-midnight'
  | 'anim-gradient-flow'
  | 'anim-aurora'
  | 'anim-broadcast-pulse'
  | 'anim-neon-wave'
  | 'anim-deep-mesh';

export interface ChromaBackgroundPreset {
  id: ChromaBackgroundId;
  name: string;
  category: ChromaBackgroundCategory;
}

export const CHROMA_BACKGROUND_PRESETS: ChromaBackgroundPreset[] = [
  { id: 'plain-white', name: 'Studio White', category: 'plain' },
  { id: 'plain-black', name: 'Studio Black', category: 'plain' },
  { id: 'plain-studio-gray', name: 'Neutral Gray', category: 'plain' },
  { id: 'plain-soft-blue', name: 'Soft Blue', category: 'plain' },
  { id: 'gradient-sunset', name: 'Sunset', category: 'gradient' },
  { id: 'gradient-ocean', name: 'Ocean Deep', category: 'gradient' },
  { id: 'gradient-purple-haze', name: 'Purple Haze', category: 'gradient' },
  { id: 'gradient-broadcast', name: 'Broadcast', category: 'gradient' },
  { id: 'gradient-emerald', name: 'Emerald', category: 'gradient' },
  { id: 'gradient-midnight', name: 'Midnight', category: 'gradient' },
  { id: 'anim-gradient-flow', name: 'Flowing Gradient', category: 'animated' },
  { id: 'anim-aurora', name: 'Aurora', category: 'animated' },
  { id: 'anim-broadcast-pulse', name: 'On-Air Pulse', category: 'animated' },
  { id: 'anim-neon-wave', name: 'Neon Wave', category: 'animated' },
  { id: 'anim-deep-mesh', name: 'Deep Mesh', category: 'animated' },
];

export const DEFAULT_CHROMA_BACKGROUND_ID: ChromaBackgroundId = 'gradient-broadcast';
