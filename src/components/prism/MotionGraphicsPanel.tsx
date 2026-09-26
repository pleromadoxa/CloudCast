import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Aperture, Eye, EyeOff, Maximize2, Play, RotateCcw, Sliders } from 'lucide-react';
import { usePrismFeed } from '../../context/PrismFeedContext';
import { cn } from '../../lib/utils';
import { pipelineNode } from '../../lib/prism/nodeGraph';
import {
  MOTION_ACCENTS,
  MOTION_CATEGORY_LABEL,
  MOTION_SPEED_MAX,
  MOTION_SPEED_MIN,
  clampMotionRange,
  formatMotionTime,
  getMotionTemplate,
  motionDurationSeconds,
  normalizeAccent,
  overridesFromTemplate,
  shiftAccent,
} from '../../lib/prism/motionGraphics';
import { listAllMotionTemplates } from '../../lib/prism/motionTemplateCustom';
import { loadBrandKit } from '../../lib/prism/brandKit';
import { MOTION_BACKDROPS, getMotionBackdrop } from '../../lib/prism/motionBackgrounds';
import { getActiveMotionClock, motionClockProgress } from './motion/motionClock';
import { MotionTemplateEditor } from './MotionTemplateEditor';
import { PanelField, PanelHeader, PanelNote, PanelSection, PanelToggle, panelInputClass } from './PanelChrome';

