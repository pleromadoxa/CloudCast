import { useEffect, useRef } from 'react';
import type { Device } from '../types/device';
import { isRealDevice } from '../types/device';
import { hasPgmVideoSignal } from '../lib/broadcast/pgmProgramCapture';
import type { BroadcastStatus } from './usePgmBroadcast';
import type { StreamNotice } from './useGoLive';

const RESUME_TIMEOUT_MS = 90_000;
const RETRY_INTERVAL_MS = 2_000;

interface UseBroadcastAutoResumeOptions {
  wantsResume: boolean;
  sessionLoading: boolean;
  isSignalingConnected: boolean;
  broadcastStatus: BroadcastStatus;
  pgmDevice: Device | null;
  getPgmOutputContainer: () => HTMLElement | null;
  resumeBroadcast: () => Promise<{ ok: boolean; message: string; fatal?: boolean }>;
  setOnAir: (onAir: boolean) => void;
  setStreamNotice: (notice: StreamNotice | null) => void;
}

export function useBroadcastAutoResume({
  wantsResume,
  sessionLoading,
  isSignalingConnected,
  broadcastStatus,
  pgmDevice,
  getPgmOutputContainer,
  resumeBroadcast,
  setOnAir,
  setStreamNotice,
}: UseBroadcastAutoResumeOptions) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!wantsResume || sessionLoading || broadcastStatus === 'live' || startedRef.current) {
      return;
    }

    startedRef.current = true;
    let cancelled = false;

    setStreamNotice({
      type: 'info',
      message: 'Reconnecting broadcast — waiting for program video…',
    });

    const run = async () => {
      const deadline = Date.now() + RESUME_TIMEOUT_MS;

      while (!cancelled && Date.now() < deadline) {
        if (!isSignalingConnected) {
          await sleep(RETRY_INTERVAL_MS);
          continue;
        }

        const hasPgmSource =
          Boolean(pgmDevice && isRealDevice(pgmDevice)) &&
          (pgmDevice!.status === 'live' || pgmDevice!.status === 'connecting');
        const hasVideo = hasPgmVideoSignal(getPgmOutputContainer());

        if (!hasPgmSource || !hasVideo) {
          await sleep(RETRY_INTERVAL_MS);
          continue;
        }

        const result = await resumeBroadcast();
        if (cancelled) return;

        if (result.ok) {
          setOnAir(true);
          setStreamNotice({
            type: 'success',
            message: `Broadcast resumed: ${result.message}`,
          });
          return;
        }

        if (result.fatal) {
          setOnAir(false);
          setStreamNotice({ type: 'error', message: result.message });
          return;
        }

        await sleep(RETRY_INTERVAL_MS);
      }

      if (!cancelled) {
        setOnAir(false);
        setStreamNotice({
          type: 'error',
          message:
            'Could not resume broadcast — PGM video did not return in time. Press STREAM when ready.',
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    wantsResume,
    sessionLoading,
    isSignalingConnected,
    broadcastStatus,
    pgmDevice,
    getPgmOutputContainer,
    resumeBroadcast,
    setOnAir,
    setStreamNotice,
  ]);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
