import { useEffect, useState } from 'react';
import { useCloudCastOptional } from '../../context/CloudCastContext';
import { usePrismFeed } from '../../context/PrismFeedContext';
import type { PipCorner, PrismSecondarySlot } from '../../types/prismCameras';
import { isRealDevice } from '../../types/device';

interface PrismMultiCameraPanelProps {
  maxSecondary: number;
  canUseMultiCam: boolean;
}

const CORNERS: PipCorner[] = ['bottom-right', 'bottom-left', 'top-right'];

export function PrismMultiCameraPanel({ maxSecondary, canUseMultiCam }: PrismMultiCameraPanelProps) {
  const { studio, setSecondarySlots, togglePipelineNode } = usePrismFeed();
  const cloudcast = useCloudCastOptional();
  const [localDevices, setLocalDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    void navigator.mediaDevices.enumerateDevices().then((all) => {
      setLocalDevices(all.filter((d) => d.kind === 'videoinput'));
    });
  }, []);

  if (!canUseMultiCam) {
    return (
      <p className="text-xs text-mixer-muted">
        Multi-camera PiP unlocks on Pro (2 cameras) and Pro Master (4 cameras).
      </p>
    );
  }

  const paired = (cloudcast?.devices ?? []).filter((d) => isRealDevice(d) && d.deviceRole !== 'audio');

  const updateSlot = (slotId: string, patch: Partial<PrismSecondarySlot>) => {
    setSecondarySlots(
      studio.secondarySlots.map((s) => (s.id === slotId ? { ...s, ...patch } : s)),
    );
  };

  const visibleSlots = studio.secondarySlots.slice(0, maxSecondary);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={studio.nodeGraph.nodes.pip.enabled}
          onChange={() => togglePipelineNode('pip')}
        />
        Enable PiP compositor node
      </label>
      <p className="text-[10px] text-mixer-muted">
        Add up to {maxSecondary} secondary angle{maxSecondary > 1 ? 's' : ''} in picture-in-picture on program output.
      </p>
      {visibleSlots.map((slot) => (
        <div key={slot.id} className="rounded border border-white/10 bg-black/40 p-2">
          <label className="flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={slot.active}
              onChange={(e) => updateSlot(slot.id, { active: e.target.checked })}
            />
            {slot.label}
          </label>
          {slot.active && (
            <>
              <select
                className="mt-2 w-full rounded border border-white/10 bg-black px-2 py-1 text-[10px]"
                value={slot.sourceId}
                onChange={(e) => updateSlot(slot.id, { sourceId: e.target.value })}
              >
                <option value="">Select source…</option>
                {localDevices.map((d) => (
                  <option key={d.deviceId} value={`local:${d.deviceId}`}>
                    USB: {d.label || 'Camera'}
                  </option>
                ))}
                {paired.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    Mobile: {d.label}
                  </option>
                ))}
              </select>
              <select
                className="mt-1 w-full rounded border border-white/10 bg-black px-2 py-1 text-[10px]"
                value={slot.corner}
                onChange={(e) => updateSlot(slot.id, { corner: e.target.value as PipCorner })}
              >
                {CORNERS.map((c) => (
                  <option key={c} value={c}>{c.replace('-', ' ')}</option>
                ))}
              </select>
              <label className="mt-1 flex items-center gap-2 text-[10px]">
                <input
                  type="checkbox"
                  checked={slot.keyed}
                  onChange={(e) => updateSlot(slot.id, { keyed: e.target.checked })}
                />
                Chroma key this angle
              </label>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/** Hidden video elements for secondary camera slots. */
export function SecondaryCameraVideos({
  slots,
  setVideoRef,
}: {
  slots: PrismSecondarySlot[];
  setVideoRef: (slotId: string, el: HTMLVideoElement | null) => void;
}) {
  return (
    <>
      {slots.map((slot) => (
        <video
          key={slot.id}
          ref={(el) => setVideoRef(slot.id, el)}
          className="hidden"
          playsInline
          muted
        />
      ))}
    </>
  );
}
