/** Short ramps to avoid clicks when Web Audio nodes connect/disconnect. */
export const AUDIO_MONITOR_FADE_SEC = 0.028;

export function rampGainUp(gain: GainNode, target: number, fadeSec = AUDIO_MONITOR_FADE_SEC): void {
  const ctx = gain.context;
  const now = ctx.currentTime;
  const next = Math.min(1, Math.max(0, target));
  try {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(next, now + fadeSec);
  } catch {
    gain.gain.value = next;
  }
}

export function rampGainDown(gain: GainNode, fadeSec = AUDIO_MONITOR_FADE_SEC): Promise<void> {
  const ctx = gain.context;
  const now = ctx.currentTime;
  try {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fadeSec);
  } catch {
    gain.gain.value = 0;
  }
  return new Promise((resolve) => {
    window.setTimeout(resolve, Math.ceil(fadeSec * 1000) + 8);
  });
}
