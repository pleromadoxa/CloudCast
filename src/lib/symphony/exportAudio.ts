/**
 * CloudCast Symphony — mixdown rendering & export.
 *
 * Renders the arrangement through an `OfflineAudioContext` that mirrors the
 * real-time engine graph (insert FX, sends, convolution reverb, tempo delay,
 * automation, master bus) and encodes to WAV, AIFF or MP3.
 */
import { Mp3Encoder } from '@breezystack/lamejs';
import type {
  ExportFormat, ExportSettings, NoteEvent, Region, SymphonyProject, Track,
} from '../../types/symphony';
import { normalizeTrackFx } from '../../types/symphony';
import { getInstrument } from './instruments';
import { applyRegionNoteTransform } from './noteUtils';
import { laneValueToParam, scheduleLaneRamp, trackLanes } from './automationSchedule';
import {
  buildReverbImpulseResponse, createDelayBus, createMasterChain, createTrackFxChain,
} from './fxChain';

const MIDI_TO_FREQ = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const TAIL_SEC = 2.5;
const PEAK_NORMALIZE_DBFS = -1;

export interface RenderOptions {
  sampleRate: number;
  range: 'project' | 'cycle';
  includeTail: boolean;
}

export function projectEndBeat(project: SymphonyProject): number {
  return Math.max(8 * 4, ...project.regions.map((r) => r.startBar * 4 + r.lengthBars * 4));
}

export function renderWindowBeats(project: SymphonyProject, opts: RenderOptions): {
  startBeat: number;
  endBeat: number;
} {
  const fullEnd = projectEndBeat(project);
  if (opts.range === 'cycle' && project.useCycleRegion && project.cycleStartBar != null && project.cycleEndBar != null) {
    return {
      startBeat: project.cycleStartBar * 4,
      endBeat: Math.max(project.cycleStartBar + 1, project.cycleEndBar) * 4,
    };
  }
  return { startBeat: 0, endBeat: fullEnd };
}

function scheduleDrum(
  ctx: BaseAudioContext, dest: AudioNode, pitch: number, velocity: number,
  when: number, durationSec: number,
): void {
  const vol = (velocity / 127) * 0.6;
  if (pitch <= 36) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(40, when + 0.08);
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + Math.min(0.15, durationSec));
    osc.connect(gain);
    gain.connect(dest);
    osc.start(when);
    osc.stop(when + durationSec);
  } else if (pitch <= 40) {
    const buf = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * 0.1), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.15));
    }
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    gain.gain.value = vol * 0.8;
    src.connect(gain);
    gain.connect(dest);
    src.start(when);
    src.stop(when + durationSec);
  } else {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 8000;
    gain.gain.setValueAtTime(vol * 0.3, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + Math.min(0.05, durationSec));
    osc.connect(gain);
    gain.connect(dest);
    osc.start(when);
    osc.stop(when + durationSec);
  }
}

function scheduleSynthNote(
  ctx: BaseAudioContext, dest: AudioNode, preset: ReturnType<typeof getInstrument>,
  note: NoteEvent, when: number, durationSec: number,
): void {
  const vol = (note.velocity / 127) * 0.35;
  const voices = preset.voices ?? 1;
  const releaseAt = Math.max(when + preset.attack, when + durationSec - preset.release);
  for (let v = 0; v < voices; v++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = preset.oscType;
    osc.frequency.value = MIDI_TO_FREQ(note.pitch);
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
    osc.stop(when + durationSec + 0.05);
  }
}

/**
 * Offline-render the project mix. Sample-accurate mirror of the live engine.
 */
