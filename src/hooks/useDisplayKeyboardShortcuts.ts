import { useEffect } from 'react';

interface DisplayKeyboardActions {
  prevSlide: () => void;
  nextSlide: () => void;
  goLive: () => void;
  takeLiveAndAdvance: () => void;
  clearLive: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

/** Operator keyboard shortcuts for Regal Display (ignored while typing in inputs). */
export function useDisplayKeyboardShortcuts(enabled: boolean, actions: DisplayKeyboardActions) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          actions.prevSlide();
          break;
        case 'ArrowRight':
          event.preventDefault();
          actions.nextSlide();
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (event.shiftKey) actions.takeLiveAndAdvance();
          else actions.goLive();
          break;
        case 'Escape':
          event.preventDefault();
          actions.clearLive();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, actions]);
}
