import { useEffect } from 'react';
import { unlockDashboardAudio } from '../lib/audioOutput';
import type { AudioConsoleState } from './useAudioConsoleState';

interface ShortcutHandlers {
  onSelectChannel: (index: number) => void;
  onToggleMute: (deviceId: string) => void;
  onToggleSolo: (deviceId: string) => void;
  onToggleMasterMute: () => void;
  onToggleMonitorMute: () => void;
  onStoreScene: (scene: 'A' | 'B' | 'C' | 'D') => void;
  onRecallScene: (scene: 'A' | 'B' | 'C' | 'D') => void;
}

export function useAudioConsoleShortcuts(
  state: AudioConsoleState,
  channelDeviceIds: string[],
  handlers: ShortcutHandlers,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const num = Number(e.key);
      if (num >= 1 && num <= 9 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const index = num - 1;
        if (index < channelDeviceIds.length) {
          handlers.onSelectChannel(index);
          e.preventDefault();
        }
        return;
      }

      const selectedId = channelDeviceIds[state.selectedChannel];
      if (!selectedId) return;

      if (e.key === 'm' || e.key === 'M') {
        void unlockDashboardAudio();
        if (e.shiftKey) handlers.onToggleMasterMute();
        else handlers.onToggleMute(selectedId);
        e.preventDefault();
      }
      if (e.key === 's' || e.key === 'S') {
        handlers.onToggleSolo(selectedId);
        e.preventDefault();
      }
      if (e.key === 'h' || e.key === 'H') {
        void unlockDashboardAudio();
        handlers.onToggleMonitorMute();
        e.preventDefault();
      }

      const sceneKey = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(sceneKey) && e.shiftKey) {
        handlers.onStoreScene(sceneKey as 'A' | 'B' | 'C' | 'D');
        e.preventDefault();
      } else if (['A', 'B', 'C', 'D'].includes(sceneKey) && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        handlers.onRecallScene(sceneKey as 'A' | 'B' | 'C' | 'D');
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [channelDeviceIds, handlers, state.selectedChannel, enabled]);
}
