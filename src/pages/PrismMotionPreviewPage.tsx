import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Maximize2, Minimize2, Pause, Play, RotateCcw, X } from 'lucide-react';
import {
  DEFAULT_MOTION_STATE,
  MOTION_ACCENTS,
  MOTION_CATEGORY_LABEL,
  clampMotionRange,
  clampMotionSpeed,
  formatMotionTime,
  getMotionTemplate,
  normalizeAccent,
  overridesFromTemplate,
  type MotionRangeKey,
  type PrismMotionState,
} from '../lib/prism/motionGraphics';
import { loadBrandKit } from '../lib/prism/brandKit';
import { listAllMotionTemplates } from '../lib/prism/motionTemplateCustom';
import { MOTION_BACKDROPS, getMotionBackdrop } from '../lib/prism/motionBackgrounds';
import { getActiveMotionClock, motionClockProgress } from '../components/prism/motion/motionClock';
import { MotionGraphicsStage } from '../components/prism/motion/MotionGraphicsStage';
import { cn } from '../lib/utils';

const HUD_HIDE_MS = 2800;

/** Sliding grade control used inside the preview HUD. */
function HudSlider({
  label,
  rangeKey,
  value,
  min,
  max,
  step,
  digits = 2,
  onChange,
}: {
  label: string;
  rangeKey: MotionRangeKey;
  value: number;
  min: number;
  max: number;
  step: number;
  digits?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[9px] font-bold tracking-wider text-white/45">
        <span>{label}</span>
        <span className="tabular-nums text-amber-300/80">{value.toFixed(digits)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clampMotionRange(rangeKey, Number(e.target.value)))}
        className="mt-1 w-full accent-amber-500"
      />
    </label>
  );
}

/**
 * Fullscreen 3D motion graphics preview — opens in its own tab from the
 * Motion Graphics panel so an operator can watch a template play full size
 * (or throw it on a second display) while the console stays put.
 */
