import { useEffect, useRef } from 'react';
import type { KeySettings } from '../../types/mixer';
import { renderChromaBackground, resolveChromaBackgroundId } from '../../lib/chromaBackgrounds';
import { normalizeKeySettings } from '../../lib/keySettings';

interface ChromaKeyLayerProps {
  mainVideo: HTMLVideoElement | null;
  keyVideo: HTMLVideoElement | null;
  keySettings: KeySettings;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function ChromaKeyLayer({ mainVideo, keyVideo, keySettings: rawKeySettings }: ChromaKeyLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keySettings = normalizeKeySettings(rawKeySettings);
  const usePreset = keySettings.fillSource === 'preset';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mainVideo) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const [kr, kg, kb] = hexToRgb(keySettings.color);
    const tol = keySettings.tolerance * 2.55;
    const bgId = resolveChromaBackgroundId(keySettings.backgroundId);
    let raf = 0;
    const off = document.createElement('canvas');
    const octx = off.getContext('2d', { willReadFrequently: true });

    const draw = (timeMs: number) => {
      const w = canvas.clientWidth || 640;
      const h = canvas.clientHeight || 360;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      if (off.width !== w) off.width = w;
      if (off.height !== h) off.height = h;

      if (usePreset) {
        renderChromaBackground(ctx, w, h, bgId, timeMs);
      } else if (keyVideo && keyVideo.readyState >= 2) {
        ctx.drawImage(keyVideo, 0, 0, w, h);
      } else {
        renderChromaBackground(ctx, w, h, bgId, timeMs);
      }

      if (mainVideo.readyState >= 2 && octx) {
        octx.drawImage(mainVideo, 0, 0, w, h);
        const img = octx.getImageData(0, 0, w, h);
        const data = img.data;
        if (keySettings.keyType === 'luma') {
          const threshold = (keySettings.lumaThreshold / 100) * 255;
          for (let i = 0; i < data.length; i += 4) {
            const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            if (luma < threshold) data[i + 3] = 0;
          }
        } else {
          const maxDist = tol * 1.732;
          for (let i = 0; i < data.length; i += 4) {
            const dr = data[i] - kr;
            const dg = data[i + 1] - kg;
            const db = data[i + 2] - kb;
            const dist = Math.sqrt(dr * dr + dg * dg + db * db);
            if (dist < maxDist) data[i + 3] = 0;
          }
        }
        octx.putImageData(img, 0, 0);
        ctx.drawImage(off, 0, 0, w, h);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [
    mainVideo,
    keyVideo,
    keySettings.color,
    keySettings.tolerance,
    keySettings.keyType,
    keySettings.lumaThreshold,
    keySettings.fillSource,
    keySettings.backgroundId,
    usePreset,
  ]);

  const bgLabel = usePreset ? resolveChromaBackgroundId(keySettings.backgroundId) : 'AUX CAM';

  const keyLabel =
    keySettings.keyType === 'luma'
      ? `LUMA <${keySettings.lumaThreshold}%`
      : `${keySettings.color} ±${keySettings.tolerance}%`;

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />
      <div className="pointer-events-none absolute bottom-2 left-2 z-20 rounded bg-black/70 px-2 py-0.5 text-[9px] text-mixer-green">
        KEY: {keyLabel} · {bgLabel}
      </div>
    </>
  );
}
