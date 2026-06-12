/** CloudCast Symphony project & arrangement types. */

export type InstrumentCategory =
  | 'synth_lead'
  | 'synth_pad'
  | 'synth_bass'
  | 'strings'
  | 'brass'
  | 'drums'
  | 'percussion'
  | 'vocals'
  | 'fx';

export type TrackColor = 'green' | 'blue' | 'purple' | 'yellow' | 'orange' | 'red' | 'cyan';

export interface InstrumentPreset {
  id: string;
  name: string;
  category: InstrumentCategory;
  description: string;
  /** Web Audio synthesis parameters */
  oscType: OscillatorType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterFreq?: number;
  detune?: number;
  /** For string sections — number of voices */
  voices?: number;
}

export interface LoopItem {
  id: string;
  name: string;
  bpm: number;
  bars: number;
  tags: string[];
  category: InstrumentCategory;
  /** Pattern data as MIDI-like note events */
  pattern: NoteEvent[];
}

export interface NoteEvent {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
}

export interface AutomationPoint {
  /** 0-based bar on timeline. */
  bar: number;
  /** Beat within bar (0–3.999). */
  beat: number;
  /** Volume 0–100. */
  value: number;
}

export interface TimelineMarker {
  id: string;
  /** 0-based bar. */
  bar: number;
  name: string;
}

export interface Region {
  id: string;
  trackId: string;
  name: string;
  startBar: number;
  lengthBars: number;
  loopId?: string;
  notes?: NoteEvent[];
  color?: TrackColor;
  /** Semitone offset applied at playback. */
  transpose?: number;
  /** Region level 0–200 (100 = unity). */
  gain?: number;
  /** Mute this region without muting the track. */
  muted?: boolean;
  /** Time-stretch factor (1 = normal, 1.5 = slower/longer). */
  stretchFactor?: number;
}

export interface Track {
  id: string;
  index: number;
  name: string;
  color: TrackColor;
  instrumentId: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  armed: boolean;
  /** Reverb send 0–100. */
  reverbSend?: number;
  /** Volume automation points (absolute timeline position). */
  volumeAutomation?: AutomationPoint[];
}

export interface SymphonyProject {
  id: string;
  name: string;
  tempo: number;
  timeSignature: [number, number];
  key: string;
  tracks: Track[];
  regions: Region[];
  /** Loop playback between these bars (0-based). */
  cycleStartBar?: number;
  cycleEndBar?: number;
  useCycleRegion?: boolean;
  /** Named timeline locators. */
  markers?: TimelineMarker[];
  /** Master output 0–100 (default 85). */
  masterVolume?: number;
  /** Limiter threshold in dB (default -18). */
  limiterThreshold?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CloudProjectMeta {
  id: string;
  name: string;
  storagePath: string;
  sizeBytes: number;
  updatedAt: string;
}
