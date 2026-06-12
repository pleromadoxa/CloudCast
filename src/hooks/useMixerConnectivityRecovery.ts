import { useEffect, useRef } from 'react';
import type { Device } from '../types/device';
import { isRealDevice } from '../types/device';
import { hasPgmVideoSignal } from '../lib/broadcast/pgmProgramCapture';
import { reconnectWhepPoolDevice } from '../lib/whepStreamPool';
import type { BroadcastStatus } from './usePgmBroadcast';
import type { StreamNotice } from './useGoLive';

const SIGNAL_WAIT_MS = 45_000;
const RETRY_MS = 1_500;

interface UseMixerConnectivityRecoveryOptions {
  reconnectToken: number;
  isOnline: boolean;
  devices: Device[];
  isOnAir: boolean;
  broadcastStatus: BroadcastStatus;
  pgmDevice: Device | null;
  getPgmOutputContainer: () => HTMLElement | null;
  onReconnectSession: () => void;
  resumeBroadcast: () => Promise<{ ok: boolean; message: string; fatal?: boolean }>;
  setStreamNotice: (notice: StreamNotice | null) => void;
}

/** After internet returns, reconnect signaling, inputs, and ON AIR broadcast without reloading. */
export function useMixerConnectivityRecovery({
  reconnectToken,
  isOnline,
  devices,
  isOnAir,
  broadcastStatus,
  pgmDevice,
  getPgmOutputContainer,
  onReconnectSession,
  resumeBroadcast,
  setStreamNotice,
}: UseMixerConnectivityRecoveryOptions) {
  const lastTokenRef = useRef(reconnectToken);

  useEffect(() => {
    if (!isOnline || reconnectToken === 0 || reconnectToken === lastTokenRef.current) {
      return;
    }
    lastTokenRef.current = reconnectToken;

    let cancelled = false;

    setStreamNotice({
      type: 'info',
      message: 'Internet restored — reconnecting mixer and streams…',
    });

    const run = async () => {
      onReconnectSession();

      for (const device of devices) {
        if (!isRealDevice(device)) continue;
        reconnectWhepPoolDevice(device.deviceId);
        window.dispatchEvent(
          new CustomEvent('cloudcast:reconnect', { detail: { deviceId: device.deviceId } }),
        );
      }

      const needsBroadcastResume = isOnAir && broadcastStatus !== 'live';

      if (!needsBroadcastResume) {
        if (!cancelled) {
          setStreamNotice({
            type: 'success',
            message: 'Connection restored. Live feeds are reconnecting.',
          });
        }
        return;
      }

      const deadline = Date.now() + SIGNAL_WAIT_MS;
      while (!cancelled && Date.now() < deadline) {
        const hasPgm =
          Boolean(pgmDevice && isRealDevice(pgmDevice)) &&
          (pgmDevice!.status === 'live' || pgmDevice!.status === 'connecting');
        const hasVideo = hasPgmVideoSignal(getPgmOutputContainer());

        if (hasPgm && hasVideo) {
          const result = await resumeBroadcast();
          if (cancelled) return;
          if (result.ok) {
            setStreamNotice({
              type: 'success',
              message: `Connection restored. ${result.message}`,
            });
            return;
          }
          if (result.fatal) {
            setStreamNotice({ type: 'error', message: result.message });
            return;
          }
        }

        await sleep(RETRY_MS);
        onReconnectSession();
      }

      if (!cancelled) {
        setStreamNotice({
          type: 'info',
          message:
            'Connection restored. Preview is reconnecting — press STREAM if ON AIR does not resume.',
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    reconnectToken,
    isOnline,
    devices,
    isOnAir,
    broadcastStatus,
    pgmDevice,
    getPgmOutputContainer,
    onReconnectSession,
    resumeBroadcast,
    setStreamNotice,
  ]);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
