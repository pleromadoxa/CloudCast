import { useCallback, useEffect, useRef, useState } from 'react';
import { useCloudCastOptional } from '../context/CloudCastContext';
import { ChromaKeyProcessor, type ChromaKeySettings } from '../lib/prism/chromaKey';
import type { PrismPipOverlay } from '../lib/prism/prismOutputCapture';
import type { PrismSecondarySlot } from '../types/prismCameras';
import { isMeshStreamActive } from '../lib/deviceConnection';
import { isRealDevice } from '../types/device';
import { acquireWhepStream } from '../lib/whepStreamPool';

export function usePrismSecondaryCameras(
  slots: PrismSecondarySlot[],
  keySettings: ChromaKeySettings,
  maxActive: number,
) {
  const cloudcast = useCloudCastOptional();
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const keyCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const rawCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const processorsRef = useRef<Map<string, ChromaKeyProcessor>>(new Map());
  const rawRafRef = useRef<Map<string, number>>(new Map());
  const whepReleasesRef = useRef<Map<string, () => void>>(new Map());
  const [keyedCanvases, setKeyedCanvases] = useState<Map<string, HTMLCanvasElement>>(new Map());
  const [rawCanvases, setRawCanvases] = useState<Map<string, HTMLCanvasElement>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  const activeCount = slots.filter((s) => s.active && s.sourceId).length;
  const useMesh = cloudcast?.connectionMode === 'mesh';

  const setVideoRef = useCallback((slotId: string, el: HTMLVideoElement | null) => {
    if (el) videoRefs.current.set(slotId, el);
    else videoRefs.current.delete(slotId);
  }, []);

  const ensureCanvas = useCallback((map: Map<string, HTMLCanvasElement>, slotId: string) => {
    let canvas = map.get(slotId);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      map.set(slotId, canvas);
    }
    return canvas;
  }, []);

  const releaseWhep = useCallback((slotId: string) => {
    whepReleasesRef.current.get(slotId)?.();
    whepReleasesRef.current.delete(slotId);
  }, []);

  const stopSlot = useCallback((slotId: string) => {
    processorsRef.current.get(slotId)?.dispose();
    processorsRef.current.delete(slotId);
    const raf = rawRafRef.current.get(slotId);
    if (raf) cancelAnimationFrame(raf);
    rawRafRef.current.delete(slotId);
    releaseWhep(slotId);
    const v = videoRefs.current.get(slotId);
    if (v?.srcObject instanceof MediaStream) {
      const isLocal = slots.find((s) => s.id === slotId)?.sourceId.startsWith('local:');
      if (isLocal) v.srcObject.getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
  }, [releaseWhep, slots]);

  const attachMobileStream = useCallback(async (slot: PrismSecondarySlot) => {
    const video = videoRefs.current.get(slot.id);
    if (!video) return;

    const mobileDevice = cloudcast?.devices.find(
      (d) => d.deviceId === slot.sourceId && isRealDevice(d),
    );
    if (!mobileDevice) return;

    if (useMesh) {
      releaseWhep(slot.id);
      const stream = cloudcast?.getMeshStream(slot.sourceId) ?? null;
      if (stream && isMeshStreamActive(stream)) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        setErrors((prev) => {
          const next = new Map(prev);
          next.delete(slot.id);
          return next;
        });
      }
      return;
    }

    if (mobileDevice.whepUrl) {
      releaseWhep(slot.id);
      const { release } = acquireWhepStream(
        slot.sourceId,
        mobileDevice.whepUrl,
        'auto',
        (snap) => {
          if (snap.stream) {
            video.srcObject = snap.stream;
            void video.play().catch(() => undefined);
            setErrors((prev) => {
              const next = new Map(prev);
              next.delete(slot.id);
              return next;
            });
          } else if (snap.error) {
            setErrors((prev) => new Map(prev).set(slot.id, snap.error!));
          }
        },
      );
      whepReleasesRef.current.set(slot.id, release);
    }
  }, [cloudcast, useMesh, releaseWhep]);

  const startLocalForSlot = useCallback(async (slot: PrismSecondarySlot) => {
    const video = videoRefs.current.get(slot.id);
    if (!video || !slot.sourceId.startsWith('local:')) return;

    releaseWhep(slot.id);
    const deviceId = slot.sourceId.slice(6);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      video.srcObject = media;
      await video.play();
      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(slot.id);
        return next;
      });
    } catch (err) {
      setErrors((prev) => new Map(prev).set(slot.id, err instanceof Error ? err.message : 'Camera failed'));
    }
  }, [releaseWhep]);

  useEffect(() => {
    for (const slot of slots) {
      if (!slot.active || !slot.sourceId) {
        stopSlot(slot.id);
        continue;
      }

      if (activeCount > maxActive) continue;

      if (slot.sourceId.startsWith('local:')) {
        void startLocalForSlot(slot);
      } else {
        void attachMobileStream(slot);
      }

      const video = videoRefs.current.get(slot.id);
      if (!video) continue;

      if (slot.keyed) {
        const keyCanvas = ensureCanvas(keyCanvasRefs.current, slot.id);
        processorsRef.current.get(slot.id)?.dispose();
        const proc = new ChromaKeyProcessor(video, keyCanvas);
        proc.updateSettings(keySettings);
        proc.start();
        processorsRef.current.set(slot.id, proc);
        setKeyedCanvases((prev) => new Map(prev).set(slot.id, keyCanvas));

        const raf = rawRafRef.current.get(slot.id);
        if (raf) cancelAnimationFrame(raf);
        rawRafRef.current.delete(slot.id);
      } else {
        processorsRef.current.get(slot.id)?.dispose();
        processorsRef.current.delete(slot.id);

        const rawCanvas = ensureCanvas(rawCanvasRefs.current, slot.id);
        setRawCanvases((prev) => new Map(prev).set(slot.id, rawCanvas));

        const paint = () => {
          if (video.readyState >= 2) {
            const ctx = rawCanvas.getContext('2d');
            if (ctx) ctx.drawImage(video, 0, 0, rawCanvas.width, rawCanvas.height);
          }
          rawRafRef.current.set(slot.id, requestAnimationFrame(paint));
        };
        const existing = rawRafRef.current.get(slot.id);
        if (existing) cancelAnimationFrame(existing);
        rawRafRef.current.set(slot.id, requestAnimationFrame(paint));
      }
    }

    return () => {
      processorsRef.current.forEach((p) => p.dispose());
      processorsRef.current.clear();
      rawRafRef.current.forEach((raf) => cancelAnimationFrame(raf));
      rawRafRef.current.clear();
      whepReleasesRef.current.forEach((release) => release());
      whepReleasesRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, keySettings, maxActive, activeCount, useMesh]);

  useEffect(() => {
    processorsRef.current.forEach((p) => p.updateSettings(keySettings));
  }, [keySettings]);

  const getPipOverlays = useCallback((): PrismPipOverlay[] => {
    const result: PrismPipOverlay[] = [];
    for (const slot of slots) {
      if (!slot.active || !slot.sourceId) continue;
      const canvas = slot.keyed
        ? keyedCanvases.get(slot.id) ?? null
        : rawCanvases.get(slot.id) ?? null;
      if (!canvas) continue;
      result.push({ canvas, corner: slot.corner, label: slot.label });
    }
    return result;
  }, [slots, keyedCanvases, rawCanvases]);

  return {
    setVideoRef,
    getPipOverlays,
    errors,
    activeCount,
  };
}
