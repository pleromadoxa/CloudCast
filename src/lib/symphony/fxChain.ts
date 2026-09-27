/**
 * CloudCast Symphony — shared processing-plugin graph builders.
 *
 * Every builder works against `BaseAudioContext` so the exact same chain can be
 * instantiated inside a live `AudioContext` (real-time monitoring + playback)
 * or an `OfflineAudioContext` (WAV / AIFF / MP3 mixdown), keeping the mix
 * engine and the export engine sample-accurate with each other.
 */
import type {
  ChorusSettings,
  CompressorSettings,
  EqSettings,
  FilterSettings,
  SymphonyProject,
  TrackFx,
} from '../../types/symphony';
import { normalizeTrackFx } from '../../types/symphony';

export interface FxChain {
  input: AudioNode;
  output: AudioNode;
  /** Apply new settings. `smooth` uses setTargetAtTime (live) vs hard sets (offline). */
  update(fx?: TrackFx, smooth?: boolean): void;
  dispose(): void;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Exponential soft-saturation curve for the drive stage. */
export function makeDriveCurve(amount: number, samples = 1024): Float32Array<ArrayBuffer> {
  const k = clamp(amount, 0, 100) / 100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  const drive = 1 + k * 24;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + drive) * x * 20 * deg) / (Math.PI + drive * Math.abs(x));
  }
  return curve;
}

/** Gentle tanh-ish soft clip used on the master bus. */
export function makeSoftClipCurve(samples = 1024): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.tanh(x * 1.25) / Math.tanh(1.25);
  }
  return curve;
}

function setParam(param: AudioParam, value: number, ctx: BaseAudioContext, smooth: boolean): void {
  if (smooth && 'setTargetAtTime' in param) {
    param.setTargetAtTime(value, ctx.currentTime, 0.02);
  } else {
    param.value = value;
  }
}

function applyEq(
  low: BiquadFilterNode,
  mid: BiquadFilterNode,
  high: BiquadFilterNode,
  eq: EqSettings,
  ctx: BaseAudioContext,
  smooth: boolean,
): void {
  setParam(low.gain, eq.low, ctx, smooth);
  setParam(mid.gain, eq.mid, ctx, smooth);
  setParam(mid.frequency, clamp(eq.midFreq, 200, 5000), ctx, smooth);
  setParam(high.gain, eq.high, ctx, smooth);
}

function applyComp(
  comp: DynamicsCompressorNode,
  settings: CompressorSettings,
  ctx: BaseAudioContext,
  smooth: boolean,
): void {
  setParam(comp.threshold, clamp(settings.thresholdDb, -60, 0), ctx, smooth);
  setParam(comp.ratio, clamp(settings.ratio, 1, 20), ctx, smooth);
  setParam(comp.attack, clamp(settings.attackMs, 0, 200) / 1000, ctx, smooth);
  setParam(comp.release, clamp(settings.releaseMs, 10, 1000) / 1000, ctx, smooth);
  setParam(comp.knee, 12, ctx, smooth);
}

function applyFilter(
  filter: BiquadFilterNode,
  settings: FilterSettings,
  ctx: BaseAudioContext,
  smooth: boolean,
): void {
  filter.type = settings.type;
  setParam(filter.frequency, clamp(settings.freq, 40, 18000), ctx, smooth);
  setParam(filter.Q, clamp(settings.q, 0.2, 18), ctx, smooth);
}

function applyChorus(
  wet: GainNode,
  depth: GainNode,
  lfoRate: OscillatorNode,
  settings: ChorusSettings,
  ctx: BaseAudioContext,
  smooth: boolean,
): void {
  const mix = clamp(settings.mix, 0, 100) / 100;
  setParam(wet.gain, mix * 0.85, ctx, smooth);
  setParam(depth.gain, clamp(settings.depthMs, 0.5, 12) / 1000, ctx, smooth);
  setParam(lfoRate.frequency, clamp(settings.rateHz, 0.05, 5), ctx, smooth);
}

/**
 * Insert FX chain: drive → filter → 3-band EQ → chorus → compressor.
 * Input/output are plain GainNodes so sources can be routed anywhere.
 */
