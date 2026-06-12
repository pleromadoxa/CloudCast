import type { InstrumentPreset } from '../../types/symphony';

/** Regal Symphony synthesizer & orchestral instrument library. */
export const INSTRUMENT_LIBRARY: InstrumentPreset[] = [
  // Synth Leads
  { id: 'synth-lead-bright', name: 'Bright Lead', category: 'synth_lead', description: 'Cutting sawtooth lead', oscType: 'sawtooth', attack: 0.01, decay: 0.15, sustain: 0.7, release: 0.3, filterFreq: 2400 },
  { id: 'synth-lead-pluck', name: 'Pluck Lead', category: 'synth_lead', description: 'Short plucked synth', oscType: 'square', attack: 0.005, decay: 0.2, sustain: 0.1, release: 0.15, filterFreq: 1800 },
  { id: 'synth-lead-supersaw', name: 'Super Saw', category: 'synth_lead', description: 'Wide detuned saw stack', oscType: 'sawtooth', attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.4, detune: 12, filterFreq: 3200 },
  { id: 'synth-lead-arp', name: 'Arp Lead', category: 'synth_lead', description: 'Arpeggiated triangle lead', oscType: 'triangle', attack: 0.01, decay: 0.08, sustain: 0.5, release: 0.2, filterFreq: 2000 },

  // Synth Pads
  { id: 'synth-pad-warm', name: 'Warm Pad', category: 'synth_pad', description: 'Lush analog-style pad', oscType: 'sine', attack: 0.8, decay: 0.5, sustain: 0.9, release: 1.2, filterFreq: 800 },
  { id: 'synth-pad-ambient', name: 'Ambient Pad', category: 'synth_pad', description: 'Ethereal atmosphere', oscType: 'triangle', attack: 1.2, decay: 0.6, sustain: 0.85, release: 2.0, filterFreq: 600 },
  { id: 'synth-pad-glass', name: 'Glass Pad', category: 'synth_pad', description: 'Crystalline harmonic pad', oscType: 'sine', attack: 0.4, decay: 0.3, sustain: 0.7, release: 0.8, filterFreq: 1400, detune: 7 },

  // Synth Bass
  { id: 'synth-bass-sub', name: 'Sub Bass', category: 'synth_bass', description: 'Deep sub oscillator', oscType: 'sine', attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.15, filterFreq: 120 },
  { id: 'synth-bass-reese', name: 'Reese Bass', category: 'synth_bass', description: 'Detuned reese bass', oscType: 'sawtooth', attack: 0.01, decay: 0.05, sustain: 0.95, release: 0.1, detune: 18, filterFreq: 400 },
  { id: 'synth-bass-pluck', name: 'Pluck Bass', category: 'synth_bass', description: 'Punchy pluck bass', oscType: 'square', attack: 0.002, decay: 0.25, sustain: 0.2, release: 0.1, filterFreq: 600 },

  // Strings
  { id: 'strings-legato', name: 'Legato Strings', category: 'strings', description: 'Smooth sustained strings', oscType: 'sawtooth', attack: 0.6, decay: 0.3, sustain: 0.85, release: 0.9, filterFreq: 1200, voices: 4 },
  { id: 'strings-staccato', name: 'Staccato Strings', category: 'strings', description: 'Short bow strokes', oscType: 'sawtooth', attack: 0.02, decay: 0.15, sustain: 0.3, release: 0.1, filterFreq: 1600, voices: 3 },
  { id: 'strings-pizzicato', name: 'Pizzicato', category: 'strings', description: 'Plucked string section', oscType: 'triangle', attack: 0.001, decay: 0.12, sustain: 0.05, release: 0.08, filterFreq: 2000, voices: 2 },
  { id: 'strings-tremolo', name: 'Tremolo Strings', category: 'strings', description: 'Tremolo orchestral section', oscType: 'sawtooth', attack: 0.3, decay: 0.2, sustain: 0.75, release: 0.5, filterFreq: 1400, voices: 5 },
  { id: 'strings-chamber', name: 'Chamber Ensemble', category: 'strings', description: 'Intimate chamber strings', oscType: 'sine', attack: 0.4, decay: 0.25, sustain: 0.8, release: 0.7, filterFreq: 1000, voices: 3 },

  // Brass
  { id: 'brass-horn', name: 'French Horn', category: 'brass', description: 'Warm horn section', oscType: 'sawtooth', attack: 0.15, decay: 0.2, sustain: 0.8, release: 0.4, filterFreq: 900 },
  { id: 'brass-trumpet', name: 'Trumpet Section', category: 'brass', description: 'Bright trumpet ensemble', oscType: 'square', attack: 0.05, decay: 0.1, sustain: 0.85, release: 0.3, filterFreq: 1800 },

  // Drums & Percussion
  { id: 'drums-kit', name: 'Studio Kit', category: 'drums', description: 'Full drum kit', oscType: 'sine', attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
  { id: 'drums-trap', name: 'Trap Kit', category: 'drums', description: '808 trap drums', oscType: 'sine', attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
  { id: 'perc-shaker', name: 'Shaker Loop', category: 'percussion', description: 'Rhythmic shaker', oscType: 'triangle', attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },

  // Vocals & FX
  { id: 'vocals-chops', name: 'Vocal Chops', category: 'vocals', description: 'Chopped vocal samples', oscType: 'sawtooth', attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.2, filterFreq: 2200 },
  { id: 'fx-riser', name: 'Riser FX', category: 'fx', description: 'Build-up riser', oscType: 'sawtooth', attack: 2.0, decay: 0.5, sustain: 0.9, release: 0.8, filterFreq: 4000 },
  { id: 'fx-impact', name: 'Impact Hit', category: 'fx', description: 'Cinematic impact', oscType: 'sine', attack: 0.001, decay: 0.5, sustain: 0, release: 0.3, filterFreq: 200 },
];

export const INSTRUMENT_CATEGORIES = [
  { id: 'synth_lead', label: 'Synth Leads' },
  { id: 'synth_pad', label: 'Synth Pads' },
  { id: 'synth_bass', label: 'Synth Bass' },
  { id: 'strings', label: 'Strings' },
  { id: 'brass', label: 'Brass' },
  { id: 'drums', label: 'Drums' },
  { id: 'percussion', label: 'Percussion' },
  { id: 'vocals', label: 'Vocals' },
  { id: 'fx', label: 'FX' },
] as const;

export function getInstrument(id: string): InstrumentPreset {
  return INSTRUMENT_LIBRARY.find((i) => i.id === id) ?? INSTRUMENT_LIBRARY[0];
}
