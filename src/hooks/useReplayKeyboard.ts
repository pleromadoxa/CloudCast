import { useEffect } from 'react';

interface ReplayKeyboardHandlers {
  onMarkIn: () => void;
  onMarkOut: () => void;
  onSaveBank: () => void;
  onPushPgm: () => void;
  onTogglePlay: () => void;
  onSelectBank: (index: number) => void;
  onStepFrame: (dir: 1 | -1) => void;
}

export function useReplayKeyboard(handlers: ReplayKeyboardHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const key = e.key.toLowerCase();
      if (key === 'i') {
        e.preventDefault();
        handlers.onMarkIn();
      } else if (key === 'o') {
        e.preventDefault();
        handlers.onMarkOut();
      } else if (key === 'enter') {
        e.preventDefault();
        handlers.onSaveBank();
      } else if (key === 'p') {
        e.preventDefault();
        handlers.onPushPgm();
      } else if (key === ' ') {
        e.preventDefault();
        handlers.onTogglePlay();
      } else if (key === 'arrowleft') {
        e.preventDefault();
        handlers.onStepFrame(-1);
      } else if (key === 'arrowright') {
        e.preventDefault();
        handlers.onStepFrame(1);
      } else if (key >= '1' && key <= '9') {
        handlers.onSelectBank(Number(key) - 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, handlers]);
}