export function createTrackFxChain(ctx: BaseAudioContext, initial?: Partial<TrackFx>): FxChain {
  const settings = normalizeTrackFx(initial);
  const input = ctx.createGain();
  const output = ctx.createGain();

  // Drive stage (always in path, bypassed by zero drive).
  const driveShaper = ctx.createWaveShaper();
  driveShaper.curve = makeDriveCurve(settings.drive);
  driveShaper.oversample = '2x';
  const driveOut = ctx.createGain();
  driveOut.gain.value = 1;
  input.connect(driveShaper);
  driveShaper.connect(driveOut);

  // Filter stage.
  const filter = ctx.createBiquadFilter();
  driveOut.connect(filter);

  // 3-band EQ.
  const eqLow = ctx.createBiquadFilter();
  eqLow.type = 'lowshelf';
  eqLow.frequency.value = 200;
  const eqMid = ctx.createBiquadFilter();
  eqMid.type = 'peaking';
  eqMid.Q.value = 0.9;
  const eqHigh = ctx.createBiquadFilter();
  eqHigh.type = 'highshelf';
  eqHigh.frequency.value = 4200;
  filter.connect(eqLow);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);

  // Chorus (dry + modulated wet path).
  const chorusDry = ctx.createGain();
  const chorusWet = ctx.createGain();
  const chorusDelay = ctx.createDelay(0.05);
  chorusDelay.delayTime.value = 0.018;
  const chorusDepth = ctx.createGain();
  chorusDepth.gain.value = settings.chorus.depthMs / 1000;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = settings.chorus.rateHz;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 1;
  lfo.connect(chorusDepth);
  chorusDepth.connect(chorusDelay.delayTime);
  lfo.start();
  eqHigh.connect(chorusDry);
  eqHigh.connect(chorusDelay);
  chorusDelay.connect(chorusWet);
  chorusDry.connect(output);
  chorusWet.connect(output);

  // Compressor insert.
  const comp = ctx.createDynamicsCompressor();
  const compIn = ctx.createGain();
  const compOut = ctx.createGain();
  output.connect(compIn);
  compIn.connect(comp);
  comp.connect(compOut);

  const chain: FxChain = {
    input,
    output: compOut,
    update(fx, smooth = true) {
      const s = normalizeTrackFx(fx);
      driveShaper.curve = makeDriveCurve(s.drive);
      applyFilter(filter, s.filter, ctx, smooth);
      applyEq(eqLow, eqMid, eqHigh, s.eq, ctx, smooth);
      applyChorus(chorusWet, chorusDepth, lfo, s.chorus, ctx, smooth);
      if (s.comp.enabled) {
        applyComp(comp, s.comp, ctx, smooth);
        setParam(compIn.gain, 1, ctx, smooth);
        setParam(compOut.gain, 1, ctx, smooth);
      } else {
        // Bypass compressor by collapsing the insert to unity.
        setParam(compIn.gain, 1, ctx, smooth);
        setParam(compOut.gain, 1, ctx, smooth);
        setParam(comp.threshold, 0, ctx, smooth);
        setParam(comp.ratio, 1, ctx, smooth);
      }
    },
    dispose() {
      try { lfo.stop(); } catch { /* already stopped */ }
      for (const n of [input, output, driveShaper, driveOut, filter, eqLow, eqMid, eqHigh,
        chorusDry, chorusWet, chorusDelay, chorusDepth, lfo, lfoGain, comp, compIn, compOut]) {
        try { n.disconnect(); } catch { /* noop */ }
      }
    },
  };
  chain.update(settings, false);
  return chain;
}

export interface MasterChain extends FxChain {
  limiter: DynamicsCompressorNode;
  analyser: AnalyserNode;
}

