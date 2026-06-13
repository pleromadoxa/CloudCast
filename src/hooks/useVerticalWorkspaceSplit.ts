import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

const STORAGE_KEY = 'cloudcast.dashboard.deckHeight';
const HANDLE_HEIGHT = 6;
const MIN_DECK_HEIGHT = 168;
const MIN_MONITOR_HEIGHT = 160;
const DEFAULT_DECK_HEIGHT = 280;

function readStoredDeckHeight(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DECK_HEIGHT;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= MIN_DECK_HEIGHT ? parsed : DEFAULT_DECK_HEIGHT;
  } catch {
    return DEFAULT_DECK_HEIGHT;
  }
}

function clampDeckHeight(
  height: number,
  workspaceHeight: number,
  trailingHeight: number,
): number {
  const maxDeck = Math.max(
    MIN_DECK_HEIGHT,
    workspaceHeight - MIN_MONITOR_HEIGHT - HANDLE_HEIGHT - trailingHeight,
  );
  return Math.min(Math.max(height, MIN_DECK_HEIGHT), maxDeck);
}

interface UseVerticalWorkspaceSplitOptions {
  workspaceRef: RefObject<HTMLElement | null>;
  trailingChromeRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
}

export function useVerticalWorkspaceSplit({
  workspaceRef,
  trailingChromeRef,
  enabled = true,
}: UseVerticalWorkspaceSplitOptions) {
  const [deckHeight, setDeckHeight] = useState(readStoredDeckHeight);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const measureBounds = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return null;
    const trailingHeight = trailingChromeRef.current?.offsetHeight ?? 0;
    return {
      workspaceHeight: workspace.clientHeight,
      trailingHeight,
    };
  }, [workspaceRef, trailingChromeRef]);

  const clampToWorkspace = useCallback(
    (height: number) => {
      const bounds = measureBounds();
      if (!bounds) return height;
      return clampDeckHeight(height, bounds.workspaceHeight, bounds.trailingHeight);
    },
    [measureBounds],
  );

  useEffect(() => {
    if (!enabled) return;
    setDeckHeight((current) => clampToWorkspace(current));
  }, [enabled, clampToWorkspace]);

  useEffect(() => {
    if (!enabled) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const observer = new ResizeObserver(() => {
      setDeckHeight((current) => clampToWorkspace(current));
    });
    observer.observe(workspace);
    if (trailingChromeRef.current) {
      observer.observe(trailingChromeRef.current);
    }
    return () => observer.disconnect();
  }, [enabled, workspaceRef, trailingChromeRef, clampToWorkspace]);

  const persistDeckHeight = useCallback((height: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(Math.round(height)));
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const onSplitPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { startY: event.clientY, startHeight: deckHeight };
      setIsDragging(true);
    },
    [deckHeight, enabled],
  );

  const onSplitPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || !dragRef.current) return;
      const delta = dragRef.current.startY - event.clientY;
      const next = clampToWorkspace(dragRef.current.startHeight + delta);
      setDeckHeight(next);
    },
    [clampToWorkspace, enabled],
  );

  const finishSplitDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || !dragRef.current) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragRef.current = null;
      setIsDragging(false);
      setDeckHeight((current) => {
        const clamped = clampToWorkspace(current);
        persistDeckHeight(clamped);
        return clamped;
      });
    },
    [clampToWorkspace, enabled, persistDeckHeight],
  );

  return {
    deckHeight,
    isDragging,
    splitHandleProps: {
      onPointerDown: onSplitPointerDown,
      onPointerMove: onSplitPointerMove,
      onPointerUp: finishSplitDrag,
      onPointerCancel: finishSplitDrag,
    },
  };
}
