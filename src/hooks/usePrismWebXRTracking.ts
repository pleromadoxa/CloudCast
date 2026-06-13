import { useEffect, useRef } from 'react';

export type WebXRTrackingMode = 'inline' | 'immersive-ar';

interface UsePrismWebXRTrackingOptions {
  enabled: boolean;
  mode?: WebXRTrackingMode;
  sensitivity?: number;
  onUpdate: (yaw: number, pitch: number, zoom: number) => void;
}

/** WebXR head pose → virtual camera (Pro Master+). */
export function usePrismWebXRTracking({
  enabled,
  mode = 'inline',
  sensitivity = 1,
  onUpdate,
}: UsePrismWebXRTrackingOptions) {
  const sessionRef = useRef<XRSession | null>(null);
  const baseRef = useRef<{ yaw: number; pitch: number } | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) {
      sessionRef.current?.end().catch(() => {});
      sessionRef.current = null;
      baseRef.current = null;
      return;
    }

    if (!navigator.xr) return;

    let cancelled = false;
    let raf = 0;

    const run = async () => {
      try {
        const sessionMode = mode === 'immersive-ar' ? 'immersive-ar' : 'inline';
        const supported = await navigator.xr!.isSessionSupported(sessionMode);
        if (!supported || cancelled) return;

        const session = await navigator.xr!.requestSession(sessionMode, {
          optionalFeatures: sessionMode === 'immersive-ar'
            ? ['local', 'dom-overlay']
            : ['local'],
          ...(sessionMode === 'immersive-ar' && {
            domOverlay: { root: document.body },
          }),
        });
        if (cancelled) {
          await session.end();
          return;
        }

        sessionRef.current = session;
        const refSpace = await session.requestReferenceSpace('local');

        const frameLoop = (_t: number, frame: XRFrame) => {
          if (cancelled) return;
          const pose = frame.getViewerPose(refSpace);
          if (pose) {
            const ori = pose.transform.orientation;
            const q = { x: ori.x, y: ori.y, z: ori.z, w: ori.w };
            const yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
            const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (q.w * q.x - q.y * q.z))));

            if (!baseRef.current) {
              baseRef.current = { yaw, pitch };
            }

            const dy = (yaw - baseRef.current.yaw) * sensitivity;
            const dp = (pitch - baseRef.current.pitch) * sensitivity;
            onUpdateRef.current(dy, 0.15 + dp, 1);
          }
          raf = session.requestAnimationFrame(frameLoop);
        };

        raf = session.requestAnimationFrame(frameLoop);
        session.addEventListener('end', () => {
          cancelAnimationFrame(raf);
          sessionRef.current = null;
          baseRef.current = null;
        });
      } catch {
        /* WebXR unavailable or denied */
      }
    };

    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      sessionRef.current?.end().catch(() => {});
      sessionRef.current = null;
      baseRef.current = null;
    };
  }, [enabled, mode, sensitivity]);
}

export function isWebXRAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'xr' in navigator;
}

export async function isImmersiveArSupported(): Promise<boolean> {
  if (!navigator.xr) return false;
  try {
    return await navigator.xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
}
