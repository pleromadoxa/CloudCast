import { useCallback, useEffect, useRef, useState } from 'react';
import {
  detectScreens,
  hasExternalDisplay,
  pickExternalScreen,
  type DetectedScreen,
} from '../lib/externalDisplay/detectScreens';
import { openOutputWindow, placeWindowOnScreen, setupOutputWindow } from '../lib/externalDisplay/setupOutputWindow';

export function useExternalDisplay() {
  const popupRef = useRef<Window | null>(null);
  const popupUnloadRef = useRef<(() => void) | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [targetScreen, setTargetScreen] = useState<DetectedScreen | null>(null);
  const [screens, setScreens] = useState<DetectedScreen[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const refreshScreens = useCallback(async () => {
    const detected = await detectScreens();
    setScreens(detected);
    return detected;
  }, []);

  const close = useCallback(() => {
    const popup = popupRef.current;
    if (popup && popupUnloadRef.current) {
      popup.removeEventListener('beforeunload', popupUnloadRef.current);
      popupUnloadRef.current = null;
    }
    if (popup && !popup.closed) {
      try {
        if (popup.document.fullscreenElement) {
          void popup.document.exitFullscreen?.();
        }
      } catch {
        /* ignore */
      }
      popup.close();
    }
    popupRef.current = null;
    setPortalTarget(null);
    setTargetScreen(null);
    setIsOpen(false);
  }, []);

  const open = useCallback(async (): Promise<boolean> => {
    setError(null);
    setIsDetecting(true);
    try {
      const detected = await refreshScreens();
      const external = pickExternalScreen(detected);
      if (!external) {
        setError('No external display detected. Connect a monitor to your Mac or Windows PC and try again.');
        return false;
      }

      let popup = popupRef.current;
      if (!popup || popup.closed) {
        popup = openOutputWindow();
        if (!popup) {
          setError('Popup blocked. Allow popups for CloudCast to push PGM to an external screen.');
          return false;
        }
        popupRef.current = popup;
        const container = setupOutputWindow(popup);
        setPortalTarget(container);

        const onUnload = () => {
          popupRef.current = null;
          setPortalTarget(null);
          setTargetScreen(null);
          setIsOpen(false);
        };
        if (popupUnloadRef.current) {
          popup.removeEventListener('beforeunload', popupUnloadRef.current);
        }
        popupUnloadRef.current = onUnload;
        popup.addEventListener('beforeunload', onUnload);
      }

      setTargetScreen(external);
      await placeWindowOnScreen(popup, external);
      setIsOpen(true);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open external display.');
      close();
      return false;
    } finally {
      setIsDetecting(false);
    }
  }, [close, refreshScreens]);

  const toggle = useCallback(async () => {
    if (isOpen) {
      close();
      return;
    }
    await open();
  }, [close, isOpen, open]);

  useEffect(() => {
    void refreshScreens();
  }, [refreshScreens]);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setInterval(() => {
      if (popupRef.current?.closed) close();
    }, 400);
    return () => window.clearInterval(id);
  }, [close, isOpen]);

  return {
    isOpen,
    isDetecting,
    portalTarget,
    targetScreen,
    screens,
    externalAvailable: hasExternalDisplay(screens),
    error,
    open,
    close,
    toggle,
    refreshScreens,
    clearError: () => setError(null),
  };
}
