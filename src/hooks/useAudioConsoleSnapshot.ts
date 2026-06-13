import { useEffect } from 'react';
import { saveAudioConsoleSnapshot } from '../lib/audioConsoleSnapshot';

interface UseAudioConsoleSnapshotPublisherOptions {
  enabled: boolean;
  sessionId: string | null | undefined;
  operatorKey: string;
  operatorLabel: string | null;
  masterVolume: number;
  masterMuted: boolean;
  monitorMuted: boolean;
  consoleEnabled: boolean;
  activeScene: string | null;
  selectedChannel: number;
  liveInputCount: number;
  mutedChannelCount: number;
  bridgeConnected: boolean;
  intervalMs?: number;
}

export function useAudioConsoleSnapshotPublisher(options: UseAudioConsoleSnapshotPublisherOptions) {
  const {
    enabled,
    sessionId,
    operatorKey,
    operatorLabel,
    masterVolume,
    masterMuted,
    monitorMuted,
    consoleEnabled,
    activeScene,
    selectedChannel,
    liveInputCount,
    mutedChannelCount,
    bridgeConnected,
    intervalMs = 30_000,
  } = options;

  useEffect(() => {
    if (!enabled || !sessionId || !consoleEnabled) return;

    const save = () => {
      void saveAudioConsoleSnapshot({
        sessionId,
        operatorKey,
        operatorLabel: operatorLabel ?? undefined,
        masterVolume,
        masterMuted,
        monitorMuted,
        consoleEnabled,
        activeScene,
        selectedChannel,
        liveInputCount,
        mutedChannelCount,
        bridgeConnected,
      });
    };

    save();
    const timer = window.setInterval(save, intervalMs);
    return () => window.clearInterval(timer);
  }, [
    enabled,
    sessionId,
    operatorKey,
    operatorLabel,
    masterVolume,
    masterMuted,
    monitorMuted,
    consoleEnabled,
    activeScene,
    selectedChannel,
    liveInputCount,
    mutedChannelCount,
    bridgeConnected,
    intervalMs,
  ]);
}
