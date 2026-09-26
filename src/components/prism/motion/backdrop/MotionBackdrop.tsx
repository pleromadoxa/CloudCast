import { useEffect, useRef, useState, type ReactElement } from 'react';
import { getMotionBackdrop } from '../../../../lib/prism/motionBackgrounds';
import { normalizeAccent } from '../../../../lib/prism/motionGraphics';
import {
  createBackdropRenderer,
  type BackdropApiPreference,
  type BackdropParams,
  type BackdropRenderer,
  type BackdropSourceSpec,
} from './backdropRenderer';

/** Device-pixel cap for the backdrop plate (it is graded and cropped anyway). */
const MAX_DPR = 1.6;

function hexToRgb(hex: string): [number, number, number] {
  const clean = normalizeAccent(hex).slice(1);
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
}

export interface MotionBackdropProps {
  /** Backdrop id from the motion background catalog. */
  backgroundId: string;
  /** Accent tint (hex). */
  accent: string;
  /** 0–1.4 brightness. */
  intensity: number;
  /** 0–2 saturation. */
  saturation: number;
  /** 0–2 — playback rate for the plate's motion. */
  speed: number;
  /** 0–1.6 vignette multiplier. */
  vignette: number;
  /** 0–0.2 extra grain. */
  grain: number;
  /** Freeze the plate with the timeline transport. */
  paused: boolean;
  /** Which renderer to use (`auto` prefers WebGPU). */
  preference?: BackdropApiPreference;
  /** Hands the backing canvas to the program-output compositor. */
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  /** Reports the API that ended up running (WebGPU / canvas fallback). */
  onApiReady?: (api: 'webgpu' | 'canvas') => void;
}

/**
 * Renders the video / photo / procedural plate that sits *behind* the three.js
 * motion scene. Owns its own WebGPU (or Canvas2D) canvas, keeps its own clock
 * so the plate keeps rolling while the timeline transport is paused, and
 * exposes its canvas for program-output compositing.
 */
export function MotionBackdrop({
  backgroundId,
  accent,
  intensity,
  saturation,
  speed,
  vignette,
  grain,
  paused,
  preference = 'auto',
  onCanvasReady,
  onApiReady,
}: MotionBackdropProps): ReactElement | null {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BackdropRenderer | null>(null);
  const onReadyRef = useRef(onCanvasReady);
  const onApiRef = useRef(onApiReady);
  const applySizeRef = useRef<() => void>(() => {});
  /**
   * Plate retry bookkeeping. A failed WebGPU attempt can lock the element into
   * webgpu mode — after that `getContext('2d')` returns null and the Canvas2D
   * fallback is impossible — so the first failure swaps in a pristine canvas
   * element and pins the Canvas2D path for the retry.
   */
  const [retry, setRetry] = useState({ key: 0, canvasOnly: false });
  const specRef = useRef<BackdropSourceSpec>(null);
  const timeRef = useRef(0);
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  const paramsRef = useRef<BackdropParams>({
    mode: 0,
    accent: [1, 1, 1],
    intensity: 1,
    saturation: 1,
    parallax: 1,
    vignette: 1,
    grain: 0,
    zoom: 1.06,
  });

  useEffect(() => {
    onReadyRef.current = onCanvasReady;
    onApiRef.current = onApiReady;
  }, [onCanvasReady, onApiReady]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Latest control values, applied on the next frame without a React render.
  useEffect(() => {
    const params = paramsRef.current;
    params.accent = hexToRgb(accent);
    params.intensity = intensity;
    params.saturation = saturation;
    params.vignette = vignette * 0.62;
    params.grain = grain;
  }, [accent, intensity, saturation, vignette, grain]);

  // Create the renderer, run its frame loop, then tear both down.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let raf = 0;
    let last = performance.now();
    const canvasOnly = retry.canvasOnly;

    void createBackdropRenderer(canvas, canvasOnly ? 'canvas' : preference)
      .then((renderer) => {
        if (disposed) {
          renderer.destroy();
          return;
        }
        rendererRef.current = renderer;
        paramsRef.current.mode = getMotionBackdrop(backgroundId).mode;
        if (specRef.current) renderer.setSource(specRef.current);
        // The container may already have been measured before the renderer
        // existed — size the plate now, or it stays at the 300x150 default.
        applySizeRef.current();
        onReadyRef.current?.(renderer.canvas);
        onApiRef.current?.(renderer.api);

        const loop = (now: number) => {
          raf = requestAnimationFrame(loop);
          const dt = Math.min((now - last) / 1000, 0.1);
          last = now;
          if (!pausedRef.current) timeRef.current += dt * Math.max(0, speedRef.current);
          renderer.render(timeRef.current, paramsRef.current);
        };
        raf = requestAnimationFrame(loop);
      })
      .catch((error) => {
        if (retry.key === 0) {
          console.warn('[motion backdrop] plate failed to start, retrying on a clean canvas:', error);
          setRetry({ key: 1, canvasOnly: true });
        } else {
          /* renderer unavailable — the scene's own backdrop covers the frame */
          console.warn('[motion backdrop] plate unavailable:', error);
        }
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      rendererRef.current?.destroy();
      rendererRef.current = null;
      onReadyRef.current?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- plate swaps are handled below
  }, [preference, retry]);

  // Keep the plate sized to its container.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      rendererRef.current?.resize(rect.width * dpr, rect.height * dpr);
    };
    applySizeRef.current = apply;
    apply();
    const observer = new ResizeObserver(apply);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    window.addEventListener('resize', apply);
    return () => {
      applySizeRef.current = () => {};
      observer.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, [retry.key]);

  // Swap the plate when the operator picks a different backdrop.
  useEffect(() => {
    const backdrop = getMotionBackdrop(backgroundId);
    paramsRef.current.mode = backdrop.mode;
    const spec: BackdropSourceSpec =
      backdrop.src && (backdrop.kind === 'video' || backdrop.kind === 'image')
        ? { kind: backdrop.kind, src: backdrop.src }
        : null;
    specRef.current = spec;
    rendererRef.current?.setSource(spec);
    applySizeRef.current();
    timeRef.current = 0;
  }, [backgroundId]);

  return <canvas key={retry.key} ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}
