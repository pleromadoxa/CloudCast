import type {
  InstrumentPreset, NoteEvent, Region, SymphonyProject, Track, TrackFx,
} from '../../types/symphony';
import { normalizeTrackFx } from '../../types/symphony';
import { getInstrument } from './instruments';
import { applyRegionNoteTransform } from './noteUtils';
import {
  laneValueToParam, scheduleLaneRamp, staticParamValue, trackLanes,
} from './automationSchedule';
import {
  buildReverbImpulseResponse, createDelayBus, createMasterChain, createTrackFxChain,
  type FxChain, type MasterChain,
} from './fxChain';

const MIDI_TO_FREQ = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const MAX_TRACKS_ANALYSED = 64;

interface TrackNodes {
  /** Instrument / plugin injection point. */
  bus: GainNode;
  fx: FxChain;
  panner: StereoPannerNode;
  fader: GainNode;
  reverbSend: GainNode;
  delaySend: GainNode;
  analyser: AnalyserNode;
}

interface LiveVoice {
  osc: OscillatorNode;
  gain: GainNode;
  filter: BiquadFilterNode;
}

interface MeterSnapshot {
  level: number;
  peak: number;
}

function analyseNode(node: AnalyserNode): MeterSnapshot {
  const bins = node.frequencyBinCount;
  const data = new Uint8Array(bins);
  node.getByteTimeDomainData(data);
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < bins; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
    peak = Math.max(peak, Math.abs(v));
  }
  const rms = Math.sqrt(sum / bins);
  return { level: Math.min(1, rms * 2.2), peak: Math.min(1, peak) };
}