/** Compact labelled slider used by the backdrop + grade controls. */
function PanelSlider({
  label,
  value,
  min,
  max,
  step,
  digits = 2,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  digits?: number;
  onChange: (value: number) => void;
}) {
  return (
    <PanelField label={`${label} · ${value.toFixed(digits)}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-amber-500"
      />
    </PanelField>
  );
}

/**
 * 3D Motion Graphics panel — pick a cinematic template, edit its copy and
 * palette, scrub the timeline, and push it to the program output.
 */
export function MotionGraphicsPanel() {
  const { state, setMotion, studio } = usePrismFeed();
  const motion = state.motion;
  const template = getMotionTemplate(motion.templateId);
  const accent = normalizeAccent(motion.accent, template.accent);
  const backdrop = getMotionBackdrop(motion.backgroundId);

  const barRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const [finished, setFinished] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  // Seed the operator's saved brand kit into the scene state once.
  useEffect(() => {
    if (!motion.brand) setMotion({ brand: loadBrandKit() });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);

  /** Timeline length (the clock always runs on the 1× template length). */
  const duration = template.duration;
  /** Wall-clock runtime at the current playback rate. */
  const runtime = motionDurationSeconds(template, motion.speed);

  // Scrub bar follows the shared clock without re-rendering the panel.
  // The idle branch writes inside the same frame callback, so React state is
  // only ever updated from an animation frame (never synchronously in an effect).
  useEffect(() => {
    let raf = 0;
    let lastFinished: boolean | null = null;
    const tick = () => {
      const clock = motion.active ? getActiveMotionClock() : null;
      if (!clock) {
        if (barRef.current) barRef.current.style.width = '0%';
        if (timeRef.current) {
          timeRef.current.textContent = `0:00.0 / ${formatMotionTime(duration)}`;
        }
        if (lastFinished !== false) {
          lastFinished = false;
          setFinished(false);
        }
      } else {
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
  }, [motion.active, motion.templateId, duration]);

  const selectTemplate = (id: string) => {
    const next = getMotionTemplate(id);
    setMotion({
      templateId: next.id,
      headline: next.headline,
      subline: next.subline,
      accent: next.accent,
      backgroundId: next.defaultBackground ?? 'none',
      overrides: overridesFromTemplate(next),
      playToken: motion.playToken + 1,
    });
  };

  const startPlayback = () => {
    setMotion({ active: true, playToken: motion.playToken + 1, onProgram: motion.onProgram });
    setFinished(false);
  };

  const previewUrl = (() => {
    const params = new URLSearchParams({
      template: template.id,
      headline: motion.headline || template.headline,
      subline: motion.subline || template.subline,
      accent,
      speed: String(motion.speed),
      bg: motion.backgroundId,
      intensity: String(motion.bgIntensity),
      bgspeed: String(motion.bgSpeed),
      saturation: String(motion.bgSaturation),
      exposure: String(motion.exposure),
      bloom: String(motion.bloom),
      grain: String(motion.grain),
      chroma: String(motion.chroma),
      vignette: String(motion.vignette),
      particles: String(motion.particleScale),
    });
    if (motion.loop) params.set('loop', '1');
    if (motion.letterbox) params.set('bars', '1');
    return `/prism/motion-preview?${params.toString()}`;
  })();

  const motionNodeEnabled = pipelineNode(studio.nodeGraph, 'motion').enabled;

  return (
    <div className="space-y-3">
      <PanelHeader
        icon={Aperture}
        title="3D Motion Graphics"
        subtitle="Cinematic GPU titles, stings & logo outros composited over program"
      />

      <PanelSection title="Template library" hint="Film-grade 3D scenes rendered live on the stage.">
        <div className="grid grid-cols-2 gap-2">
          {listAllMotionTemplates().map((tpl) => {
            const selected = tpl.id === template.id;
            const tplAccent = normalizeAccent(selected ? accent : tpl.accent, tpl.accent);
            const isCustom = Boolean(tpl.baseId);
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => selectTemplate(tpl.id)}
                title={tpl.blurb}
                className={cn(
                  'group overflow-hidden rounded border text-left transition-all',
                  selected
                    ? 'border-amber-500/70 bg-amber-500/10 shadow-[0_0_0_1px_rgba(245,158,81,0.25)]'
                    : 'border-white/10 bg-black/50 hover:border-white/30',
                )}
              >
                <span
                  className="block h-11 w-full"
                  style={{
                    background: `radial-gradient(130% 100% at 25% 15%, ${shiftAccent(tplAccent, 0.45)}44, transparent 62%), linear-gradient(135deg, #0b0d14 0%, #050508 70%)`,
                  }}
                />
                <span className="block px-2 py-1.5">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-[10px] font-bold text-white">{tpl.name}</span>
                    {isCustom && (
                      <span className="shrink-0 rounded bg-amber-500/20 px-1 text-[7px] font-bold tracking-wider text-amber-300">
                        CUSTOM
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center justify-between text-[8px] uppercase tracking-wider text-mixer-muted">
                    <span className="truncate">{MOTION_CATEGORY_LABEL[tpl.category]}</span>
                    <span>{tpl.duration}s</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <PanelNote>{template.blurb}</PanelNote>
      </PanelSection>

      <PanelSection
        title="Template editor"
        hint="Rewrite copy, rebrand the plate, drop in your logo, save custom cuts."
      >
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[10px] font-bold tracking-wider text-amber-300 transition-colors hover:border-amber-500/70 hover:bg-amber-500/20"
        >
          <Sliders className="h-3 w-3" />
          TEMPLATE EDITOR
        </button>
        <PanelNote>
          Full broadcast graphics controller — headline, kicker, footer, plate/ink/trim colours, logo upload with
          scale & placement, background plate, plus save / rename / duplicate / delete for custom templates.
        </PanelNote>
      </PanelSection>

      <PanelSection title="Content" hint="Edit once — both the stage preview and program output update live.">
        <PanelField label="HEADLINE">
          <input
            type="text"
            value={motion.headline}
            maxLength={48}
            onChange={(e) => setMotion({ headline: e.target.value })}
            placeholder={template.headline}
            className={panelInputClass}
          />
        </PanelField>
        <PanelField label="SUB-LINE">
          <input
            type="text"
            value={motion.subline}
            maxLength={64}
            onChange={(e) => setMotion({ subline: e.target.value })}
            placeholder={template.subline}
            className={panelInputClass}
          />
        </PanelField>
        <div>
          <span className="text-[10px] font-bold tracking-wider text-mixer-muted">ACCENT</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {MOTION_ACCENTS.map((option) => (
              <button
                key={option.id}
                type="button"
                title={option.name}
                onClick={() => setMotion({ accent: option.value })}
                className={cn(
                  'h-6 w-6 rounded-full border transition-transform hover:scale-110',
                  accent.toLowerCase() === option.value.toLowerCase()
                    ? 'border-white ring-2 ring-amber-500/70'
                    : 'border-white/25',
                )}
                style={{ background: option.value }}
              />
            ))}
            <input
              type="color"
              value={accent}
              onChange={(e) => setMotion({ accent: normalizeAccent(e.target.value, accent) })}
              title="Custom accent"
              className="h-6 w-8 cursor-pointer rounded border border-white/20 bg-black p-0.5"
            />
          </div>
        </div>
      </PanelSection>

      {template.fullFrame && (
        <PanelSection
          title="Backdrop"
          hint="WebGPU plate behind the 3D scene — real space footage, the NASA world map, or procedural fields."
        >
          <div className="grid grid-cols-3 gap-1.5">
            {MOTION_BACKDROPS.map((bd) => {
              const selected = bd.id === motion.backgroundId;
              return (
                <button
                  key={bd.id}
                  type="button"
                  onClick={() => setMotion({ backgroundId: bd.id })}
                  title={bd.blurb}
                  className={cn(
                    'relative h-14 overflow-hidden rounded border transition-all',
                    selected
                      ? 'border-amber-500/70 ring-1 ring-amber-500/40'
                      : 'border-white/10 hover:border-white/30',
                  )}
                >
                  <span className="absolute inset-0" style={{ background: bd.swatch }} />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-1.5 pb-0.5 pt-3 text-left">
                    <span className="block truncate text-[9px] font-bold text-white">{bd.name}</span>
                  </span>
                  {bd.kind === 'video' && (
                    <span className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[7px] font-bold text-emerald-300">
                      VID
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <PanelNote>
            {backdrop.blurb}
            {backdrop.credit ? ` · ${backdrop.credit}` : ''}
          </PanelNote>
          <PanelSlider
            label="INTENSITY"
            value={motion.bgIntensity}
            min={0}
            max={1.4}
            step={0.02}
            onChange={(bgIntensity) => setMotion({ bgIntensity: clampMotionRange('bgIntensity', bgIntensity) })}
          />
          <PanelSlider
            label="SPEED"
            value={motion.bgSpeed}
            min={0}
            max={2}
            step={0.05}
            onChange={(bgSpeed) => setMotion({ bgSpeed: clampMotionRange('bgSpeed', bgSpeed) })}
          />
          <PanelSlider
            label="SATURATION"
            value={motion.bgSaturation}
            min={0}
            max={2}
            step={0.05}
            onChange={(bgSaturation) => setMotion({ bgSaturation: clampMotionRange('bgSaturation', bgSaturation) })}
          />
        </PanelSection>
      )}

      <PanelSection title="Look & grade" hint="Renderer grade layered over each template's own look.">
        <PanelSlider
          label="EXPOSURE"
          value={motion.exposure}
          min={0.5}
          max={1.6}
          step={0.02}
          onChange={(exposure) => setMotion({ exposure: clampMotionRange('exposure', exposure) })}
        />
        <PanelSlider
          label="BLOOM"
          value={motion.bloom}
          min={0}
          max={1.6}
          step={0.05}
          onChange={(bloom) => setMotion({ bloom: clampMotionRange('bloom', bloom) })}
        />
        <PanelSlider
          label="GRAIN"
          value={motion.grain}
          min={0}
          max={0.2}
          step={0.005}
          digits={3}
          onChange={(grain) => setMotion({ grain: clampMotionRange('grain', grain) })}
        />
        <PanelSlider
          label="CHROMA · PX"
          value={motion.chroma}
          min={0}
          max={2.5}
          step={0.05}
          digits={2}
          onChange={(chroma) => setMotion({ chroma: clampMotionRange('chroma', chroma) })}
        />
        <PanelSlider
          label="VIGNETTE"
          value={motion.vignette}
          min={0}
          max={1.6}
          step={0.05}
          onChange={(vignette) => setMotion({ vignette: clampMotionRange('vignette', vignette) })}
        />
        <PanelSlider
          label="PARTICLES"
          value={motion.particleScale}
          min={0}
          max={1.5}
          step={0.05}
          onChange={(particleScale) => setMotion({ particleScale: clampMotionRange('particleScale', particleScale) })}
        />
        <PanelToggle
          label="Cinematic bars (2.39:1)"
          description="Letterbox the frame — applied on stage and in program capture"
          checked={motion.letterbox}
          onChange={(letterbox) => setMotion({ letterbox })}
        />
      </PanelSection>

      <PanelSection
        title="Playback"
        accent
        action={
          <span className="text-[9px] font-bold tabular-nums text-mixer-muted">
            {runtime.toFixed(1)}s · {motion.speed.toFixed(2)}×
          </span>
        }
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={startPlayback}
            className="flex flex-1 items-center justify-center gap-1.5 rounded bg-amber-500 px-3 py-2 text-[10px] font-bold tracking-wider text-black hover:bg-amber-400"
          >
            {motion.active ? <RotateCcw className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {motion.active ? 'REPLAY' : 'PREVIEW'}
          </button>
          <button
            type="button"
            disabled={!motion.active}
            onClick={() => setMotion({ active: false })}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded border px-3 py-2 text-[10px] font-bold tracking-wider transition-colors',
              motion.active
                ? 'border-white/25 text-mixer-muted hover:border-white/50 hover:text-white'
                : 'border-white/10 text-mixer-muted/40',
            )}
          >
            {motion.active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            HIDE
          </button>
        </div>

        <div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              ref={barRef}
              className={cn('h-full rounded-full transition-[background] duration-300', finished ? 'bg-emerald-400' : 'bg-amber-400')}
              style={{ width: '0%' }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[9px] tabular-nums text-mixer-muted">
            <span ref={timeRef}>0:00.0 / {formatMotionTime(duration)}</span>
            <span>{finished ? 'COMPLETE' : motion.active ? 'PLAYING' : 'IDLE'}</span>
          </div>
        </div>

        <PanelField label={`SPEED · ${motion.speed.toFixed(2)}×`}>
          <input
            type="range"
            min={MOTION_SPEED_MIN}
            max={MOTION_SPEED_MAX}
            step={0.05}
            value={motion.speed}
            onChange={(e) => setMotion({ speed: Number(e.target.value) })}
            className="mt-2 w-full accent-amber-500"
          />
        </PanelField>

        <PanelToggle
          label="Loop playback"
          description="Restart the timeline automatically when it completes"
          checked={motion.loop}
          onChange={(loop) => setMotion({ loop })}
          disabled={!template.loopable}
        />
      </PanelSection>

      <PanelSection title="Program output" hint="What the mixer, RTMP stream and recorder receive.">
        <PanelToggle
          label="Show on stage"
          description="Render the overlay in the viewport for preview"
          checked={motion.active}
          onChange={(active) => setMotion({ active, ...(active ? { playToken: motion.playToken + 1 } : {}) })}
        />
        <PanelToggle
          label="Send to program"
          description="Composite the 3D graphics into the output feed"
          checked={motion.onProgram && motionNodeEnabled}
          disabled={!motion.active || !motionNodeEnabled}
          onChange={(onProgram) => setMotion({ onProgram })}
          badge={
            !motionNodeEnabled ? (
              <span className="rounded bg-white/10 px-1 py-0.5 text-[8px] font-bold text-mixer-muted">NODE OFF</span>
            ) : null
          }
        />
        <Link
          to={previewUrl}
          target="_blank"
          className="flex w-full items-center justify-center gap-1.5 rounded border border-white/15 px-3 py-2 text-[10px] font-bold tracking-wider text-mixer-muted transition-colors hover:border-amber-500/50 hover:text-amber-300"
        >
          <Maximize2 className="h-3 w-3" />
          OPEN FULLSCREEN PREVIEW
        </Link>
        <PanelNote tone={motion.onProgram && motion.active ? 'green' : 'muted'}>
          {motion.onProgram && motion.active
            ? 'Overlay is live on program — visible to the mixer, stream and recording.'
            : 'Preview only. Enable “Send to program” to route the graphics into the output feed.'}
        </PanelNote>
      </PanelSection>

      {editorOpen && (
        <MotionTemplateEditor
          templateId={template.id}
          motion={motion}
          onApply={setMotion}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}
