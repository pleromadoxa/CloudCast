import type { SymphonyProject } from '../../types/symphony';
import { getInstrument } from './instruments';
import { applyRegionNoteTransform } from './noteUtils';

const MIDI_TO_FREQ = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Offline-render project to WAV blob for download. */
export async function renderProjectToWav(project: SymphonyProject): Promise<Blob> {
  const tempo = project.tempo;
  const totalBars = Math.max(8, ...project.regions.map((r) => r.startBar + r.lengthBars));
  const durationSec = (totalBars * 4 * 60) / tempo;
  const sampleRate = 44100;
  const offline = new OfflineAudioContext(2, Math.ceil(durationSec * sampleRate), sampleRate);
  const master = offline.createGain();
  master.gain.value = 0.85;
  master.connect(offline.destination);

  const trackChains = new Map<string, { bus: GainNode; panner: StereoPannerNode; fader: GainNode }>();
  const anySolo = project.tracks.some((t) => t.solo);

  for (const track of project.tracks) {
    const bus = offline.createGain();
    const panner = offline.createStereoPanner();
    const fader = offline.createGain();
    panner.pan.value = Math.max(-1, Math.min(1, track.pan / 100));
    const audible = track.muted ? 0 : anySolo && !track.solo ? 0 : track.volume / 100;
    fader.gain.value = audible;
    bus.connect(panner);
    panner.connect(fader);
    fader.connect(master);
    trackChains.set(track.id, { bus, panner, fader });
  }

  const beatDur = 60 / tempo;

  for (const track of project.tracks) {
    const dest = trackChains.get(track.id)!.bus;
    const preset = getInstrument(track.instrumentId);

    for (const region of project.regions.filter((r) => r.trackId === track.id)) {
      if (region.muted) continue;
      for (const raw of region.notes ?? []) {
        const note = applyRegionNoteTransform(raw, region);
        const when = (region.startBar * 4 + note.startBeat) * beatDur;
        const noteDur = note.durationBeats * beatDur;
        const vol = (note.velocity / 127) * 0.35;

        if (preset.category === 'drums' || preset.category === 'percussion') {
          const osc = offline.createOscillator();
          const gain = offline.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(note.pitch <= 36 ? 150 : 8000, when);
          if (note.pitch <= 36) osc.frequency.exponentialRampToValueAtTime(40, when + 0.08);
          gain.gain.setValueAtTime(vol, when);
          gain.gain.exponentialRampToValueAtTime(0.001, when + Math.min(0.15, noteDur));
          osc.connect(gain);
          gain.connect(dest);
          osc.start(when);
          osc.stop(when + noteDur);
        } else {
          const osc = offline.createOscillator();
          const gain = offline.createGain();
          osc.type = preset.oscType;
          osc.frequency.value = MIDI_TO_FREQ(note.pitch);
          const releaseAt = Math.max(when + preset.attack, when + noteDur - preset.release);
          gain.gain.setValueAtTime(0, when);
          gain.gain.linearRampToValueAtTime(vol, when + preset.attack);
          gain.gain.linearRampToValueAtTime(vol * preset.sustain, when + preset.attack + preset.decay);
          gain.gain.linearRampToValueAtTime(0, releaseAt + preset.release);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(when);
          osc.stop(when + noteDur + 0.05);
        }
      }
    }
  }

  const buffer = await offline.startRendering();
  return audioBufferToWav(buffer);
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataLength = buffer.length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