export class SymphonyAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterChain: MasterChain | null = null;
  private reverbInput: GainNode | null = null;
  private reverbConvolver: ConvolverNode | null = null;
  private reverbReturn: GainNode | null = null;
  private delayBus: ReturnType<typeof createDelayBus> | null = null;
  private trackNodes = new Map<string, TrackNodes>();
  private scheduled: AudioNode[] = [];
  private liveNotes = new Map<string, LiveVoice>();
  private _playing = false;
  private _paused = false;
  private _position = 0;
  private startTime = 0;
  private rafId = 0;
  private currentProject: SymphonyProject | null = null;
  private currentLoop = false;
  private metronomeEnabled = false;
  private metronomeVolume = 70;
  private lastMetronomeBeat = -1;
  onPositionChange?: (bar: number, beat: number, tick: number) => void;
  onPlaybackEnd?: () => void;

  get playing() { return this._playing && !this._paused; }
  get paused() { return this._paused; }
  get position() { return this._position; }
  get context() { return this.ctx; }

  async init(): Promise<void> {
    if (this.ctx) return;
    this.ctx = new AudioContext();

    // Master bus: volume → EQ/drive/limiter chain → output.
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85 * 0.85;
    this.masterChain = createMasterChain(this.ctx, {});
    this.masterGain.connect(this.masterChain.input);
    this.masterChain.output.connect(this.ctx.destination);

    // Convolution reverb bus (generated stereo impulse response).
    this.reverbInput = this.ctx.createGain();
    this.reverbInput.gain.value = 0.45;
    this.reverbConvolver = this.ctx.createConvolver();
    this.reverbConvolver.buffer = buildReverbImpulseResponse(this.ctx, 2.2, 2.6);
    this.reverbReturn = this.ctx.createGain();
    this.reverbReturn.gain.value = 0.9;
    this.reverbInput.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbReturn);
    this.reverbReturn.connect(this.masterChain.input);

    // Tempo-synced stereo delay bus.
    this.delayBus = createDelayBus(this.ctx, 120);
    this.delayBus.output.connect(this.masterChain.input);
  }

  setMetronomeEnabled(on: boolean): void {
    this.metronomeEnabled = on;
    if (!on) this.lastMetronomeBeat = -1;
  }

  private ensureTrackNodes(trackId: string, fx?: Partial<TrackFx>): TrackNodes {
    if (!this.ctx || !this.masterGain || !this.reverbInput || !this.delayBus) {
      throw new Error('AudioContext not initialized');
    }
    let nodes = this.trackNodes.get(trackId);
    if (!nodes) {
      const bus = this.ctx.createGain();
      const chain = createTrackFxChain(this.ctx, fx);
      const panner = this.ctx.createStereoPanner();
      const fader = this.ctx.createGain();
      const reverbSend = this.ctx.createGain();
      reverbSend.gain.value = 0;
      const delaySend = this.ctx.createGain();
      delaySend.gain.value = 0;
      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.35;

      bus.connect(chain.input);
      chain.output.connect(panner);
      panner.connect(fader);
      fader.connect(analyser);
      analyser.connect(this.masterGain);
      bus.connect(reverbSend);
      reverbSend.connect(this.reverbInput);
      bus.connect(delaySend);
      delaySend.connect(this.delayBus.input);

      nodes = { bus, fx: chain, panner, fader, reverbSend, delaySend, analyser };
      this.trackNodes.set(trackId, nodes);
    }
    return nodes;
  }

  /**
   * Real-time routing point for virtual instruments and processing plugins.
   * Returns a detach function; the source is fed through the track's insert FX.
   */
  connectPluginSource(trackId: string, source: AudioNode): () => void {
    const nodes = this.ensureTrackNodes(trackId);
    source.connect(nodes.bus);
    return () => {
      try { source.disconnect(nodes.bus); } catch { /* noop */ }
    };
  }

  /** Hot-update the insert FX chain of a track. */
  updateTrackFx(trackId: string, fx: Partial<TrackFx>, smooth = true): void {
    const nodes = this.trackNodes.get(trackId);
    if (!nodes) return;
    nodes.fx.update(normalizeTrackFx(fx), smooth);
  }

  setTrackMix(
    trackId: string,
    volume: number,
    pan: number,
    muted: boolean,
    solo: boolean,
    anySolo: boolean,
    reverbSend = 0,
    delaySend = 0,
  ): void {
    if (!this.ctx) return;
    const nodes = this.ensureTrackNodes(trackId);
    nodes.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan / 100)), this.ctx.currentTime, 0.01);
    const audible = muted ? 0 : anySolo && !solo ? 0 : volume / 100;
    nodes.fader.gain.setTargetAtTime(audible, this.ctx.currentTime, 0.01);
    nodes.reverbSend.gain.setTargetAtTime((reverbSend / 100) * 0.6, this.ctx.currentTime, 0.02);
    nodes.delaySend.gain.setTargetAtTime((delaySend / 100) * 0.7, this.ctx.currentTime, 0.02);
  }

  /** Sync all track mixers from project state (call while playing). */
  syncProjectMix(project: SymphonyProject): void {
    this.syncMasterSettings(project);
    const anySolo = project.tracks.some((t) => t.solo);
    for (const track of project.tracks) {
      const nodes = this.trackNodes.get(track.id);
      if (!nodes || !this.ctx) continue;
      nodes.fx.update(normalizeTrackFx(track.fx), true);
      const lanes = trackLanes(track);
      const hasLane = (param: string) => lanes.some((l) => l.param === param);

      // Static params only where automation lanes don't own the parameter.
      if (!hasLane('volume')) {
        const audible = track.muted ? 0 : anySolo && !track.solo ? 0 : track.volume / 100;
        nodes.fader.gain.setTargetAtTime(audible, this.ctx.currentTime, 0.01);
      }
      if (!hasLane('pan')) {
        nodes.panner.pan.setTargetAtTime(
          Math.max(-1, Math.min(1, track.pan / 100)), this.ctx.currentTime, 0.01,
        );
      }
      if (!hasLane('reverbSend')) {
        nodes.reverbSend.gain.setTargetAtTime(((track.reverbSend ?? 0) / 100) * 0.6, this.ctx.currentTime, 0.02);
      }
      if (!hasLane('delaySend')) {
        nodes.delaySend.gain.setTargetAtTime(((track.delaySend ?? 0) / 100) * 0.7, this.ctx.currentTime, 0.02);
      }
    }
  }

  syncMasterSettings(project: SymphonyProject): void {
    if (!this.ctx || !this.masterGain || !this.masterChain) return;
    const vol = (project.masterVolume ?? 85) / 100;
    this.masterGain.gain.setTargetAtTime(vol * 0.85, this.ctx.currentTime, 0.02);
    this.metronomeVolume = project.metronomeVolume ?? 70;
    this.masterChain.update(undefined, true);
    if (this.delayBus) this.delayBus.setTempo(project.tempo);
  }

  /** Instantaneous per-track meter readings (linear amplitude 0–1). */
  getMeterSnapshots(trackIds: string[]): Record<string, MeterSnapshot> {
    const levels: Record<string, MeterSnapshot> = {};
    let count = 0;
    for (const id of trackIds) {
      if (count++ > MAX_TRACKS_ANALYSED) { levels[id] = { level: 0, peak: 0 }; continue; }
      const nodes = this.trackNodes.get(id);
      levels[id] = nodes ? analyseNode(nodes.analyser) : { level: 0, peak: 0 };
    }
    return levels;
  }

  /** Back-compat meter API: peak-percentage levels 0–100. */
  getMeterLevels(trackIds: string[]): Record<string, number> {
    const snapshots = this.getMeterSnapshots(trackIds);
    const out: Record<string, number> = {};
    for (const [id, s] of Object.entries(snapshots)) {
      out[id] = Math.min(100, s.peak * 100 * 1.15);
    }
    return out;
  }

  /** Master bus meter reading. */
  getMasterSnapshot(): MeterSnapshot {
    if (!this.masterChain) return { level: 0, peak: 0 };
    return analyseNode(this.masterChain.analyser);
  }

  /** Limiter gain-reduction readout (dB, 0 = no reduction). */
  getLimiterReductionDb(): number {
    return this.masterChain ? this.masterChain.limiter.reduction : 0;
  }

  private playClick(when: number, accent: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = accent ? 1200 : 880;
    const vol = (this.metronomeVolume / 100) * (accent ? 0.35 : 0.22);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(when);
    osc.stop(when + 0.05);
    this.scheduled.push(osc, gain);
  }

  async playCountIn(tempo: number, beats = 4): Promise<void> {
    await this.init();
    if (!this.ctx) return;
    void this.ctx.resume();
    const beatDur = 60 / tempo;
    const now = this.ctx.currentTime + 0.05;
    for (let i = 0; i < beats; i++) {
      this.playClick(now + i * beatDur, i === 0);
    }
    await new Promise((r) => setTimeout(r, beats * beatDur * 1000 + 80));
  }

  playNote(
    preset: InstrumentPreset,
    pitch: number,
    velocity: number,
    when: number,
    trackId: string,
    durationSec?: number,
  ): void {
    if (!this.ctx) return;
    const dest = this.ensureTrackNodes(trackId).bus;
    const freq = MIDI_TO_FREQ(pitch);
    const vol = (velocity / 127) * 0.4;
    const voices = preset.voices ?? 1;
    const adsrEnd = preset.attack + preset.decay + preset.release;
    const noteEnd = durationSec != null ? when + durationSec : when + adsrEnd;
    const releaseAt = durationSec != null
      ? Math.max(when + preset.attack, noteEnd - preset.release)
      : when + preset.attack + preset.decay;

    for (let v = 0; v < voices; v++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = preset.oscType;
      osc.frequency.value = freq;
      osc.detune.value = (preset.detune ?? 0) * (v - (voices - 1) / 2);

      filter.type = 'lowpass';
      filter.frequency.value = preset.filterFreq ?? 2000;

      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(vol / voices, when + preset.attack);
      gain.gain.linearRampToValueAtTime(vol * preset.sustain / voices, when + preset.attack + preset.decay);
      gain.gain.linearRampToValueAtTime(0, releaseAt + preset.release);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      osc.start(when);
      osc.stop(noteEnd + 0.05);
      this.scheduled.push(osc, gain, filter);
    }
  }

  playDrum(pitch: number, velocity: number, when: number, trackId: string, durationSec?: number): void {
    if (!this.ctx) return;
    const dest = this.ensureTrackNodes(trackId).bus;
    const vol = (velocity / 127) * 0.6;
    const drumDur = durationSec ?? 0.2;

    if (pitch <= 36) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, when);
      osc.frequency.exponentialRampToValueAtTime(40, when + 0.08);
      gain.gain.setValueAtTime(vol, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + Math.min(0.15, drumDur));
      osc.connect(gain);
      gain.connect(dest);
      osc.start(when);
      osc.stop(when + drumDur);
      this.scheduled.push(osc, gain);
    } else if (pitch <= 40) {
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.15));
      const src = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      src.buffer = buf;
      gain.gain.value = vol * 0.8;
      src.connect(gain);
      gain.connect(dest);
      src.start(when);
      src.stop(when + drumDur);
      this.scheduled.push(src, gain);
    } else {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 8000;
      gain.gain.setValueAtTime(vol * 0.3, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + Math.min(0.05, drumDur));
      osc.connect(gain);
      gain.connect(dest);
      osc.start(when);
      osc.stop(when + drumDur);
      this.scheduled.push(osc, gain);
    }
  }

  private scheduleNoteEvent(
    preset: InstrumentPreset,
    note: NoteEvent,
    when: number,
    trackId: string,
    beatDur: number,
  ): void {
    const dur = note.durationBeats * beatDur;
    if (preset.category === 'drums' || preset.category === 'percussion') {
      this.playDrum(note.pitch, note.velocity, when, trackId, dur);
    } else {
      this.playNote(preset, note.pitch, note.velocity, when, trackId, dur);
    }
  }

  private scheduleRegionNotes(
    preset: InstrumentPreset,
    region: Region,
    fromBeat: number,
    beatDur: number,
    now: number,
    trackId: string,
  ): void {
    if (region.muted) return;
    const stretch = region.stretchFactor ?? 1;
    for (const raw of region.notes ?? []) {
      const note = applyRegionNoteTransform(raw, region);
      const noteBeat = region.startBar * 4 + raw.startBeat * stretch;
      if (noteBeat < fromBeat) continue;

      const when = now + (noteBeat - fromBeat) * beatDur;
      const stretchedNote: NoteEvent = { ...note, durationBeats: raw.durationBeats * stretch };
      this.scheduleNoteEvent(preset, stretchedNote, when, trackId, beatDur);
    }
  }

  /**
   * Schedule true AudioParam automation for a track (volume / pan / sends).
   * This replaces the legacy velocity-scaling approximation.
   */
  private scheduleTrackAutomation(
    track: Track,
    fromBeat: number,
    endBeat: number,
    timeAtBeat: (beat: number) => number,
    anySolo: boolean,
  ): void {
    const nodes = this.trackNodes.get(track.id);
    if (!nodes || !this.ctx) return;
    const lanes = trackLanes(track);
    const audibleScale = track.muted ? 0 : anySolo && !track.solo ? 0 : 1;

    for (const lane of lanes) {
      switch (lane.param) {
        case 'volume':
          scheduleLaneRamp(
            nodes.fader.gain, lane, fromBeat, endBeat, timeAtBeat,
            (v) => laneValueToParam('volume', v) * audibleScale,
          );
          break;
        case 'pan':
          scheduleLaneRamp(nodes.panner.pan, lane, fromBeat, endBeat, timeAtBeat, (v) => laneValueToParam('pan', v));
          break;
        case 'reverbSend':
          scheduleLaneRamp(nodes.reverbSend.gain, lane, fromBeat, endBeat, timeAtBeat, (v) => laneValueToParam('reverbSend', v));
          break;
        case 'delaySend':
          scheduleLaneRamp(nodes.delaySend.gain, lane, fromBeat, endBeat, timeAtBeat, (v) => laneValueToParam('delaySend', v));
          break;
      }
    }
  }

  private getLoopBounds(project: SymphonyProject, totalBars: number): { start: number; end: number } {
    if (project.useCycleRegion && project.cycleEndBar != null && project.cycleStartBar != null) {
      return {
        start: project.cycleStartBar * 4,
        end: Math.max(project.cycleStartBar + 1, project.cycleEndBar) * 4,
      };
    }
    return { start: 0, end: totalBars * 4 };
  }

  private loopPlayback(
    project: SymphonyProject, tempo: number, anySolo: boolean, loopStart: number,
  ): void {
    this._position = loopStart;
    this.startTime = performance.now() - (loopStart / (tempo / 60)) * 1000;
    this.lastMetronomeBeat = -1;
    this.stopScheduled();
    this.scheduleFromProject(project, loopStart, anySolo);
  }

  scheduleProject(project: SymphonyProject, fromBeat = 0): void {
    if (!this.ctx) return;
    this.stopScheduled();
    this.scheduleFromProject(project, fromBeat, project.tracks.some((t) => t.solo));
  }

  scheduleNotes(
    trackId: string,
    instrumentId: string,
    notes: NoteEvent[],
    startBar: number,
    tempo: number,
    fromBeat: number,
    trackVolume: number,
    pan: number,
    muted: boolean,
    solo: boolean,
    anySolo: boolean,
    reverbSend = 0,
    delaySend = 0,
  ): void {
    if (!this.ctx) return;
    this.setTrackMix(trackId, trackVolume, pan, muted, solo, anySolo, reverbSend, delaySend);
    const preset = getInstrument(instrumentId);
    const beatDur = 60 / tempo;
    const now = this.ctx.currentTime + 0.05;

    for (const note of notes) {
      const noteBeat = startBar * 4 + note.startBeat;
      if (noteBeat < fromBeat) continue;
      const when = now + (noteBeat - fromBeat) * beatDur;
      this.scheduleNoteEvent(preset, note, when, trackId, beatDur);
    }
  }

  seekTo(beats: number, reschedule = false): void {
    beats = Math.max(0, beats);
    this._position = beats;
    const bar = Math.floor(beats / 4) + 1;
    const beat = Math.floor(beats % 4) + 1;
    const tickNum = Math.floor((beats % 1) * 960);
    this.onPositionChange?.(bar, beat, tickNum);

    if (!this._playing || this._paused || !this.currentProject || !reschedule) return;

    const tempo = this.currentProject.tempo;
    this.startTime = performance.now() - (beats / (tempo / 60)) * 1000;
    this.lastMetronomeBeat = -1;
    this.stopScheduled();
    const anySolo = this.currentProject.tracks.some((t) => t.solo);
    this.scheduleFromProject(this.currentProject, beats, anySolo);
  }

  startPlayback(project: SymphonyProject, loop = false, metronome = false): void {
    if (!this.ctx) return;
    void this.ctx.resume();
    this._playing = true;
    this._paused = false;
    this.currentProject = project;
    this.currentLoop = loop;
    this.metronomeEnabled = metronome;
    this.metronomeVolume = project.metronomeVolume ?? 70;
    this.lastMetronomeBeat = -1;
    this.startTime = performance.now() - (this._position / (project.tempo / 60)) * 1000;
    const tempo = project.tempo;
    const totalBars = Math.max(...project.regions.map((r) => r.startBar + r.lengthBars), 8);
    const anySolo = project.tracks.some((t) => t.solo);
    const { end: loopEnd } = this.getLoopBounds(project, totalBars);

    this.syncProjectMix(project);
    this.scheduleFromProject(project, this._position, anySolo);
    this.runTickLoop(project, tempo, totalBars, loopEnd, anySolo);
  }

  private runTickLoop(
    project: SymphonyProject, tempo: number, totalBars: number, loopEndBeats: number, anySolo: boolean,
  ): void {
    const { start: loopStart } = this.getLoopBounds(project, totalBars);
    const tick = () => {
      if (!this._playing || this._paused) return;
      const elapsed = (performance.now() - this.startTime) / 1000;
      const beats = elapsed * (tempo / 60);
      const bar = Math.floor(beats / 4) + 1;
      const beat = Math.floor(beats % 4) + 1;
      const tickNum = Math.floor((beats % 1) * 960);
      this._position = beats;
      this.onPositionChange?.(bar, beat, tickNum);

      if (this.metronomeEnabled && this.ctx) {
        const beatIdx = Math.floor(beats);
        if (beatIdx !== this.lastMetronomeBeat) {
          this.lastMetronomeBeat = beatIdx;
          const beatInBar = beatIdx % 4;
          this.playClick(this.ctx.currentTime + 0.01, beatInBar === 0);
        }
      }

      const endBeats = this.currentLoop ? loopEndBeats : totalBars * 4;
      if (beats >= endBeats) {
        if (this.currentLoop) {
          this.loopPlayback(project, tempo, anySolo, loopStart);
        } else {
          this.stop();
          this.onPlaybackEnd?.();
          return;
        }
      }
      this.rafId = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(tick);
  }

  pause(): void {
    if (!this._playing || this._paused) return;
    this._paused = true;
    this._position = (performance.now() - this.startTime) / 1000 * ((this.currentProject?.tempo ?? 120) / 60);
    cancelAnimationFrame(this.rafId);
    this.stopScheduled();
    this.lastMetronomeBeat = -1;
  }

  resume(): void {
    if (!this._playing || !this._paused || !this.currentProject) return;
    this._paused = false;
    const tempo = this.currentProject.tempo;
    const totalBars = Math.max(...this.currentProject.regions.map((r) => r.startBar + r.lengthBars), 8);
    const anySolo = this.currentProject.tracks.some((t) => t.solo);
    const { end: loopEnd } = this.getLoopBounds(this.currentProject, totalBars);
    this.startTime = performance.now() - (this._position / (tempo / 60)) * 1000;
    this.lastMetronomeBeat = -1;
    this.syncProjectMix(this.currentProject);
    this.scheduleFromProject(this.currentProject, this._position, anySolo);
    this.runTickLoop(this.currentProject, tempo, totalBars, loopEnd, anySolo);
  }

  private scheduleFromProject(project: SymphonyProject, fromBeat: number, anySolo: boolean): void {
    if (!this.ctx) return;
    const tempo = project.tempo;
    const beatDur = 60 / tempo;
    const now = this.ctx.currentTime + 0.05;
    const totalBars = Math.max(...project.regions.map((r) => r.startBar + r.lengthBars), 8);
    const { end: endBeat } = this.getLoopBounds(project, totalBars);
    const timeAtBeat = (beat: number) => now + (beat - fromBeat) * beatDur;

    for (const track of project.tracks) {
      const nodes = this.ensureTrackNodes(track.id, track.fx);
      nodes.fx.update(normalizeTrackFx(track.fx), true);

      const lanes = trackLanes(track);
      const hasLane = (param: string) => lanes.some((l) => l.param === param);

      // Static params first — automation ramps override where lanes exist.
      if (!hasLane('pan')) {
        nodes.panner.pan.setTargetAtTime(
          Math.max(-1, Math.min(1, staticParamValue(track, 'pan') / 100)), this.ctx.currentTime, 0.01,
        );
      }
      if (!hasLane('volume')) {
        const audible = track.muted ? 0 : anySolo && !track.solo ? 0 : track.volume / 100;
        nodes.fader.gain.setTargetAtTime(audible, this.ctx.currentTime, 0.01);
      }
      if (!hasLane('reverbSend')) {
        nodes.reverbSend.gain.setTargetAtTime((staticParamValue(track, 'reverbSend') / 100) * 0.6, this.ctx.currentTime, 0.02);
      }
      if (!hasLane('delaySend')) {
        nodes.delaySend.gain.setTargetAtTime((staticParamValue(track, 'delaySend') / 100) * 0.7, this.ctx.currentTime, 0.02);
      }
      this.scheduleTrackAutomation(track, fromBeat, endBeat, timeAtBeat, anySolo);

      const preset = getInstrument(track.instrumentId);
      for (const region of project.regions.filter((r) => r.trackId === track.id)) {
        this.scheduleRegionNotes(preset, region, fromBeat, beatDur, now, track.id);
      }
    }
  }

  stop(): void {
    this._playing = false;
    this._paused = false;
    cancelAnimationFrame(this.rafId);
    this.stopScheduled();
    this.stopAllLiveNotes();
    this.currentProject = null;
    this.currentLoop = false;
    this.metronomeEnabled = false;
    this.lastMetronomeBeat = -1;
    this._position = 0;
    this.onPositionChange?.(1, 1, 0);
  }

  private stopScheduled(): void {
    for (const node of this.scheduled) {
      try { node.disconnect(); } catch { /* noop */ }
    }
    this.scheduled = [];
  }

  private stopAllLiveNotes(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const [key, voice] of this.liveNotes) {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.linearRampToValueAtTime(0, now + 0.06);
        voice.osc.stop(now + 0.08);
      } catch { /* noop */ }
      this.liveNotes.delete(key);
    }
  }

  playLiveNote(trackId: string, instrumentId: string, pitch: number, velocity: number): void {
    if (!this.ctx) return;
    const preset = getInstrument(instrumentId);
    const dest = this.ensureTrackNodes(trackId).bus;
    const key = `${trackId}:${pitch}`;
    this.stopLiveNote(trackId, pitch);

    const when = this.ctx.currentTime + 0.01;
    const freq = MIDI_TO_FREQ(pitch);
    const vol = (velocity / 127) * 0.4;

    if (preset.category === 'drums' || preset.category === 'percussion') {
      this.playDrum(pitch, velocity, when, trackId);
      return;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = preset.oscType;
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.value = preset.filterFreq ?? 2000;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol, when + preset.attack);
    gain.gain.linearRampToValueAtTime(vol * preset.sustain, when + preset.attack + preset.decay);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(when);
    this.liveNotes.set(key, { osc, gain, filter });
  }

  stopLiveNote(trackId: string, pitch: number): void {
    if (!this.ctx) return;
    const key = `${trackId}:${pitch}`;
    const voice = this.liveNotes.get(key);
    if (!voice) return;
    const now = this.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + 0.08);
    voice.osc.stop(now + 0.1);
    this.liveNotes.delete(key);
  }

  dispose(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
    this.masterChain?.dispose();
    this.masterChain = null;
    this.reverbInput = null;
    this.reverbConvolver = null;
    this.reverbReturn = null;
    this.delayBus?.dispose();
    this.delayBus = null;
    for (const nodes of this.trackNodes.values()) nodes.fx.dispose();
    this.trackNodes.clear();
  }
}
