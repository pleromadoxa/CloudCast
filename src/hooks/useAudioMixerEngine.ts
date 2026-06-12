import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useCloudCast } from '../context/CloudCastContext';
import { usePgmAudio } from '../context/PgmAudioContext';
import { resolveAudioStreamDeviceId } from '../lib/audioSettings';
import { ensureAudioOutputReady, isDashboardAudioUnlocked, registerDashboardAudioContext } from '../lib/audioOutput';
import {
  acquireStreamSource,
  hasUsableAudio,
  releaseStreamSource,
  streamWireKey,
} from '../lib/streamAudioHub';
import {
  getFatChannelParams,
  getLearnedNoiseFloor,
  getNoiseCancelSettings,
  getVolumeForDevice,
  type AudioConsoleState,
} from './useAudioConsoleState';
import {
  hissLowpassHz,
  humNotchFrequency,
  ncMixAmount,
  noiseGateParams,
  rumbleHighpassHz,
  voicePresenceGainDb,
  voicePresenceHz,
} from '../lib/noiseCancellation';
import type { AudioInputSource } from '../types/audio';
import type { Device } from '../types/device';
import { createEmptyAudioSlot, isRealDevice } from '../types/device';
import { AUDIO_MIXER_MAX_CHANNELS } from '../config/products';

type FxSlot = 'A' | 'B' | 'C' | 'D';

type ChannelChain = {
  deviceId: string;
  streamId: string;
  wireKey: string;
  source: MediaStreamAudioSourceNode;
  inputGain: GainNode;
  ncDry: GainNode;
  ncWet: GainNode;
  ncRumble: BiquadFilterNode;
  ncHum: BiquadFilterNode;
  ncGate: DynamicsCompressorNode;
  ncVoice: BiquadFilterNode;
  ncHiss: BiquadFilterNode;
  ncLearnAnalyser: AnalyserNode;
  hpf: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  pan: StereoPannerNode;
  fader: GainNode;
  busGain: GainNode;
  fxSends: Record<FxSlot, GainNode>;
  mixSends: Record<1 | 2 | 3 | 4, GainNode>;
};

type MixBus = {
  gain: GainNode;
  analyser: AnalyserNode;
};

function hpfFrequency(value: number): number {
  return 40 + (value / 100) * 360;
}

function compAmount(value: number): { threshold: number; ratio: number } {
  if (value <= 0) return { threshold: 0, ratio: 1 };
  return { threshold: -6 - value * 0.4, ratio: 1 + value / 25 };
}

function makeReverbImpulse(ctx: AudioContext, seconds = 1.8): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const impulse = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    }
  }
  return impulse;
}

function channelAudible(state: AudioConsoleState, deviceId: string): boolean {
  if (state.inputMuted[deviceId]) return false;
  if (state.soloId) return state.soloId === deviceId;
  if (state.mixEnabled[deviceId] === false) return false;
  return true;
}

function channelFaderGain(state: AudioConsoleState, deviceId: string): number {
  if (!channelAudible(state, deviceId)) return 0;
  const fader = (state.inputVolumes[deviceId] ?? 75) / 100;
  const fat = getFatChannelParams(state, deviceId);
  const gain = Math.max(0.25, fat.gain / 50);
  return fader * gain;
}

