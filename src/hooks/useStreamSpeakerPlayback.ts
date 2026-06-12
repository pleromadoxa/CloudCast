import { useEffect, useRef } from 'react';
import { rampGainDown, rampGainUp } from '../lib/audioFade';
import { ensureAudioOutputReady, isDashboardAudioUnlocked, registerDashboardAudioContext, unlockDashboardAudio } from '../lib/audioOutput';
import {
  acquireStreamSource,
  hasUsableAudio,
  releaseStreamSource,
} from '../lib/streamAudioHub';

let playbackContext: AudioContext | null = null;

function getPlaybackContext(): AudioContext {
  if (!playbackContext || playbackContext.state === 'closed') {
    playbackContext = new AudioContext();
    registerDashboardAudioContext(playbackContext);
    if (typeof window !== 'undefined') {
      (window as Window & { __cloudcastPlaybackCtx?: AudioContext }).__cloudcastPlaybackCtx =
        playbackContext;
    }
  }
  return playbackContext;
}

function applyGain(gain: GainNode, volume: number) {
  const ctx = playbackContext;
  if (!ctx) return;
  const next = Math.min(1, Math.max(0, volume));
  const now = ctx.currentTime;
  try {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(next, now, 0.02);
  } catch {
    gain.gain.value = next;
  }
}

/** Route a MediaStream to the browser speakers (monitor bus). */
export function useStreamSpeakerPlayback(
  stream: MediaStream | null,
  active: boolean,
  volume: number,
) {
  const gainRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const teardown = async () => {
    const gain = gainRef.current;
    const stream = streamRef.current;
    gainRef.current = null;
    streamRef.current = null;

    if (gain) {
      await rampGainDown(gain);
      try {
        gain.disconnect();
      } catch {
        /* ignore */
      }
    }

    if (stream) {
      releaseStreamSource(getPlaybackContext(), stream);
    }
  };

  const connect = async (targetStream: MediaStream, vol: number) => {
    if (streamRef.current === targetStream && gainRef.current) {
      applyGain(gainRef.current, vol);
      return;
    }

    await teardown();
    if (vol <= 0 || !hasUsableAudio(targetStream)) return;

    await ensureAudioOutputReady();
    if (isDashboardAudioUnlocked()) {
      await unlockDashboardAudio();
    }
    const ctx = getPlaybackContext();
    if (ctx.state === 'suspended') await ctx.resume();

    const source = acquireStreamSource(ctx, targetStream);
    if (!source) return;

    try {
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);
      gainRef.current = gain;
      streamRef.current = targetStream;
      rampGainUp(gain, vol);
    } catch (err) {
      console.warn('[CloudCast] Monitor speaker playback failed:', err);
      releaseStreamSource(ctx, targetStream);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      if (!active || !stream || volume <= 0) {
        void teardown();
        return;
      }
      if (!hasUsableAudio(stream)) return;
      void connect(stream, volume);
    };

    sync();

    const onTrackChange = () => sync();
    stream?.addEventListener('addtrack', onTrackChange);
    stream?.addEventListener('removetrack', onTrackChange);

    return () => {
      cancelled = true;
      stream?.removeEventListener('addtrack', onTrackChange);
      stream?.removeEventListener('removetrack', onTrackChange);
      void teardown();
    };
  }, [stream, active, volume]);

  useEffect(() => {
    if (!gainRef.current || !active || !stream || volume <= 0) return;
    applyGain(gainRef.current, volume);
  }, [volume, active, stream]);
}
