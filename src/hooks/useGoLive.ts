import { useCallback, useState } from 'react';
import type { PlanTier } from '../types/plans';
import type { StreamDestination } from '../types/streaming';
import { fetchStreamDestinations } from '../lib/streamingService';
import { validateConcurrentStreamStart, resolveStreamLimits } from '../lib/streamingLimits';
import {
  findIncompleteEnabledDestinations,
  getEnabledDestinations,
  testStreamDestination,
  type StreamValidationResult,
} from '../lib/streamValidation';

export type StreamNoticeType = 'error' | 'success' | 'info';

export interface StreamNotice {
  type: StreamNoticeType;
  message: string;
}

interface UseGoLiveOptions {
  planId: PlanTier;
  isOnAir: boolean;
  setOnAir: (onAir: boolean) => void;
  setActivePanel?: (panel: 'stream') => void;
  startBroadcast?: (destinations: StreamDestination[]) => Promise<{ ok: boolean; message: string }>;
  stopBroadcast?: () => Promise<void>;
}

export function useGoLive({
  planId,
  isOnAir,
  setOnAir,
  setActivePanel,
  startBroadcast,
  stopBroadcast,
}: UseGoLiveOptions) {
  const [isValidating, setIsValidating] = useState(false);
  const [streamNotice, setStreamNotice] = useState<StreamNotice | null>(null);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const clearStreamNotice = useCallback(() => setStreamNotice(null), []);

  const goOffline = useCallback(async () => {
    try {
      await stopBroadcast?.();
    } catch {
      /* still go off air */
    }
    setOnAir(false);
    setStreamNotice({ type: 'info', message: 'Stream stopped. You are off air.' });
  }, [setOnAir, stopBroadcast]);

  const confirmStopStream = useCallback(() => {
    setShowStopConfirm(false);
    void goOffline();
  }, [goOffline]);

  const cancelStopStream = useCallback(() => setShowStopConfirm(false), []);

  const validateDestinations = useCallback(
    async (destinations: StreamDestination[]): Promise<StreamValidationResult & { destinationName?: string }> => {
      const limits = resolveStreamLimits(planId);
      const enabled = getEnabledDestinations(destinations);
      const incomplete = findIncompleteEnabledDestinations(destinations);

      if (incomplete.length > 0) {
        return {
          ok: false,
          message: `“${incomplete[0].name}” is enabled but missing a stream URL or stream key. Open the Stream panel to finish setup.`,
          stage: 'format',
          destinationName: incomplete[0].name,
        };
      }

      if (enabled.length === 0) {
        return {
          ok: false,
          message: 'No stream settings configured. Add a stream URL and stream key in the Stream panel before going ON AIR.',
          stage: 'format',
        };
      }

      const concurrentErr = validateConcurrentStreamStart(enabled.length, limits);
      if (concurrentErr) {
        return { ok: false, message: concurrentErr, stage: 'format' };
      }

      let remoteUnavailable = false;

      for (const dest of enabled) {
        const result = await testStreamDestination(dest);
        if (result.ok) continue;

        const unreachable =
          result.stage === 'connect' &&
          /could not reach|failed to fetch|network|edge function/i.test(result.message);

        if (unreachable) {
          remoteUnavailable = true;
          continue;
        }

        return {
          ...result,
          message: `${dest.name}: ${result.message}`,
          destinationName: dest.name,
        };
      }

      const suffix = remoteUnavailable
        ? ' (validation service unreachable — format checks only)'
        : '';
      return {
        ok: true,
        message: `Starting broadcast to ${enabled.length} destination(s)${suffix}.`,
      };
    },
    [planId],
  );

  const resumeBroadcast = useCallback(async (): Promise<{
    ok: boolean;
    message: string;
    fatal?: boolean;
  }> => {
    try {
      const destinations = await fetchStreamDestinations();
      const enabled = getEnabledDestinations(destinations);
      const incomplete = findIncompleteEnabledDestinations(destinations);

      if (incomplete.length > 0) {
        return {
          ok: false,
          fatal: true,
          message: `“${incomplete[0].name}” is enabled but missing stream URL or key. Open Stream settings.`,
        };
      }

      if (enabled.length === 0) {
        return {
          ok: false,
          fatal: true,
          message: 'No enabled stream destinations. Configure Stream settings before resuming.',
        };
      }

      if (!startBroadcast) {
        return {
          ok: false,
          fatal: true,
          message: 'Broadcast encoder is not available. Reload the dashboard and try again.',
        };
      }

      const broadcast = await startBroadcast(enabled);
      if (!broadcast.ok) {
        const noSignal = /no video signal|wait for video/i.test(broadcast.message);
        return {
          ok: false,
          fatal: !noSignal,
          message: broadcast.message,
        };
      }

      return { ok: true, message: broadcast.message };
    } catch (e) {
      return {
        ok: false,
        fatal: true,
        message: e instanceof Error ? e.message : 'Failed to resume broadcast.',
      };
    }
  }, [startBroadcast]);

  const goLive = useCallback(async () => {
    clearStreamNotice();

    if (isOnAir) {
      setShowStopConfirm(true);
      return;
    }

    setIsValidating(true);
    try {
      const destinations = await fetchStreamDestinations();
      const result = await validateDestinations(destinations);

      if (!result.ok) {
        setStreamNotice({ type: 'error', message: result.message });
        setActivePanel?.('stream');
        return;
      }

      const enabled = getEnabledDestinations(destinations);
      if (!startBroadcast) {
        setStreamNotice({
          type: 'error',
          message: 'Broadcast encoder is not available. Reload the dashboard and try again.',
        });
        return;
      }

      const broadcast = await startBroadcast(enabled);
      if (!broadcast.ok) {
        setOnAir(false);
        setStreamNotice({ type: 'error', message: broadcast.message });
        setActivePanel?.('stream');
        return;
      }

      setOnAir(true);
      setStreamNotice({ type: 'success', message: broadcast.message });
    } catch (e) {
      setStreamNotice({
        type: 'error',
        message: e instanceof Error ? e.message : 'Failed to start stream.',
      });
      setActivePanel?.('stream');
    } finally {
      setIsValidating(false);
    }
  }, [clearStreamNotice, isOnAir, setActivePanel, setOnAir, startBroadcast, validateDestinations]);

  const testAndSaveNotice = useCallback(
    async (dest: Pick<StreamDestination, 'name' | 'streamUrl' | 'streamKey' | 'platform'>) => {
      setIsValidating(true);
      clearStreamNotice();
      try {
        const result = await testStreamDestination(dest);
        if (result.ok) {
          setStreamNotice({ type: 'success', message: `${dest.name}: ${result.message}` });
        } else {
          setStreamNotice({ type: 'error', message: `${dest.name}: ${result.message}` });
        }
        return result;
      } finally {
        setIsValidating(false);
      }
    },
    [clearStreamNotice],
  );

  return {
    goLive,
    goOffline,
    resumeBroadcast,
    isValidating,
    streamNotice,
    setStreamNotice,
    clearStreamNotice,
    validateDestinations,
    testAndSaveNotice,
    showStopConfirm,
    confirmStopStream,
    cancelStopStream,
  };
}
