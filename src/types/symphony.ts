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
  /** Parameter value (see lane parameter for range). */
  value: number;
}

/** Automatable mixer parameters. Volume/pan/send are 0–100 (pan −100…100). */
export type AutomationParam = 'volume' | 'pan' | 'reverbSend' | 'delaySend';

export interface AutomationLane {
  param: AutomationParam;
  points: AutomationPoint[];
  /** Lane read state — when false, lane is drawn but not applied. */
  enabled?: boolean;
}

/* ── Processing plugin (insert FX) settings ── */

export interface EqSettings {
  /** dB, −15…+15 */
  low: number;
  mid: number;
  high: number;
  /** Mid band center Hz 200…5000 */
  midFreq: number;
}

export interface CompressorSettings {
  enabled: boolean;
  /** dB −60…0 */
  thresholdDb: number;
  /** 1…20 */
  ratio: number;
  /** ms 0…200 */
  attackMs: number;
  /** ms 10…1000 */
  releaseMs: number;
}

export interface FilterSettings {
  enabled: boolean;
  type: 'lowpass' | 'highpass' | 'bandpass';
  /** Hz 40…18000 */
  freq: number;
  /** Q 0.2…18 */
  q: number;
}

export interface ChorusSettings {
  enabled: boolean;
  /** Hz 0.05…5 */
  rateHz: number;
  /** ms 0.5…12 */
  depthMs: number;
  /** 0–100 */
  mix: number;
}

export interface TrackFx {
  eq: EqSettings;
  comp: CompressorSettings;
  filter: FilterSettings;
  chorus: ChorusSettings;
  /** Soft saturation 0–100 (0 = clean). */
  drive: number;
}

export const DEFAULT_EQ: EqSettings = { low: 0, mid: 0, high: 0, midFreq: 1000 };
export const DEFAULT_COMP: CompressorSettings = {
  enabled: false, thresholdDb: -18, ratio: 3, attackMs: 10, releaseMs: 180,
};
export const DEFAULT_FILTER: FilterSettings = { enabled: false, type: 'lowpass', freq: 8000, q: 0.9 };
export const DEFAULT_CHORUS: ChorusSettings = { enabled: false, rateHz: 0.8, depthMs: 4, mix: 40 };

export function defaultTrackFx(): TrackFx {
  return {
    eq: { ...DEFAULT_EQ },
    comp: { ...DEFAULT_COMP },
    filter: { ...DEFAULT_FILTER },
    chorus: { ...DEFAULT_CHORUS },
    drive: 0,
  };
}

/** Merge partial FX patches onto defaults (safe against legacy/absent data). */
export function normalizeTrackFx(fx?: Partial<TrackFx> | null): TrackFx {
  const base = defaultTrackFx();
  if (!fx) return base;
  return {
    eq: { ...base.eq, ...fx.eq },
    comp: { ...base.comp, ...fx.comp },
    filter: { ...base.filter, ...fx.filter },
    chorus: { ...base.chorus, ...fx.chorus },
    drive: fx.drive ?? base.drive,
  };
}

/* ── Export configuration ── */

export type ExportFormat = 'wav' | 'aiff' | 'mp3';
export type ExportRange = 'project' | 'cycle';

export interface ExportSettings {
  format: ExportFormat;
  /** 44100 | 48000 | 96000 */
  sampleRate: number;
  /** PCM depth for WAV/AIFF: 16 | 24 */
  bitDepth: 16 | 24;
  /** MP3 bitrate kbps: 128 | 192 | 256 | 320 */
  mp3BitrateKbps: 128 | 192 | 256 | 320;
  /** Peak-normalize to −1 dBFS before encoding. */
  normalize: boolean;
  /** Render only the cycle region when set, else whole project. */
  range: ExportRange;
  /** Include 2s of reverb/delay tail after the last region. */
  includeTail: boolean;
  fileName: string;
}

export function defaultExportSettings(name: string): ExportSettings {
  return {
    format: 'wav',
    sampleRate: 44100,
    bitDepth: 16,
    mp3BitrateKbps: 192,
    normalize: true,
    range: 'project',
    includeTail: true,
    fileName: name,
  };
}

/** Meter ballistics & console preferences (persisted locally). */
export interface SymphonyPrefs {
  /** Peak hold time ms 0–5000 (0 = off). */
  peakHoldMs: number;
  /** Meter decay dB/s 6–48. */
  meterDecayDbPerSec: number;
  /** Knob drag sensitivity 0.5–2. */
  knobSensitivity: number;
  /** Show value arcs & dB legends on hardware controls. */
  showValueArcs: boolean;
  /** Brushed-metal texture grain opacity 0–100. */
  metalGrain: number;
  /** Default export settings for the export dialog. */
  exportDefaults?: Partial<ExportSettings>;
}

export const DEFAULT_SYMPHONY_PREFS: SymphonyPrefs = {
  peakHoldMs: 1600,
  meterDecayDbPerSec: 24,
  knobSensitivity: 1,
  showValueArcs: true,
  metalGrain: 100,
};

export interface TimelineMarker {
  id: string;
  /** 0-based bar. */
  bar: number;
  name: string;
}

/** A chord symbol governing part of the timeline (chord track). */
export interface ChordEvent {
  /** 0-based bar. */
  bar: number;
  lengthBars: number;
  /** Chord symbol, e.g. "Am7", "C#dim", "Bb/F". */
  chord: string;
}

/** Song-structure section (Logic arrangement markers). */
export interface ArrangementSection {
  id: string;
  /** Intro | Verse | Pre-Chorus | Chorus | Bridge | Breakdown | Build | Drop | Solo | Outro */
  name: string;
  startBar: number;
  lengthBars: number;
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
  /** Tempo-synced stereo delay send 0–100. */
  delaySend?: number;
  /** Insert FX chain (EQ / comp / filter / chorus / drive). */
  fx?: TrackFx;
  /** Volume automation points (absolute timeline position). */
  volumeAutomation?: AutomationPoint[];
  /** Full automation lanes (volume, pan, sends). */
  automationLanes?: AutomationLane[];
  /** Channel strip width in the mixer (number of visible knob rows). */
  stripExpanded?: boolean;
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
  /** Chord track (one chord per bar span). */
  chordTrack?: ChordEvent[];
  /** Song arrangement sections (Intro/Verse/Chorus…). */
  arrangement?: ArrangementSection[];
  /** Global swing amount 0–100 applied by generation & quantize. */
  swing?: number;
  /** Master output 0–100 (default 85). */
  masterVolume?: number;
  /** Limiter threshold in dB (default -18). */
  limiterThreshold?: number;
  /** Master bus EQ (dB, −15…+15). */
  masterEq?: EqSettings;
  /** Master soft saturation 0–100. */
  masterDrive?: number;
  /** Bypass the master limiter/soft clip. */
  limiterEnabled?: boolean;
  /** Metronome click level 0–100. */
  metronomeVolume?: number;
  /** Count-in bars before recording/playback (0 | 1 | 2 | 4). */
  countInBars?: number;
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