export async function renderProjectToBuffer(
  project: SymphonyProject,
  opts: RenderOptions = { sampleRate: 44100, range: 'project', includeTail: true },
): Promise<AudioBuffer> {
  const tempo = project.tempo;
  const beatDur = 60 / tempo;
  const { startBeat, endBeat } = renderWindowBeats(project, opts);
  const spanSec = (endBeat - startBeat) * beatDur + (opts.includeTail ? TAIL_SEC : 0.1);
  const offline = new OfflineAudioContext(
    2,
    Math.max(1, Math.ceil(spanSec * opts.sampleRate)),
    opts.sampleRate,
  );

  // Master bus (mirrors SymphonyAudioEngine.init).
  const masterGain = offline.createGain();
  masterGain.gain.value = ((project.masterVolume ?? 85) / 100) * 0.85;
  const masterChain = createMasterChain(offline, project, false);
  masterGain.connect(masterChain.input);
  masterChain.output.connect(offline.destination);

  const reverbInput = offline.createGain();
  reverbInput.gain.value = 0.45;
  const convolver = offline.createConvolver();
  convolver.buffer = buildReverbImpulseResponse(offline, 2.2, 2.6);
  const reverbReturn = offline.createGain();
  reverbReturn.gain.value = 0.9;
  reverbInput.connect(convolver);
  convolver.connect(reverbReturn);
  reverbReturn.connect(masterChain.input);

  const delayBus = createDelayBus(offline, tempo);
  delayBus.output.connect(masterChain.input);

  const anySolo = project.tracks.some((t) => t.solo);
  const timeAtBeat = (beat: number) => Math.max(0, (beat - startBeat) * beatDur);

  const scheduleTrack = (track: Track): void => {
    const bus = offline.createGain();
    const fx = createTrackFxChain(offline, normalizeTrackFx(track.fx));
    const panner = offline.createStereoPanner();
    const fader = offline.createGain();
    const reverbSend = offline.createGain();
    const delaySend = offline.createGain();

    panner.pan.value = Math.max(-1, Math.min(1, track.pan / 100));
    const audible = track.muted ? 0 : anySolo && !track.solo ? 0 : track.volume / 100;
    fader.gain.value = audible;
    reverbSend.gain.value = ((track.reverbSend ?? 0) / 100) * 0.6;
    delaySend.gain.value = ((track.delaySend ?? 0) / 100) * 0.7;

    bus.connect(fx.input);
    fx.output.connect(panner);
    panner.connect(fader);
    fader.connect(masterGain);
    bus.connect(reverbSend);
    reverbSend.connect(reverbInput);
    bus.connect(delaySend);
    delaySend.connect(delayBus.input);

    // True automation ramps (volume / pan / sends).
    for (const lane of trackLanes(track)) {
      const audibleScale = track.muted ? 0 : anySolo && !track.solo ? 0 : 1;
      switch (lane.param) {
        case 'volume':
          scheduleLaneRamp(fader.gain, lane, startBeat, endBeat, timeAtBeat,
            (v) => laneValueToParam('volume', v) * audibleScale);
          break;
        case 'pan':
          scheduleLaneRamp(panner.pan, lane, startBeat, endBeat, timeAtBeat,
            (v) => laneValueToParam('pan', v));
          break;
        case 'reverbSend':
          scheduleLaneRamp(reverbSend.gain, lane, startBeat, endBeat, timeAtBeat,
            (v) => laneValueToParam('reverbSend', v));
          break;
        case 'delaySend':
          scheduleLaneRamp(delaySend.gain, lane, startBeat, endBeat, timeAtBeat,
            (v) => laneValueToParam('delaySend', v));
          break;
      }
    }

    const preset = getInstrument(track.instrumentId);
    const isDrum = preset.category === 'drums' || preset.category === 'percussion';
    for (const region of project.regions.filter((r) => r.trackId === track.id)) {
      if (region.muted) continue;
      scheduleRegion(region);
    }

    function scheduleRegion(region: Region): void {
      const stretch = region.stretchFactor ?? 1;
      for (const raw of region.notes ?? []) {
        const note = applyRegionNoteTransform(raw, region);
        const noteBeat = region.startBar * 4 + raw.startBeat * stretch;
        const noteEndBeat = noteBeat + raw.durationBeats * stretch;
        if (noteEndBeat < startBeat || noteBeat > endBeat) continue;
        const when = timeAtBeat(noteBeat);
        const dur = raw.durationBeats * stretch * beatDur;
        if (isDrum) {
          scheduleDrum(offline, bus, note.pitch, note.velocity, when, dur);
        } else {
          scheduleSynthNote(offline, bus, preset, { ...note, durationBeats: raw.durationBeats * stretch }, when, dur);
        }
      }
    }
  };

  for (const track of project.tracks) scheduleTrack(track);

  return offline.startRendering();
}

