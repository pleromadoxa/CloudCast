/** Resume browser audio output after a user gesture (monitor / PGM unmute). */
export async function unlockDashboardAudio(): Promise<void> {
  if (typeof window === 'undefined') return;

  const w = window as Window & {
    __cloudcastPlaybackCtx?: AudioContext;
    __cloudcastMonitorVideos?: Set<HTMLVideoElement>;
  };

  try {
    const ctx = w.__cloudcastPlaybackCtx;
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
  } catch {
    /* ignore */
  }

  const monitors = w.__cloudcastMonitorVideos;
  if (!monitors?.size) return;

  await Promise.all(
    Array.from(monitors).map(async (el) => {
      if (el.srcObject && !el.muted && el.volume > 0) {
        try {
          await el.play();
        } catch {
          /* may need another gesture */
        }
      }
    }),
  );
}

/** @deprecated use unlockDashboardAudio */
export async function ensureAudioOutputReady(): Promise<void> {
  await unlockDashboardAudio();
}

export function registerMonitorAudioElement(el: HTMLVideoElement | null): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & { __cloudcastMonitorVideos?: Set<HTMLVideoElement> };
  if (!w.__cloudcastMonitorVideos) {
    w.__cloudcastMonitorVideos = new Set();
  }
  if (el) {
    w.__cloudcastMonitorVideos.add(el);
  }
}

export function unregisterMonitorAudioElement(el: HTMLVideoElement): void {
  if (typeof window === 'undefined') return;
  const w = window as Window & { __cloudcastMonitorVideos?: Set<HTMLVideoElement> };
  w.__cloudcastMonitorVideos?.delete(el);
}