/** Master bus: EQ → drive → limiter → soft clip → analyser. */
export function createMasterChain(
  ctx: BaseAudioContext,
  project: Pick<SymphonyProject, 'masterEq' | 'masterDrive' | 'limiterEnabled' | 'limiterThreshold'>,
  smooth = false,
): MasterChain {
  const input = ctx.createGain();

  const eqLow = ctx.createBiquadFilter();
  eqLow.type = 'lowshelf';
  eqLow.frequency.value = 120;
  const eqMid = ctx.createBiquadFilter();
  eqMid.type = 'peaking';
  eqMid.frequency.value = 1000;
  eqMid.Q.value = 0.8;
  const eqHigh = ctx.createBiquadFilter();
  eqHigh.type = 'highshelf';
  eqHigh.frequency.value = 6000;
  input.connect(eqLow);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);

  const driveShaper = ctx.createWaveShaper();
  driveShaper.oversample = '2x';
  eqHigh.connect(driveShaper);

  const limiter = ctx.createDynamicsCompressor();
  limiter.knee.value = 6;
  driveShaper.connect(limiter);

  const softClip = ctx.createWaveShaper();
  softClip.curve = makeSoftClipCurve();
  softClip.oversample = '2x';
  limiter.connect(softClip);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.2;
  softClip.connect(analyser);

  const output = ctx.createGain();
  analyser.connect(output);

  const chain: MasterChain = {
    input,
    output,
    limiter,
    analyser,
    update(_fx?: TrackFx, smoothNow = smooth) {
      const eq = project.masterEq ?? { low: 0, mid: 0, high: 0, midFreq: 1000 };
      applyEq(eqLow, eqMid, eqHigh, eq, ctx, smoothNow);
      driveShaper.curve = makeDriveCurve(project.masterDrive ?? 0);
      const limitOn = project.limiterEnabled !== false;
      setParam(limiter.threshold, limitOn ? (project.limiterThreshold ?? -18) : 0, ctx, smoothNow);
      setParam(limiter.ratio, limitOn ? 12 : 1, ctx, smoothNow);
      setParam(limiter.attack, 0.003, ctx, smoothNow);
      setParam(limiter.release, 0.18, ctx, smoothNow);
    },
    dispose() {
      for (const n of [input, eqLow, eqMid, eqHigh, driveShaper, limiter, softClip, analyser, output]) {
        try { n.disconnect(); } catch { /* noop */ }
      }
    },
  };
  chain.update(undefined, smooth);
  return chain;
}

/**
 * Procedural stereo impulse response — exponentially decaying filtered noise.
 * Gives the reverb bus a room character far beyond the old feedback delay.
 */
export function buildReverbImpulseResponse(
  ctx: BaseAudioContext,
  seconds = 2.2,
  decay = 2.6,
): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Early reflections + diffuse tail.
      const noise = Math.random() * 2 - 1;
      lp = lp * 0.62 + noise * 0.38; // simple one-pole lowpass for air damping
      const envelope = Math.pow(1 - t, decay);
      data[i] = lp * envelope * (i < rate * 0.01 ? 0.55 : 1);
    }
  }
  return buffer;
}

/** Tempo-synced stereo ping-pong delay bus (1/8 dotted). */
export function createDelayBus(ctx: BaseAudioContext, tempo: number): {
  input: GainNode;
  output: GainNode;
  setTempo(tempo: number): void;
  dispose(): void;
} {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const delayL = ctx.createDelay(2.5);
  const delayR = ctx.createDelay(2.5);
  const feedback = ctx.createGain();
  feedback.gain.value = 0.38;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 5200;
  const merge = ctx.createChannelMerger(2);

  const sync = (bpm: number) => {
    const dottedEighth = (60 / bpm) * 0.75;
    delayL.delayTime.value = dottedEighth;
    delayR.delayTime.value = dottedEighth * 0.5;
  };
  sync(tempo);

  input.connect(delayL);
  delayL.connect(tone);
  tone.connect(delayR);
  delayR.connect(feedback);
  feedback.connect(delayL);
  delayL.connect(merge, 0, 0);
  delayR.connect(merge, 0, 1);
  merge.connect(output);

  return {
    input,
    output,
    setTempo: sync,
    dispose() {
      for (const n of [input, delayL, delayR, feedback, tone, merge, output]) {
        try { n.disconnect(); } catch { /* noop */ }
      }
    },
  };
}
