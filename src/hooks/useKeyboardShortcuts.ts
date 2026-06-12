import { useEffect } from 'react';
import type { KeyboardShortcutBindings, ShortcutActionId } from '../types/keyboardShortcuts';
import { SECONDARY_TAKE_KEY } from '../types/keyboardShortcuts';
import { findActionForEvent, keyEventToBinding, slotIndexFromAction } from '../lib/keyboardBinding';

export interface ShortcutHandlers {
  onCut: () => void;
  onTake: () => void;
  onFadeBlack: () => void;
  onSelectSource: (index: number) => void;
  onCutToSource: (index: number) => void;
  onToggleOnAir: () => void;
  onToggleMultiview: () => void;
  onToggleFullscreen: () => void;
  onToggleRecording: () => void;
  onSwap: () => void;
  maxSlots?: number;
}

function dispatchAction(actionId: ShortcutActionId, handlers: ShortcutHandlers): boolean {
  const slotIdx = slotIndexFromAction(actionId);
  if (slotIdx !== null) {
    const max = handlers.maxSlots ?? 10;
    if (slotIdx >= max) return false;
    if (actionId.startsWith('cut_source_')) handlers.onCutToSource(slotIdx);
    else handlers.onSelectSource(slotIdx);
    return true;
  }

  switch (actionId) {
    case 'cut':
      handlers.onCut();
      return true;
    case 'take':
      handlers.onTake();
      return true;
    case 'fade_black':
      handlers.onFadeBlack();
      return true;
    case 'toggle_on_air':
      handlers.onToggleOnAir();
      return true;
    case 'toggle_multiview':
      handlers.onToggleMultiview();
      return true;
    case 'toggle_fullscreen':
      handlers.onToggleFullscreen();
      return true;
    case 'toggle_recording':
      handlers.onToggleRecording();
      return true;
    case 'swap_pst_pgm':
      handlers.onSwap();
      return true;
    default:
      return false;
  }
}

export function useKeyboardShortcuts(
  bindings: KeyboardShortcutBindings,
  handlers: ShortcutHandlers,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      let actionId = findActionForEvent(bindings, e);
      if (!actionId && keyEventToBinding(e) === SECONDARY_TAKE_KEY) {
        actionId = 'take';
      }
      if (!actionId) return;

      if (dispatchAction(actionId, handlers)) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bindings, handlers, enabled]);
}
