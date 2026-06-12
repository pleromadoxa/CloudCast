import { useCallback, useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import {
  DASHBOARD_AUDIO_CONTEXT_REGISTERED,
  isDashboardAudioReady,
  unlockDashboardAudio,
} from '../../lib/audioOutput';

export function AudioUnlockBanner() {
  const [ready, setReady] = useState(isDashboardAudioReady);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const syncReady = useCallback(() => {
    setReady(isDashboardAudioReady());
  }, []);

  const unlock = useCallback(async () => {
    setBusy(true);
    try {
      let ok = await unlockDashboardAudio();
      if (!ok) {
        await new Promise((r) => setTimeout(r, 400));
        ok = await unlockDashboardAudio();
      }
      if (!ok) {
        await new Promise((r) => setTimeout(r, 800));
        ok = await unlockDashboardAudio();
      }
      setReady(ok || isDashboardAudioReady());
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (ready) return;

    const onGesture = () => {
      void unlock();
    };

    const onContext = () => {
      if (isDashboardAudioReady()) {
        setReady(true);
        return;
      }
      void unlock();
    };

    window.addEventListener('cloudcast-audio-unlocked', syncReady);
    window.addEventListener(DASHBOARD_AUDIO_CONTEXT_REGISTERED, onContext);
    window.addEventListener('pointerdown', onGesture, { once: true, passive: true });
    window.addEventListener('keydown', onGesture, { once: true });

    return () => {
      window.removeEventListener('cloudcast-audio-unlocked', syncReady);
      window.removeEventListener(DASHBOARD_AUDIO_CONTEXT_REGISTERED, onContext);
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [ready, syncReady, unlock]);

  if (ready || dismissed) return null;

  return (
    <div className="audio-unlock-banner" role="status">
      <Volume2 className="h-4 w-4 shrink-0 text-sky-300" />
      <div className="audio-unlock-banner__text">
        <p className="audio-unlock-banner__title">Enable audio monitoring</p>
        <p className="audio-unlock-banner__hint">
          Browsers require a click before meters and speakers can run. Use the button below to unlock audio on this device.
        </p>
      </div>
      <button
        type="button"
        className="audio-unlock-banner__btn"
        disabled={busy}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          void unlock();
        }}
      >
        {busy ? 'Enabling…' : 'Enable audio'}
      </button>
      <button
        type="button"
        className="audio-unlock-banner__dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
