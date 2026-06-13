import { useEffect, useRef } from 'react';

interface UsePrismOrientationTrackingOptions {
  enabled: boolean;
  sensitivity?: number;
  onUpdate: (yaw: number, pitch: number) => void;
}

/** Maps device orientation (phone gyro) to virtual camera yaw/pitch — Aximetry Eye-style tracking. */
export function usePrismOrientationTracking({
  enabled,
  sensitivity = 0.012,
  onUpdate,
}: UsePrismOrientationTrackingOptions) {
  const baseRef = useRef<{ alpha: number; beta: number } | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) {
      baseRef.current = null;
      return;
    }

    const handler = (e: DeviceOrientationEvent) => {
      if (e.alpha == null || e.beta == null) return;

      if (!baseRef.current) {
        baseRef.current = { alpha: e.alpha, beta: e.beta };
        return;
      }

      const deltaAlpha = e.alpha - baseRef.current.alpha;
      const deltaBeta = e.beta - baseRef.current.beta;

      const yaw = (deltaAlpha * sensitivity) % (Math.PI * 2);
      const pitch = Math.max(-0.5, Math.min(0.8, 0.15 + deltaBeta * sensitivity));

      onUpdateRef.current(yaw, pitch);
    };

    window.addEventListener('deviceorientation', handler);
    return () => {
      window.removeEventListener('deviceorientation', handler);
      baseRef.current = null;
    };
  }, [enabled, sensitivity]);
}

export async function requestOrientationPermission(): Promise<boolean> {
  const req = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
    .requestPermission;
  if (typeof req === 'function') {
    try {
      return (await req()) === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}

export const VIRTUAL_CAMERA_PRESETS = [
  { id: 'wide', label: 'Wide', yaw: 0, pitch: 0.05, zoom: 0.75 },
  { id: 'medium', label: 'Medium', yaw: 0, pitch: 0.15, zoom: 1 },
  { id: 'close', label: 'Close-up', yaw: 0, pitch: 0.2, zoom: 1.45 },
  { id: 'left', label: 'Left 3/4', yaw: -0.55, pitch: 0.15, zoom: 1 },
  { id: 'right', label: 'Right 3/4', yaw: 0.55, pitch: 0.15, zoom: 1 },
  { id: 'ar_hero', label: 'AR Hero', yaw: 0, pitch: 0, zoom: 0.9 },
] as const;