export function useAudioMixerEngine({
  devices,
  state,
  getAudioSourceForDevice,
  linkedUsbAudio,
  learningNoiseFor,
  onNoiseFloorLearned,
}: {
  devices: Device[];
  state: AudioConsoleState;
  getAudioSourceForDevice: (id: string) => AudioInputSource;
  linkedUsbAudio: Record<string, string | null>;
  learningNoiseFor?: string | null;
  onNoiseFloorLearned?: (deviceId: string, floor: number) => void;
}) {
  const { getMeshStream, meshStreams } = useCloudCast();
  const { registerPgmPlaybackStream, setPgmGain } = usePgmAudio();

  const meshStreamRevision = useMemo(() => {
    let revision = 0;
    for (const stream of meshStreams.values()) {
      revision += stream.getAudioTracks().length;
      revision += stream.getAudioTracks().filter((t) => t.readyState === 'live').length;
    }
    return revision;
  }, [meshStreams]);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const broadcastDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const chainsRef = useRef<Map<string, ChannelChain>>(new Map());
  const mixBusesRef = useRef<Record<1 | 2 | 3 | 4, MixBus>>({} as Record<1 | 2 | 3 | 4, MixBus>);
  const fxNodesRef = useRef<Partial<Record<FxSlot, { input: GainNode; output: GainNode }>>>({});
  const monitorChainRef = useRef<{ deviceId: string; tap: GainNode } | null>(null);

  const ensureCtx = useCallback(async () => {
    await ensureAudioOutputReady();
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
      registerDashboardAudioContext(ctxRef.current);
    }
    const ctx = ctxRef.current;
    if (typeof window !== 'undefined') {
      (window as Window & { __cloudcastMixerCtx?: AudioContext }).__cloudcastMixerCtx = ctx;
    }
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        /* needs user gesture — unlockDashboardAudio handles it */
      }
    }
    return ctx;
  }, []);

  const teardownChain = useCallback((chain: ChannelChain) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    try {
      chain.source.disconnect();
      releaseStreamSource(ctx, chain.source.mediaStream);
    } catch {
      /* ignore */
    }
    chainsRef.current.delete(chain.deviceId);
  }, []);

  const wireFx = useCallback((ctx: AudioContext) => {
    if (fxNodesRef.current.A) return;

    const master = masterGainRef.current;
    if (!master) return;

    const fxAIn = ctx.createGain();
    const fxAOut = ctx.createGain();
    const convolver = ctx.createConvolver();
    convolver.buffer = makeReverbImpulse(ctx);
    fxAIn.connect(convolver);
    convolver.connect(fxAOut);
    fxAOut.connect(master);

    const fxBIn = ctx.createGain();
    const fxBOut = ctx.createGain();
    const delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.28;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    fxBIn.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(fxBOut);
    fxBOut.connect(master);

    const fxCIn = ctx.createGain();
    const fxCOut = ctx.createGain();
    const chorusDelay = ctx.createDelay(0.05);
    chorusDelay.delayTime.value = 0.012;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.004;
    lfo.connect(lfoGain);
    lfoGain.connect(chorusDelay.delayTime);
    lfo.start();
    fxCIn.connect(chorusDelay);
    chorusDelay.connect(fxCOut);
    fxCOut.connect(master);

    const fxDIn = ctx.createGain();
    const fxDOut = ctx.createGain();
    const fxDGate = ctx.createDynamicsCompressor();
    fxDGate.threshold.value = -38;
    fxDGate.ratio.value = 10;
    fxDGate.attack.value = 0.006;
    fxDGate.release.value = 0.14;
    fxDIn.connect(fxDGate);
    fxDGate.connect(fxDOut);
    fxDOut.connect(master);

    fxNodesRef.current = {
      A: { input: fxAIn, output: fxAOut },
      B: { input: fxBIn, output: fxBOut },
      C: { input: fxCIn, output: fxCOut },
      D: { input: fxDIn, output: fxDOut },
    };
  }, []);

  const ensureMaster = useCallback(async () => {
    const ctx = await ensureCtx();
    if (masterGainRef.current) return ctx;

    const master = ctx.createGain();
    const monitor = ctx.createGain();
    const broadcastDest = ctx.createMediaStreamDestination();

    master.connect(broadcastDest);

    masterGainRef.current = master;
    monitorGainRef.current = monitor;
    broadcastDestRef.current = broadcastDest;

    ([1, 2, 3, 4] as const).forEach((bus) => {
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      gain.connect(analyser);
      analyser.connect(master);
      mixBusesRef.current[bus] = { gain, analyser };
    });

    wireFx(ctx);
    registerPgmPlaybackStream(broadcastDest.stream);
    return ctx;
  }, [ensureCtx, registerPgmPlaybackStream, wireFx]);

  const wireChannel = useCallback(
    async (device: Device) => {
      const ctx = await ensureMaster();
      const streamDeviceId = resolveAudioStreamDeviceId(
        device.deviceId,
        getAudioSourceForDevice,
        linkedUsbAudio,
      );
      const stream = getMeshStream(streamDeviceId);
      if (!stream || !hasUsableAudio(stream)) return;

      const wireKey = streamWireKey(stream);
      const existing = chainsRef.current.get(device.deviceId);
      if (existing?.wireKey === wireKey) return;
      if (existing) teardownChain(existing);

      const source = acquireStreamSource(ctx, stream);
      if (!source) return;

      const inputGain = ctx.createGain();
      const ncDry = ctx.createGain();
      const ncWet = ctx.createGain();
      const ncRumble = ctx.createBiquadFilter();
      ncRumble.type = 'highpass';
      const ncHum = ctx.createBiquadFilter();
      ncHum.type = 'notch';
      const ncGate = ctx.createDynamicsCompressor();
      const ncVoice = ctx.createBiquadFilter();
      ncVoice.type = 'peaking';
      const ncHiss = ctx.createBiquadFilter();
      ncHiss.type = 'lowpass';
      const ncLearnAnalyser = ctx.createAnalyser();
      ncLearnAnalyser.fftSize = 2048;

      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      const compressor = ctx.createDynamicsCompressor();
      const pan = ctx.createStereoPanner();
      const fader = ctx.createGain();
      const busGain = ctx.createGain();

      source.connect(inputGain);
      inputGain.connect(ncLearnAnalyser);

      inputGain.connect(ncRumble);
      ncRumble.connect(ncHum);
      ncHum.connect(ncGate);
      ncGate.connect(ncVoice);
      ncVoice.connect(ncHiss);
      ncHiss.connect(ncWet);

      inputGain.connect(ncDry);

      ncDry.connect(hpf);
      ncWet.connect(hpf);
      hpf.connect(compressor);
      compressor.connect(pan);
      pan.connect(fader);
      fader.connect(busGain);

      const mixSends: ChannelChain['mixSends'] = {
        1: ctx.createGain(),
        2: ctx.createGain(),
        3: ctx.createGain(),
        4: ctx.createGain(),
      };
      const fxSends: ChannelChain['fxSends'] = {
        A: ctx.createGain(),
        B: ctx.createGain(),
        C: ctx.createGain(),
        D: ctx.createGain(),
      };

      busGain.connect(masterGainRef.current!);
      Object.values(mixSends).forEach((send, i) => {
        fader.connect(send);
        send.connect(mixBusesRef.current[(i + 1) as 1 | 2 | 3 | 4].gain);
      });
      Object.entries(fxSends).forEach(([slot, send]) => {
        fader.connect(send);
        const fx = fxNodesRef.current[slot as FxSlot];
        if (fx) send.connect(fx.input);
      });

      chainsRef.current.set(device.deviceId, {
        deviceId: device.deviceId,
        streamId: stream.id,
        wireKey,
        source,
        inputGain,
        ncDry,
        ncWet,
        ncRumble,
        ncHum,
        ncGate,
        ncVoice,
        ncHiss,
        ncLearnAnalyser,
        hpf,
        compressor,
        pan,
        fader,
        busGain,
        fxSends,
        mixSends,
      });
    },
    [ensureMaster, getAudioSourceForDevice, getMeshStream, linkedUsbAudio, teardownChain],
  );

  const updateGains = useCallback(() => {
    const master = masterGainRef.current;
    const monitor = monitorGainRef.current;
    if (!master || !monitor) return;

    const masterLevel = state.masterMuted ? 0 : state.masterVolume / 100;
    master.gain.value = masterLevel;
    setPgmGain(masterLevel);

    for (const [deviceId, chain] of chainsRef.current) {
      const fat = getFatChannelParams(state, deviceId);
      const nc = getNoiseCancelSettings(state, deviceId);
      const floor = getLearnedNoiseFloor(state, deviceId);
      const fader = channelFaderGain(state, deviceId);

      const hpfActive = !fat.hpfBypass && fat.hpf > 0;
      chain.hpf.frequency.value = hpfActive ? hpfFrequency(fat.hpf) : 24;

      const comp = compAmount(fat.comp);
      chain.compressor.threshold.value = comp.threshold;
      chain.compressor.ratio.value = comp.ratio;
      chain.pan.pan.value = Math.max(-1, Math.min(1, fat.pan / 100));
      chain.fader.gain.value = fader;
      chain.busGain.gain.value = 1;

      if (nc.enabled) {
        const mix = ncMixAmount(nc.strength);
        chain.ncWet.gain.value = mix;
        chain.ncDry.gain.value = Math.max(0.15, 1 - mix * 0.85);

        chain.ncRumble.frequency.value = nc.rumbleCut
          ? rumbleHighpassHz(nc.strength)
          : 28;
        chain.ncRumble.Q.value = 0.75;

        chain.ncHum.frequency.value = humNotchFrequency();
        chain.ncHum.Q.value = nc.enabled ? 2.8 : 0.5;

        if (nc.autoGate) {
          const gate = noiseGateParams(nc.strength, floor);
          chain.ncGate.threshold.value = gate.threshold;
          chain.ncGate.ratio.value = gate.ratio;
          chain.ncGate.attack.value = gate.attack;
          chain.ncGate.release.value = gate.release;
          chain.ncGate.knee.value = gate.knee;
        } else {
          chain.ncGate.threshold.value = 0;
          chain.ncGate.ratio.value = 1;
        }

        if (nc.voiceFocus) {
          chain.ncVoice.frequency.value = voicePresenceHz();
          chain.ncVoice.Q.value = 1.1;
          chain.ncVoice.gain.value = voicePresenceGainDb(nc.strength);
        } else {
          chain.ncVoice.gain.value = 0;
        }

        chain.ncHiss.frequency.value = hissLowpassHz(nc.strength);
        chain.ncHiss.Q.value = 0.65;
      } else {
        chain.ncWet.gain.value = 0;
        chain.ncDry.gain.value = 1;
        chain.ncRumble.frequency.value = 28;
        chain.ncGate.threshold.value = 0;
        chain.ncGate.ratio.value = 1;
        chain.ncVoice.gain.value = 0;
        chain.ncHiss.frequency.value = 20_000;
      }

      ([1, 2, 3, 4] as const).forEach((bus) => {
        const send = (state.mixSends[deviceId]?.[bus] ?? 0) / 100;
        chain.mixSends[bus].gain.value = send * fader;
        mixBusesRef.current[bus].gain.gain.value = 1;
      });

      (['A', 'B', 'C', 'D'] as const).forEach((slot) => {
        const fxOn = state.fxEnabled[slot];
        const mix = state.fxMix[slot] / 100;
        chain.fxSends[slot].gain.value = fxOn ? fader * mix : 0;
        const fx = fxNodesRef.current[slot];
        if (fx) fx.output.gain.value = fxOn ? 0.65 : 0;
      });
    }

    const soloId = state.soloId;
    const monitorDeviceId = soloId ?? (() => {
      const real = devices.filter((d) => isRealDevice(d) && d.status !== 'offline');
      const padded = [...real];
      while (padded.length < AUDIO_MIXER_MAX_CHANNELS) {
        padded.push(createEmptyAudioSlot(padded.length + 1));
      }
      const selected = padded[state.selectedChannel];
      return selected && isRealDevice(selected) ? selected.deviceId : real[0]?.deviceId ?? null;
    })();

    if (monitorChainRef.current && monitorChainRef.current.deviceId !== monitorDeviceId) {
      monitorChainRef.current.tap.disconnect();
      monitorChainRef.current = null;
    }

    if (monitorDeviceId && !state.monitorMuted) {
      const chain = chainsRef.current.get(monitorDeviceId);
      if (chain) {
        if (!monitorChainRef.current) {
          const tap = chain.busGain.context.createGain();
          chain.busGain.connect(tap);
          tap.connect(monitor);
          monitorChainRef.current = { deviceId: monitorDeviceId, tap };
        }
        const aud = channelAudible(state, monitorDeviceId);
        monitor.gain.value = aud
          ? (state.monitorVolume / 100) * (state.inputVolumes[monitorDeviceId] ?? 75) / 100
          : 0;
      } else {
        monitor.gain.value = 0;
      }
    } else {
      monitor.gain.value = 0;
    }
  }, [devices, setPgmGain, state]);

  useEffect(() => {
    if (!learningNoiseFor || !onNoiseFloorLearned) return;
    const chain = chainsRef.current.get(learningNoiseFor);
    if (!chain) return;

    const analyser = chain.ncLearnAnalyser;
    const buf = new Uint8Array(analyser.fftSize);
    const samples: number[] = [];
    const started = performance.now();
    const durationMs = 2000;

    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      samples.push(rms);

      if (performance.now() - started < durationMs) {
        requestAnimationFrame(tick);
        return;
      }

      const avg = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
      const floor = Math.min(95, Math.max(8, Math.round(avg * 420)));
      onNoiseFloorLearned(learningNoiseFor, floor);
    };

    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [learningNoiseFor, onNoiseFloorLearned]);

  useEffect(() => {
    const live = devices.filter((d) => isRealDevice(d) && d.status !== 'offline');
    void (async () => {
      const ctx = await ensureMaster();
      if (isDashboardAudioUnlocked() && ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* needs gesture */
        }
      }
      for (const device of live) {
        await wireChannel(device);
      }
      updateGains();
    })();

    const stale = [...chainsRef.current.keys()].filter(
      (id) => !live.some((d) => d.deviceId === id),
    );
    stale.forEach((id) => {
      const chain = chainsRef.current.get(id);
      if (chain) teardownChain(chain);
    });
  }, [devices, meshStreams, meshStreamRevision, ensureMaster, teardownChain, updateGains, wireChannel]);

  useEffect(() => {
    updateGains();
  }, [state, updateGains]);

  useEffect(() => {
    const rewire = () => {
      const live = devices.filter((d) => isRealDevice(d) && d.status !== 'offline');
      void (async () => {
        const ctx = await ensureMaster();
        if (ctx.state === 'suspended') {
          try {
            await ctx.resume();
          } catch {
            /* gesture required */
          }
        }
        for (const device of live) {
          await wireChannel(device);
        }
        updateGains();
        const dest = broadcastDestRef.current?.stream ?? null;
        if (dest) registerPgmPlaybackStream(dest);
      })();
    };

    window.addEventListener('cloudcast-audio-unlocked', rewire);
    return () => window.removeEventListener('cloudcast-audio-unlocked', rewire);
  }, [devices, ensureMaster, registerPgmPlaybackStream, updateGains, wireChannel]);

  useEffect(() => {
    return () => {
      chainsRef.current.forEach((chain) => {
        try {
          chain.source.disconnect();
        } catch {
          /* ignore */
        }
      });
      chainsRef.current.clear();
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return {
    masterLevel: getVolumeForDevice(state, state.soloId ?? devices.find(isRealDevice)?.deviceId ?? null),
  };
}