export function PrismMotionPreviewPage() {
  const [params, setParams] = useSearchParams();

  const [motion, setMotion] = useState<PrismMotionState>(() => {
    const template = getMotionTemplate(params.get('template'));
    const pick = (key: string) => params.get(key) ?? undefined;
    return {
      ...DEFAULT_MOTION_STATE,
      templateId: template.id,
      headline: params.get('headline') || template.headline,
      subline: params.get('subline') || template.subline,
      accent: normalizeAccent(params.get('accent'), template.accent),
      speed: clampMotionSpeed(Number(pick('speed')) || 1),
      loop: params.get('loop') === '1',
      active: true,
      onProgram: false,
      playToken: 1,
      backgroundId: params.get('bg') || template.defaultBackground || 'none',
      bgIntensity: clampMotionRange('bgIntensity', pick('intensity'), 1),
      bgSpeed: clampMotionRange('bgSpeed', pick('bgspeed'), 1),
      bgSaturation: clampMotionRange('bgSaturation', pick('saturation'), 1),
      exposure: clampMotionRange('exposure', pick('exposure'), 1),
      bloom: clampMotionRange('bloom', pick('bloom'), 1),
      grain: clampMotionRange('grain', pick('grain'), 0),
      chroma: clampMotionRange('chroma', pick('chroma'), 0),
      vignette: clampMotionRange('vignette', pick('vignette'), 1),
      particleScale: clampMotionRange('particleScale', pick('particles'), 1),
      letterbox: params.get('bars') === '1',
      brand: loadBrandKit(),
    };
  });

  const template = getMotionTemplate(motion.templateId);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [lookOpen, setLookOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** Which plate renderer is live — WebGPU, or the Canvas2D fallback. */
  const [plateApi, setPlateApi] = useState<'webgpu' | 'canvas' | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<number | null>(null);

  const patch = useCallback((next: Partial<PrismMotionState>) => {
    setMotion((prev) => ({ ...prev, ...next }));
  }, []);

  /** Keep the URL shareable: refresh or share the tab and the same cut reloads. */
  useEffect(() => {
    const next = new URLSearchParams();
    next.set('template', motion.templateId);
    if (motion.headline) next.set('headline', motion.headline);
    if (motion.subline) next.set('subline', motion.subline);
    next.set('accent', motion.accent);
    next.set('speed', String(motion.speed));
    next.set('bg', motion.backgroundId);
    if (motion.letterbox) next.set('bars', '1');
    // Look values only ride along when they differ from the defaults.
    if (motion.bgIntensity !== 1) next.set('intensity', String(motion.bgIntensity));
    if (motion.bgSpeed !== 1) next.set('bgspeed', String(motion.bgSpeed));
    if (motion.bgSaturation !== 1) next.set('saturation', String(motion.bgSaturation));
    if (motion.exposure !== 1) next.set('exposure', String(motion.exposure));
    if (motion.bloom !== 1) next.set('bloom', String(motion.bloom));
    if (motion.grain !== 0) next.set('grain', String(motion.grain));
    if (motion.chroma !== 0) next.set('chroma', String(motion.chroma));
    if (motion.vignette !== 1) next.set('vignette', String(motion.vignette));
    if (motion.particleScale !== 1) next.set('particles', String(motion.particleScale));
    if (motion.loop) next.set('loop', '1');
    setParams(next, { replace: true });
  }, [
    motion.templateId,
    motion.headline,
    motion.subline,
    motion.accent,
    motion.speed,
    motion.loop,
    motion.backgroundId,
    motion.bgIntensity,
    motion.bgSpeed,
    motion.bgSaturation,
    motion.exposure,
    motion.bloom,
    motion.grain,
    motion.chroma,
    motion.vignette,
    motion.particleScale,
    motion.letterbox,
    setParams,
  ]);

  const restart = useCallback(() => {
    setPaused(false);
    setFinished(false);
    patch({ active: true, playToken: motion.playToken + 1 });
  }, [motion.playToken, patch]);

  /** B — jump to the next backdrop plate. */
  const cycleBackdrop = useCallback(() => {
    const index = MOTION_BACKDROPS.findIndex((b) => b.id === motion.backgroundId);
    const nextId = MOTION_BACKDROPS[(index + 1) % MOTION_BACKDROPS.length].id;
    patch({ backgroundId: nextId });
  }, [motion.backgroundId, patch]);

  const chooseTemplate = useCallback(
    (id: string) => {
      const next = getMotionTemplate(id);
      setPaused(false);
      setFinished(false);
      patch({
        templateId: next.id,
        headline: next.headline,
        subline: next.subline,
        accent: next.accent,
        backgroundId: next.defaultBackground ?? 'none',
        overrides: overridesFromTemplate(next),
        loop: next.loopable ? motion.loop : false,
        active: true,
        playToken: motion.playToken + 1,
      });
    },
    [motion.loop, motion.playToken, patch],
  );

  // Timeline readout + scrub bar, driven straight off the shared clock so the
  // HUD never re-renders React on every animation frame.
  useEffect(() => {
    let raf = 0;
    let lastFinished: boolean | null = null;
    const tick = () => {
      const clock = getActiveMotionClock();
      if (clock) {
        const p = motionClockProgress(clock);
        if (barRef.current) barRef.current.style.width = `${(p * 100).toFixed(2)}%`;
        if (timeRef.current) {
          timeRef.current.textContent = `${formatMotionTime(clock.t)} / ${formatMotionTime(clock.duration)}`;
        }
        if (lastFinished !== clock.finished) {
          lastFinished = clock.finished;
          setFinished(clock.finished);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seek = useCallback((clientX: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const clock = getActiveMotionClock();
    if (!clock) return;
    clock.t = ratio * clock.duration;
    clock.finished = false;
    setFinished(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Auto-hide the chrome so nothing sits over the graphic on a clean output.
  const wakeHud = useCallback(() => {
    setHudVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setHudVisible(false), HUD_HIDE_MS);
  }, []);

  // Kick off the auto-hide timer on mount; the HUD is only ever hidden from a
  // timer callback, never synchronously during render or an effect body.
  useEffect(() => {
    hideTimer.current = window.setTimeout(() => setHudVisible(false), HUD_HIDE_MS);
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === ' ' || key === 'k') {
        e.preventDefault();
        if (paused) {
          setPaused(false);
        } else {
          setPaused(true);
        }
        wakeHud();
      } else if (key === 'r') {
        restart();
        wakeHud();
      } else if (key === 'f') {
        toggleFullscreen();
        wakeHud();
      } else if (key === 'b') {
        cycleBackdrop();
        wakeHud();
      } else if (key === 'g') {
        setLookOpen((open) => !open);
        wakeHud();
      } else if (key === 'arrowright' || key === 'arrowleft') {
        e.preventDefault();
        const clock = getActiveMotionClock();
        if (clock) {
          const delta = key === 'arrowright' ? 0.1 : -0.1;
          clock.t = Math.min(clock.duration, Math.max(0, clock.t + delta * clock.duration));
          clock.finished = false;
          setFinished(false);
        }
        wakeHud();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointermove', wakeHud);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', wakeHud);
    };
  }, [paused, restart, toggleFullscreen, wakeHud, cycleBackdrop]);

  const speeds = useMemo(() => [0.5, 1, 1.5, 2], []);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black text-white">
      <MotionGraphicsStage
        motion={motion}
        paused={paused}
        className="h-full w-full"
        onBackdropApi={setPlateApi}
      />

      {/* HUD — fades out after a few idle seconds so the frame stays clean. */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-10 transition-opacity duration-500',
          hudVisible ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="pointer-events-auto absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/85 to-transparent p-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.3em] text-amber-400">REGAL PRISM · 3D MOTION PREVIEW</p>
            <p className="mt-1 truncate text-sm font-bold">{template.name}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/50">
              {MOTION_CATEGORY_LABEL[template.category]} · {template.duration}s
            </p>
          </div>
          <div className="flex items-center gap-2">
            {plateApi && (
              <span
                title={
                  plateApi === 'webgpu'
                    ? 'Backdrop plate is rendering on WebGPU'
                    : 'WebGPU unavailable — the plate is rendering on the Canvas2D fallback'
                }
                className={cn(
                  'rounded border px-2 py-1 text-[9px] font-bold tracking-widest',
                  plateApi === 'webgpu'
                    ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200'
                    : 'border-amber-400/50 bg-amber-400/10 text-amber-200',
                )}
              >
                {plateApi === 'webgpu' ? 'WEBGPU PLATE' : 'CANVAS2D PLATE'}
              </span>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              title="Fullscreen (F)"
              className="rounded border border-white/20 p-2 text-mixer-muted transition-colors hover:border-white/50 hover:text-white"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <Link
              to="/prism"
              title="Back to Regal Prism"
              className="rounded border border-white/20 p-2 text-mixer-muted transition-colors hover:border-white/50 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="pointer-events-auto absolute inset-x-0 bottom-0 space-y-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4">
          {/* Scrub bar — click or drag to seek the live timeline. */}
          <div
            role="slider"
            aria-label="Timeline"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(motionClockProgress(getActiveMotionClock()) * 100)}
            tabIndex={0}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              seek(e.clientX, e.currentTarget);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) seek(e.clientX, e.currentTarget);
            }}
            className="group h-4 w-full cursor-pointer"
          >
            <div className="relative top-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <div ref={barRef} className="h-full rounded-full bg-amber-400" style={{ width: '0%' }} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                title={paused ? 'Play (Space)' : 'Pause (Space)'}
                className="rounded-full bg-amber-500 p-3 text-black transition-colors hover:bg-amber-400"
              >
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={restart}
                title="Replay (R)"
                className="rounded-full border border-white/25 p-3 text-mixer-muted transition-colors hover:border-white/60 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <span className="ml-1 text-[11px] tabular-nums text-white/70">
                <span ref={timeRef}>{formatMotionTime(0)} / {formatMotionTime(template.duration)}</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold tracking-wider text-white/40">SPEED</span>
              {speeds.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => patch({ speed: clampMotionSpeed(s) })}
                  className={cn(
                    'rounded border px-2 py-1 text-[10px] font-bold tabular-nums transition-colors',
                    motion.speed === s
                      ? 'border-amber-500/70 bg-amber-500/20 text-amber-300'
                      : 'border-white/15 text-white/60 hover:border-white/40 hover:text-white',
                  )}
                >
                  {s}×
                </button>
              ))}
              <button
                type="button"
                onClick={() => patch({ loop: !motion.loop })}
                disabled={!template.loopable}
                title="Loop"
                className={cn(
                  'rounded border px-2 py-1 text-[10px] font-bold tracking-wider transition-colors disabled:opacity-30',
                  motion.loop
                    ? 'border-amber-500/70 bg-amber-500/20 text-amber-300'
                    : 'border-white/15 text-white/60 hover:border-white/40 hover:text-white',
                )}
              >
                LOOP
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold tracking-wider text-white/40">ACCENT</span>
              {MOTION_ACCENTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  title={option.name}
                  onClick={() => patch({ accent: option.value })}
                  className={cn(
                    'h-5 w-5 rounded-full border transition-transform hover:scale-110',
                    motion.accent.toLowerCase() === option.value.toLowerCase()
                      ? 'border-white ring-2 ring-amber-500/70'
                      : 'border-white/30',
                  )}
                  style={{ background: option.value }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {listAllMotionTemplates().map((tpl) => {
              const selected = tpl.id === template.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => chooseTemplate(tpl.id)}
                  title={tpl.blurb}
                  className={cn(
                    'shrink-0 rounded border px-3 py-1.5 text-left text-[10px] font-bold transition-colors',
                    selected
                      ? 'border-amber-500/70 bg-amber-500/15 text-amber-200'
                      : 'border-white/15 text-white/60 hover:border-white/40 hover:text-white',
                  )}
                >
                  {tpl.name}
                  <span className="ml-2 font-normal text-white/40">{MOTION_CATEGORY_LABEL[tpl.category]}</span>
                </button>
              );
            })}
          </div>

          {/* Backdrop plate picker — WebGPU video / photo / procedural fields. */}
          {template.fullFrame && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold tracking-wider text-white/40">BACKDROP</span>
                <span className="text-[9px] tracking-wider text-white/40">
                  {getMotionBackdrop(motion.backgroundId).name}
                  {getMotionBackdrop(motion.backgroundId).credit
                    ? ` · ${getMotionBackdrop(motion.backgroundId).credit}`
                    : ''}
                </span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {MOTION_BACKDROPS.map((bd) => {
                  const selected = bd.id === motion.backgroundId;
                  return (
                    <button
                      key={bd.id}
                      type="button"
                      onClick={() => patch({ backgroundId: bd.id })}
                      title={bd.blurb}
                      className={cn(
                        'relative h-10 w-24 shrink-0 overflow-hidden rounded border transition-all',
                        selected
                          ? 'border-amber-500/70 ring-1 ring-amber-500/40'
                          : 'border-white/15 hover:border-white/40',
                      )}
                    >
                      <span className="absolute inset-0" style={{ background: bd.swatch }} />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-0.5 pt-2 text-left text-[9px] font-bold text-white">
                        {bd.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grade controls — exposure, bloom, grain, aberration, vignette, particles. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLookOpen((open) => !open)}
              title="Grade controls (G)"
              className={cn(
                'rounded border px-2 py-1 text-[10px] font-bold tracking-wider transition-colors',
                lookOpen
                  ? 'border-amber-500/70 bg-amber-500/20 text-amber-300'
                  : 'border-white/15 text-white/60 hover:border-white/40 hover:text-white',
              )}
            >
              LOOK
            </button>
            <button
              type="button"
              onClick={() => patch({ letterbox: !motion.letterbox })}
              title="Cinematic 2.39:1 bars"
              className={cn(
                'rounded border px-2 py-1 text-[10px] font-bold tracking-wider transition-colors',
                motion.letterbox
                  ? 'border-amber-500/70 bg-amber-500/20 text-amber-300'
                  : 'border-white/15 text-white/60 hover:border-white/40 hover:text-white',
              )}
            >
              BARS
            </button>
          </div>

          {lookOpen && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded border border-white/10 bg-black/60 p-3 sm:grid-cols-3">
              <HudSlider label="EXPOSURE" rangeKey="exposure" value={motion.exposure} min={0.5} max={1.6} step={0.02} onChange={(exposure) => patch({ exposure })} />
              <HudSlider label="BLOOM" rangeKey="bloom" value={motion.bloom} min={0} max={1.6} step={0.05} onChange={(bloom) => patch({ bloom })} />
              <HudSlider label="GRAIN" rangeKey="grain" value={motion.grain} min={0} max={0.2} step={0.005} digits={3} onChange={(grain) => patch({ grain })} />
              <HudSlider label="CHROMA" rangeKey="chroma" value={motion.chroma} min={0} max={2.5} step={0.05} onChange={(chroma) => patch({ chroma })} />
              <HudSlider label="VIGNETTE" rangeKey="vignette" value={motion.vignette} min={0} max={1.6} step={0.05} onChange={(vignette) => patch({ vignette })} />
              <HudSlider label="PARTICLES" rangeKey="particleScale" value={motion.particleScale} min={0} max={1.5} step={0.05} onChange={(particleScale) => patch({ particleScale })} />
              <HudSlider label="INTENSITY" rangeKey="bgIntensity" value={motion.bgIntensity} min={0} max={1.4} step={0.02} onChange={(bgIntensity) => patch({ bgIntensity })} />
              <HudSlider label="BG SPEED" rangeKey="bgSpeed" value={motion.bgSpeed} min={0} max={2} step={0.05} onChange={(bgSpeed) => patch({ bgSpeed })} />
              <HudSlider label="SATURATION" rangeKey="bgSaturation" value={motion.bgSaturation} min={0} max={2} step={0.05} onChange={(bgSaturation) => patch({ bgSaturation })} />
            </div>
          )}

          <p className="text-[9px] tracking-wider text-white/35">
            SPACE pause · R replay · F fullscreen · ← → scrub · B backdrop · G grade · {finished ? 'COMPLETE' : paused ? 'PAUSED' : 'PLAYING'}
          </p>
        </div>
      </div>
    </div>
  );
}
