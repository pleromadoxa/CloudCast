import { useEffect, useState } from 'react';
import { Compass, Glasses, RotateCcw, Scan } from 'lucide-react';
import {
  requestOrientationPermission,
  usePrismOrientationTracking,
  VIRTUAL_CAMERA_PRESETS,
} from '../../hooks/usePrismOrientationTracking';
import {
  isImmersiveArSupported,
  isWebXRAvailable,
  usePrismWebXRTracking,
} from '../../hooks/usePrismWebXRTracking';
import { usePrismFeed } from '../../context/PrismFeedContext';
import { cn } from '../../lib/utils';

interface PrismTrackingPanelProps {
  canUseWebXR?: boolean;
}

export function PrismTrackingPanel({ canUseWebXR = false }: PrismTrackingPanelProps) {
  const { state, patchState, patchStudio, studio } = usePrismFeed();
  const [permError, setPermError] = useState<string | null>(null);
  const [immersiveArOk, setImmersiveArOk] = useState(false);
  const webxrSupported = isWebXRAvailable();

  useEffect(() => {
    if (!canUseWebXR) return;
    void isImmersiveArSupported().then(setImmersiveArOk);
  }, [canUseWebXR]);

  usePrismOrientationTracking({
    enabled: state.orientationTracking && !state.webxrTracking,
    onUpdate: (yaw, pitch) => patchStudio({ cameraYaw: yaw, cameraPitch: pitch }),
  });

  usePrismWebXRTracking({
    enabled: state.webxrTracking && canUseWebXR,
    mode: state.webxrMode,
    onUpdate: (yaw, pitch, zoom) => patchStudio({ cameraYaw: yaw, cameraPitch: pitch, cameraZoom: zoom }),
  });

  const toggleTracking = async () => {
    if (!state.orientationTracking) {
      const ok = await requestOrientationPermission();
      if (!ok) {
        setPermError('Motion permission denied. Enable on iOS: Settings → Safari → Motion.');
        return;
      }
      setPermError(null);
    }
    patchState({ orientationTracking: !state.orientationTracking, webxrTracking: false });
  };

  const enableWebXR = (mode: 'inline' | 'immersive-ar') => {
    patchState({ webxrTracking: true, webxrMode: mode, orientationTracking: false });
  };

  const disableWebXR = () => {
    patchState({ webxrTracking: false });
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => void toggleTracking()}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded py-2 text-xs font-bold tracking-wider',
          state.orientationTracking
            ? 'bg-amber-500 text-black'
            : 'border border-white/20 text-mixer-muted hover:border-white/40',
        )}
      >
        <Compass className="h-3.5 w-3.5" />
        {state.orientationTracking ? 'GYRO ON' : 'DEVICE GYRO TRACKING'}
      </button>

      {canUseWebXR && webxrSupported && (
        <>
          <button
            type="button"
            onClick={() => (state.webxrTracking && state.webxrMode === 'inline' ? disableWebXR() : enableWebXR('inline'))}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded py-2 text-xs font-bold tracking-wider',
              state.webxrTracking && state.webxrMode === 'inline'
                ? 'bg-violet-600 text-white'
                : 'border border-violet-500/30 text-violet-300 hover:border-violet-500/50',
            )}
          >
            <Glasses className="h-3.5 w-3.5" />
            {state.webxrTracking && state.webxrMode === 'inline' ? 'WEBXR ON' : 'WEBXR ROOM TRACKING'}
          </button>
          {immersiveArOk && (
            <button
              type="button"
              onClick={() => (state.webxrTracking && state.webxrMode === 'immersive-ar' ? disableWebXR() : enableWebXR('immersive-ar'))}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded py-2 text-xs font-bold tracking-wider',
                state.webxrTracking && state.webxrMode === 'immersive-ar'
                  ? 'bg-emerald-600 text-white'
                  : 'border border-emerald-500/30 text-emerald-300 hover:border-emerald-500/50',
              )}
            >
              <Scan className="h-3.5 w-3.5" />
              {state.webxrTracking && state.webxrMode === 'immersive-ar' ? 'IMMERSIVE AR ON' : 'IMMERSIVE AR (PASSTHROUGH)'}
            </button>
          )}
        </>
      )}
      {permError && <p className="text-[10px] text-mixer-red">{permError}</p>}
      <p className="text-[10px] text-mixer-muted">
        Hold your phone or tablet and move it to pan the virtual camera — Aximetry Eye-style tracking without external hardware.
      </p>

      <div>
        <p className="mb-2 text-[10px] font-bold tracking-wider text-amber-400/80">CAMERA PRESETS</p>
        <div className="grid grid-cols-2 gap-1">
          {VIRTUAL_CAMERA_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => patchStudio({ cameraYaw: p.yaw, cameraPitch: p.pitch, cameraZoom: p.zoom })}
              className="rounded border border-white/10 px-2 py-1.5 text-[10px] font-bold tracking-wider hover:border-amber-500/40"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => patchStudio({ cameraYaw: 0, cameraPitch: 0.15, cameraZoom: 1 })}
        className="flex w-full items-center justify-center gap-1 text-[10px] text-mixer-muted hover:text-white"
      >
        <RotateCcw className="h-3 w-3" />
        Reset camera
      </button>

      <div className="space-y-2 border-t border-white/10 pt-3">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={studio.showShadows} onChange={(e) => patchStudio({ showShadows: e.target.checked })} />
          Virtual shadows
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={studio.showReflections} onChange={(e) => patchStudio({ showReflections: e.target.checked })} />
          Floor reflections
        </label>
      </div>
    </div>
  );
}
