import { useEffect, useRef } from 'react';
import { isPgmReadyForBroadcast } from '../lib/broadcast/pgmProgramCapture';
import type { BroadcastStatus } from './usePgmBroadcast';
import type { StreamNotice } from './useGoLive';

const RETRY_INTERVAL_MS = 2_000;

interface UseBroadcastAutoResumeOptions {
  wantsResume: boolean;
  sessionLoading: boolean;
  isSignalingConnected: boolean;
  broadcastStatus: BroadcastStatus;
  getPgmOutputContainer: () => HTMLElement | null;
  resumeBroadcast: () => Promise<{ ok: boolean; message: string; fatal?: boolean }>;
  setOnAir: (onAir: boolean) => void;
  setStreamNotice: (notice: StreamNotice | null) => void;
}

/** While ON AIR, keep trying to restore a live relay encode whenever the broadcast drops. */
export function useBroadcastAutoResume({
  wantsResume,
  sessionLoading,
  isSignalingConnected,
  broadcastStatus,
  getPgmOutputContainer,
  resumeBroadcast,
  setOnAir,
  setStreamNotice,
}: UseBroadcastAutoResumeOptions) {
  const resumingRef = useRef(false);
  const lastNoticeAtRef = useRef(0);

  useEffect(() => {
    if (!wantsResume || sessionLoading) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delay = RETRY_INTERVAL_MS) => {
      if (cancelled) return;
      timer = setTimeout(() => void tick(), delay);
    };

    const maybeNotice = (notice: StreamNotice) => {
      const now = Date.now();
      if (now - lastNoticeAtRef.current < 8_000) return;
      lastNoticeAtRef.current = now;
      setStreamNotice(notice);
    };

    const tick = async () => {
      if (cancelled || !wantsResume) return;

      if (broadcastStatus === 'live' || broadcastStatus === 'connecting') {
        schedule();
        return;
      }

      if (!isSignalingConnected) {
        maybeNotice({
          type: 'info',
          message: 'ON AIR — waiting for mixer signaling before resuming broadcast…',
        });
        schedule();
        return;
      }

      if (!isPgmReadyForBroadcast(getPgmOutputContainer())) {
        maybeNotice({
          type: 'info',
          message: 'ON AIR — waiting for program video before resuming broadcast…',
        });
        schedule();
        return;
      }

      if (resumingRef.current) {
        schedule();
        return;
      }

      resumingRef.current = true;
      maybeNotice({ type: 'info', message: 'Reconnecting live broadcast…' });

      try {
        const result = await resumeBroadcast();
        if (cancelled) return;

        if (result.ok) {
          setOnAir(true);
          setStreamNotice({ type: 'success', message: result.message });
        } else if (result.fatal) {
          setOnAir(false);
          setStreamNotice({ type: 'error', message: result.message });
        } else {
          maybeNotice({ type: 'info', message: result.message || 'Retrying broadcast…' });
        }
      } finally {
        resumingRef.current = false;
        schedule();
      }
    };

    schedule(broadcastStatus === 'reconnecting' || broadcastStatus === 'error' ? 400 : RETRY_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    wantsResume,
    sessionLoading,
    isSignalingConnected,
    broadcastStatus,
    getPgmOutputContainer,
    resumeBroadcast,
    setOnAir,
    setStreamNotice,
  ]);
}