/** Peak-normalize in place to the given dBFS ceiling. */
export function normalizeBuffer(buffer: AudioBuffer, targetDbfs = PEAK_NORMALIZE_DBFS): void {
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  }
  if (peak <= 0) return;
  const target = Math.pow(10, targetDbfs / 20);
  const gain = target / peak;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
}

/** TPDF dither at ±1 LSB for 16-bit quantization. */
function ditherSample(sample: number, lsb: number): number {
  return sample + (Math.random() - Math.random()) * lsb;
}

function writePcm(
  view: DataView, buffer: AudioBuffer, bitDepth: 16 | 24,
  littleEndian: boolean, dither: boolean,
): void {
  const channels = buffer.numberOfChannels;
  const max = bitDepth === 16 ? 0x7fff : 0x7fffff;
  const lsb = 1 / (max + 1);
  let offset = 0;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      let sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      if (dither) sample = ditherSample(sample, lsb);
      sample = Math.max(-1, Math.min(1, sample));
      const intVal = Math.round(sample < 0 ? sample * max : sample * max);
      if (bitDepth === 16) {
        view.setInt16(offset, intVal, littleEndian);
        offset += 2;
      } else {
        if (littleEndian) {
          view.setUint8(offset, intVal & 0xff);
          view.setUint8(offset + 1, (intVal >> 8) & 0xff);
          view.setUint8(offset + 2, (intVal >> 16) & 0xff);
        } else {
          view.setUint8(offset, (intVal >> 16) & 0xff);
          view.setUint8(offset + 1, (intVal >> 8) & 0xff);
          view.setUint8(offset + 2, intVal & 0xff);
        }
        offset += 3;
      }
    }
  }
}

const writeStr = (view: DataView, offset: number, str: string): void => {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
};

