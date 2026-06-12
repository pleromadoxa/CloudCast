/** Resume browser audio output after a user gesture (monitor / PGM unmute). */

const CONTEXT_REGISTERED = 'cloudcast-audio-context-registered';

type AudioWindow = Window & {
  __cloudcastPlaybackCtx?: AudioContext;
  __cloudcastPgmCtx?: AudioContext;
  __cloudcastMixerCtx?: AudioContext;
  __cloudcastAnalyserCtx?: AudioContext;
  __cloudcastUnlockCtx?: AudioContext;
  __cloudcastMonitorVideos?: Set<HTMLVideoElement>;
  __cloudcastAudioUnlocked?: boolean;
};

const registeredContexts = new Set<AudioContext>();

function audioWindow(): AudioWindow | null {
  if (typeof window === 'undefined') return null;
  return window as AudioWindow;
}

function syncLegacyContextRefs(): void {
  const w = audioWindow();
  if (!w) return;
  const legacy = [
    w.__cloudcastPlaybackCtx,
    w.__cloudcastPgmCtx,
    w.__cloudcastMixerCtx,
    w.__cloudcastAnalyserCtx,
    w.__cloudcastUnlockCtx,
  ];
  for (const ctx of legacy) {
    if (ctx && ctx.state !== 'closed') registeredContexts.add(ctx);
  }
}

/** Register an AudioContext so unlock can resume it after a user gesture. */
export function registerDashboardAudioContext(ctx: AudioContext): void {
  if (ctx.state === 'closed') return;
  registeredContexts.add(ctx);
  syncLegacyContextRefs();

  if (isDashboardAudioUnlocked()) {
    void resumeDashboardAudioContext(ctx);
  }

  window.dispatchEvent(new CustomEvent(CONTEXT_REGISTERED));
}

async function resumeDashboardAudioContext(ctx: AudioContext): Promise<boolean> {
  if (ctx.state === 'closed') return false;
  if (ctx.state === 'running') return true;
  try {
    await ctx.resume();
  } catch {
    return false;
  }
  return ctx.state !== 'suspended';
}

/** Play a silent buffer — required on Safari/iOS to open the audio device. */
async function primeAudioOutput(ctx: AudioContext): Promise<void> {
  if (ctx.state === 'closed') return;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    source.stop(ctx.currentTime + 0.05);
  } catch {
    /* best-effort */
  }
}

async function createBootstrapContext(): Promise<AudioContext | null> {
  const w = audioWindow();
  if (!w) return null;

  let ctx = w.__cloudcastUnlockCtx;
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext();
    w.__cloudcastUnlockCtx = ctx;
    registerDashboardAudioContext(ctx);
  }

  await primeAudioOutput(ctx);
  return ctx;
}

/** Resume every registered AudioContext and prime speaker output. */
export async function unlockDashboardAudio(): Promise<boolean> {
  const w = audioWindow();
  if (!w) return false;

  syncLegacyContextRefs();

  try {
    await createBootstrapContext();

    const contexts = [...registeredContexts].filter((ctx) => ctx.state !== 'closed');
    await Promise.all(contexts.map((ctx) => resumeDashboardAudioContext(ctx)));

    const anyRunning = contexts.some((ctx) => ctx.state === 'running');
    if (anyRunning) {
      w.__cloudcastAudioUnlocked = true;
      window.dispatchEvent(new CustomEvent('cloudcast-audio-unlocked'));
    }
  } catch {
    /* retry on next gesture */
  }

  const monitors = w.__cloudcastMonitorVideos;
  if (monitors?.size) {
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

  return isDashboardAudioReady();
}

export function isDashboardAudioUnlocked(): boolean {
  return Boolean(audioWindow()?.__cloudcastAudioUnlocked);
}

/** True when audio contexts exist and at least one is running. */
export function isDashboardAudioReady(): boolean {
  syncLegacyContextRefs();
  const contexts = [...registeredContexts].filter((ctx) => ctx.state !== 'closed');
  if (contexts.length === 0) return isDashboardAudioUnlocked();
  return contexts.some((ctx) => ctx.state === 'running');
}

/** @deprecated use unlockDashboardAudio — resumes existing contexts only (no gesture unlock). */
export async function ensureAudioOutputReady(): Promise<void> {
  if (isDashboardAudioReady()) return;
  syncLegacyContextRefs();
  await Promise.all(
    [...registeredContexts]
      .filter((ctx) => ctx.state !== 'closed')
      .map((ctx) => resumeDashboardAudioContext(ctx)),
  );
}

export function registerMonitorAudioElement(el: HTMLVideoElement | null): void {
  const w = audioWindow();
  if (!w) return;
  if (!w.__cloudcastMonitorVideos) {
    w.__cloudcastMonitorVideos = new Set();
  }
  if (el) {
    w.__cloudcastMonitorVideos.add(el);
  }
}

export function unregisterMonitorAudioElement(el: HTMLVideoElement): void {
  audioWindow()?.__cloudcastMonitorVideos?.delete(el);
}

export const DASHBOARD_AUDIO_CONTEXT_REGISTERED = CONTEXT_REGISTERED;
