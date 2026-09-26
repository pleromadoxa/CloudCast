import { useEffect, useRef } from 'react';
import type { Device } from '../types/device';
import { isRealDevice } from '../types/device';
import { isPgmReadyForBroadcast } from '../lib/broadcast/pgmProgramCapture';
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
  getPgmOutputContainer,
  onReconnectSession,
  resumeBroadcast,
  setStreamNotice,
}: UseMixerConnectivityRecoveryOptions) {
  const lastTokenRef = useRef(reconnectToken);
  const devicesRef = useRef(devices);
  const isOnAirRef = useRef(isOnAir);
  const broadcastStatusRef = useRef(broadcastStatus);
  const getPgmOutputContainerRef = useRef(getPgmOutputContainer);
  const onReconnectSessionRef = useRef(onReconnectSession);
  const resumeBroadcastRef = useRef(resumeBroadcast);
  const setStreamNoticeRef = useRef(setStreamNotice);
  devicesRef.current = devices;
  isOnAirRef.current = isOnAir;
  broadcastStatusRef.current = broadcastStatus;
  getPgmOutputContainerRef.current = getPgmOutputContainer;
  onReconnectSessionRef.current = onReconnectSession;
  resumeBroadcastRef.current = resumeBroadcast;
  setStreamNoticeRef.current = setStreamNotice;

  useEffect(() => {
    if (!isOnline || reconnectToken === 0 || reconnectToken === lastTokenRef.current) {
      return;
    }

    let cancelled = false;

    setStreamNoticeRef.current({
      type: 'info',
      message: 'Internet restored — reconnecting mixer and streams…',
    });

    const run = async () => {
      lastTokenRef.current = reconnectToken;
      onReconnectSessionRef.current();

      for (const device of devicesRef.current) {
        if (!isRealDevice(device)) continue;
        reconnectWhepPoolDevice(device.deviceId);
        window.dispatchEvent(
          new CustomEvent('cloudcast:reconnect', { detail: { deviceId: device.deviceId } }),
        );
      }

      const needsBroadcastResume = isOnAirRef.current && broadcastStatusRef.current !== 'live';

      if (!needsBroadcastResume) {
        if (!cancelled) {
          setStreamNoticeRef.current({
            type: 'success',
            message: 'Connection restored. Live feeds are reconnecting.',
          });
        }
        return;
      }

      const deadline = Date.now() + SIGNAL_WAIT_MS;
      while (!cancelled && Date.now() < deadline) {
        if (isPgmReadyForBroadcast(getPgmOutputContainerRef.current())) {
          const result = await resumeBroadcastRef.current();
          if (cancelled) return;
          if (result.ok) {
            setStreamNoticeRef.current({
              type: 'success',
              message: `Connection restored. ${result.message}`,
            });
            return;
          }
          if (result.fatal) {
            setStreamNoticeRef.current({ type: 'error', message: result.message });
            return;
          }
        }

        await sleep(RETRY_MS);
        onReconnectSessionRef.current();
      }

      if (!cancelled) {
        setStreamNoticeRef.current({
          type: 'info',
          message:
            'Connection restored. Broadcast will resume automatically when program video returns.',
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [reconnectToken, isOnline]);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