/** Encode 16/24-bit WAV (RIFF, PCM). */
export function encodeWav(buffer: AudioBuffer, bitDepth: 16 | 24 = 16, dither = true): Blob {
  const channels = buffer.numberOfChannels;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = channels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);

  writeStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeStr(view, 8, 'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  writePcm(view, buffer, bitDepth, true, dither && bitDepth === 16);

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/** 80-bit IEEE 754 extended-precision sample rate (AIFF COMM chunk). */
function writeExtendedFloat80(view: DataView, offset: number, value: number): void {
  let exponent = 0;
  let hiMant = 0;
  let loMant = 0;
  if (value > 0) {
    while (value < 1) { value *= 2; exponent -= 1; }
    while (value >= 2) { value /= 2; exponent += 1; }
    exponent += 16383;
    value *= 2 ** 31;
    hiMant = Math.floor(value);
    value = (value - hiMant) * 2 ** 32;
    loMant = Math.floor(value);
  }
  view.setUint16(offset, exponent, false);
  view.setUint32(offset + 2, hiMant >>> 0, false);
  view.setUint32(offset + 6, loMant >>> 0, false);
}

/** Encode 16/24-bit AIFF (FORM/AIFF, big-endian PCM). */
export function encodeAiff(buffer: AudioBuffer, bitDepth: 16 | 24 = 16, dither = true): Blob {
  const channels = buffer.numberOfChannels;
  const bytesPerSample = bitDepth / 8;
  const dataLength = buffer.length * channels * bytesPerSample;
  const ssndSize = 8 + dataLength;
  const commSize = 18;
  const formSize = 4 + (8 + commSize) + (8 + ssndSize);
  const arrayBuffer = new ArrayBuffer(8 + formSize);
  const view = new DataView(arrayBuffer);

  writeStr(view, 0, 'FORM');
  view.setUint32(4, formSize, false);
  writeStr(view, 8, 'AIFF');

  writeStr(view, 12, 'COMM');
  view.setUint32(16, commSize, false);
  view.setUint16(20, channels, false);
  view.setUint32(22, buffer.length, false);
  view.setUint16(26, bitDepth, false);
  writeExtendedFloat80(view, 28, buffer.sampleRate);

  writeStr(view, 38, 'SSND');
  view.setUint32(42, ssndSize, false);
  view.setUint32(46, 0, false); // offset
  view.setUint32(50, 0, false); // block size
  writePcm(view, buffer, bitDepth, false, dither && bitDepth === 16);

  return new Blob([arrayBuffer], { type: 'audio/aiff' });
}

/** Encode MP3 (CBR) from the buffer via the bundled LAME encoder. */
export function encodeMp3(buffer: AudioBuffer, bitrateKbps: number): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const encoder = new Mp3Encoder(channels, sampleRate, bitrateKbps);
  const blockSize = 1152;
  const chunks: Uint8Array[] = [];

  const toInt16 = (data: Float32Array, from: number, len: number): Int16Array => {
    const out = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      const s = Math.max(-1, Math.min(1, data[from + i] ?? 0));
      out[i] = Math.round(s < 0 ? s * 0x8000 : s * 0x7fff);
    }
    return out;
  };

  const left = buffer.getChannelData(0);
  const right = channels > 1 ? buffer.getChannelData(1) : left;
  for (let i = 0; i < buffer.length; i += blockSize) {
    const len = Math.min(blockSize, buffer.length - i);
    const encoded = channels > 1
      ? encoder.encodeBuffer(toInt16(left, i, len), toInt16(right, i, len))
      : encoder.encodeBuffer(toInt16(left, i, len));
    if (encoded.length > 0) chunks.push(encoded);
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(tail);

  return new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
}

export function exportFileExtension(format: ExportFormat): string {
  return format === 'mp3' ? 'mp3' : format === 'aiff' ? 'aiff' : 'wav';
}

export function mimeTypeFor(format: ExportFormat): string {
  return format === 'mp3' ? 'audio/mpeg' : format === 'aiff' ? 'audio/aiff' : 'audio/wav';
}

/** Rough output size estimate for the export dialog. */
export function estimateFileSizeBytes(settings: ExportSettings, durationSec: number): number {
  if (settings.format === 'mp3') return (settings.mp3BitrateKbps * 1000 / 8) * durationSec;
  const bytesPerSample = settings.bitDepth / 8;
  return durationSec * settings.sampleRate * 2 * bytesPerSample;
}

/** Full export pipeline: render → normalize → encode. */
export async function exportProjectAudio(
  project: SymphonyProject,
  settings: ExportSettings,
  onProgress?: (stage: 'rendering' | 'encoding' | 'done') => void,
): Promise<{ blob: Blob; fileName: string }> {
  onProgress?.('rendering');
  const mp3SampleRate = Math.min(settings.sampleRate, 48000);
  const buffer = await renderProjectToBuffer(project, {
    sampleRate: settings.format === 'mp3' ? mp3SampleRate : settings.sampleRate,
    range: settings.range,
    includeTail: settings.includeTail,
  });
  if (settings.normalize) normalizeBuffer(buffer);

  onProgress?.('encoding');
  let blob: Blob;
  switch (settings.format) {
    case 'aiff':
      blob = encodeAiff(buffer, settings.bitDepth);
      break;
    case 'mp3':
      blob = encodeMp3(buffer, settings.mp3BitrateKbps);
      break;
    default:
      blob = encodeWav(buffer, settings.bitDepth);
  }
  onProgress?.('done');
  const safeName = (settings.fileName || project.name || 'mixdown').replace(/[^\w\-. ]+/g, '');
  return { blob, fileName: `${safeName}.${exportFileExtension(settings.format)}` };
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
