import { useCallback, useEffect, useMemo, useRef, type ReactElement } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  getMotionTemplate,
  mergeMotionOverrides,
  normalizeAccent,
  type PrismMotionState,
} from '../../../lib/prism/motionGraphics';
import { loadBrandKit, type PrismBrandKit } from '../../../lib/prism/brandKit';
import { getCustomMotionTemplate } from '../../../lib/prism/motionTemplateCustom';
import { getMotionBackdrop } from '../../../lib/prism/motionBackgrounds';
import { cn } from '../../../lib/utils';
import {
  MotionClockProvider,
  MotionLookProvider,
  useMotionClock,
  type MotionLook,
  type MotionSceneProps,
} from './kit';
import {
  claimMotionClock,
  createMotionClock,
  primeMotionClock,
  releaseMotionClock,
  type MotionClockState,
} from './motionClock';
import { MotionBackdrop } from './backdrop/MotionBackdrop';
import { SovereignOutro } from './scenes/SovereignOutro';
import { AuroraOpener } from './scenes/AuroraOpener';
import { StardustBumper } from './scenes/StardustBumper';
import { NeonTunnel } from './scenes/NeonTunnel';
import { GoldenSting } from './scenes/GoldenSting';
import { ChromeLowerThird } from './scenes/ChromeLowerThird';
import { OrbitReveal } from './scenes/OrbitReveal';
import { WorldReport } from './scenes/WorldReport';
import { GalaxyDrift } from './scenes/GalaxyDrift';
import { makeLowerThirdScene } from './scenes/lowerThirds/LowerThirdEngine';
import { makeMotionScene } from './scenes/motionTemplates/MotionTemplateEngine';
import {
  LOWER_THIRD_TEMPLATES,
  LOWER_THIRD_VISUALS,
  MOTION_TEMPLATE_BANK,
  MOTION_VISUALS,
  type LowerThirdVisual,
  type MotionTemplateVisual,
} from '../../../lib/prism/motionTemplateBank';

const SCENES: Record<string, (props: MotionSceneProps) => ReactElement> = {
  sovereign_outro: SovereignOutro,
  aurora_opener: AuroraOpener,
  stardust_bumper: StardustBumper,
  neon_tunnel: NeonTunnel,
  golden_sting: GoldenSting,
  chrome_lower_third: ChromeLowerThird,
  orbit_reveal: OrbitReveal,
  world_report: WorldReport,
  galaxy_drift: GalaxyDrift,
  // Extended bank — 20 more 3D lower thirds + 20 more motion templates.
  ...Object.fromEntries(
    LOWER_THIRD_TEMPLATES.map((tpl) => [tpl.id, makeLowerThirdScene(LOWER_THIRD_VISUALS[tpl.id])]),
  ),
  ...Object.fromEntries(
    MOTION_TEMPLATE_BANK.map((tpl) => [tpl.id, makeMotionScene(MOTION_VISUALS[tpl.id], tpl.duration)]),
  ),
};

/** Advances the shared timeline: speed, looping and the finished hold. */
function ClockDriver({
  duration,
  speed,
  loop,
  paused,
}: {
  duration: number;
  speed: number;
  loop: boolean;
  paused: boolean;
}) {
  const clock = useMotionClock();
  useFrame((_, dt) => {
    /* eslint-disable react-hooks/immutability -- the shared clock is a deliberate mutable timeline */
    if (paused) return;
    if (clock.finished && !loop) return;
    let t = clock.t + Math.min(dt, 0.1) * speed;
    if (t >= duration) {
      if (loop) {
        t = t % duration;
      } else {
        t = duration;
        clock.finished = true;
      }
    }
    clock.t = t;
    /* eslint-enable react-hooks/immutability */
  });
  return null;
}

/** Cinematic 2.39:1 bars — measured so they only appear when the frame is taller. */
function useLetterbox(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const rect = el.getBoundingClientRect();
      const aspect = rect.width / Math.max(1, rect.height);
      const bar = Math.max(0, (1 - aspect / 2.39) / 2) * rect.height;
      if (barsRef.current) barsRef.current.style.setProperty('--letterbox-px', `${bar}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    window.addEventListener('resize', apply);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, [active]);
  return { containerRef: ref, barsRef };
}

export interface MotionGraphicsStageProps {
  motion: PrismMotionState;
  /** The visible console claims the shared clock (the panel reads it). */
  master?: boolean;
  /** Freeze the timeline without unmounting (transport pause on the preview route). */
  paused?: boolean;
  className?: string;
  /** Reports the backing canvas for program-output compositing. */
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  /** Reports the WebGPU backdrop canvas (composited under the scene). */
  onBackdropReady?: (canvas: HTMLCanvasElement | null) => void;
  /** Reports the plate renderer that is live (WebGPU / Canvas2D fallback). */
  onBackdropApi?: (api: 'webgpu' | 'canvas') => void;
}

/**
 * Renders one 3D motion graphics template: an optional WebGPU backdrop plate
 * (video / photo / procedural field) with the three.js scene composited over
 * its transparent canvas, plus the operator grade and letterboxing.
 *
 * Mounted over the Regal Prism stage (or fullscreen on the preview route) and
 * composited into the program output by PrismOutputCapture.
 */
export function MotionGraphicsStage({
  motion,
  master = true,
  paused = false,
  className,
  onCanvasReady,
  onBackdropReady,
  onBackdropApi,
}: MotionGraphicsStageProps) {
  const template = getMotionTemplate(motion.templateId);
  // Custom templates carry their own visual preset tweaks — rebuild the scene
  // closure over the merged preset so saved cuts render exactly as edited.
  const custom = getCustomMotionTemplate(template.id);
  const customBaseId = custom?.baseId ?? null;
  const customDuration = custom?.definition.duration ?? 0;
  const customVisual = custom ? (custom.visual as Partial<LowerThirdVisual> & Partial<MotionTemplateVisual>) : null;
  // Gate scene rebuilds on the serialised preset — draft objects churn on
  // every keystroke but the scene must only remount when visuals change.
  const customVisualKey = customVisual ? JSON.stringify(customVisual) : '';
  const scene = useMemo<(props: MotionSceneProps) => ReactElement>(() => {
    if (customBaseId && customVisual) {
      const ltBase = LOWER_THIRD_VISUALS[customBaseId];
      if (ltBase) {
        return makeLowerThirdScene({ ...ltBase, ...(customVisual as Partial<LowerThirdVisual>) });
      }
      const mtBase = MOTION_VISUALS[customBaseId];
      if (mtBase) {
        return makeMotionScene({ ...mtBase, ...(customVisual as Partial<MotionTemplateVisual>) }, customDuration);
      }
      return SCENES[customBaseId] ?? SCENES[template.id] ?? SovereignOutro;
    }
    return SCENES[template.id] ?? SovereignOutro;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- customVisual identity churns per edit; customVisualKey gates rebuilds
  }, [customBaseId, customDuration, customVisualKey, template.id]);
  const accent = normalizeAccent(motion.accent, template.accent);
  // Brand kit: the scene's own override wins, else the operator's saved kit.
  const brand: PrismBrandKit = motion.brand ?? loadBrandKit();
  const overrides = useMemo(() => mergeMotionOverrides(template, motion.overrides), [template, motion.overrides]);
  const clock = useMemo<MotionClockState>(() => createMotionClock(), []);
  const glRef = useRef<{ toneMappingExposure: number } | null>(null);
  const onReadyRef = useRef(onCanvasReady);
  const onBackdropRef = useRef(onBackdropReady);
  useEffect(() => {
    onReadyRef.current = onCanvasReady;
    onBackdropRef.current = onBackdropReady;
  }, [onCanvasReady, onBackdropReady]);

  // Release the WebGL surface when the overlay unmounts so the program capture
  // never keeps drawing a detached canvas.
  useEffect(() => () => onReadyRef.current?.(null), []);

  const backdrop = getMotionBackdrop(motion.backgroundId);
  const backdropOn = template.fullFrame && motion.backgroundId !== 'none' && backdrop.kind !== 'none';

  const look = useMemo<MotionLook>(
    () => ({
      exposure: motion.exposure,
      bloom: motion.bloom,
      grain: motion.grain,
      chroma: motion.chroma,
      vignette: motion.vignette,
      particleScale: motion.particleScale,
      backdropActive: backdropOn,
    }),
    [
      motion.exposure,
      motion.bloom,
      motion.grain,
      motion.chroma,
      motion.vignette,
      motion.particleScale,
      backdropOn,
    ],
  );

  // Restart the timeline whenever playback is (re)started or the template swaps.
  // Playback-rate edits are deliberately excluded so dragging the speed slider
  // does not rewind the animation on every input event.
  useEffect(() => {
    primeMotionClock(clock, template.duration, motion.speed, motion.loop, motion.playToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rate is applied by the effect below
  }, [clock, template.duration, motion.loop, motion.playToken, motion.templateId, motion.active]);

  // Rate and loop edits apply to the running timeline without a rewind.
  useEffect(() => {
    clock.speed = motion.speed; // eslint-disable-line react-hooks/immutability -- shared mutable clock
    clock.loop = motion.loop;
  }, [clock, motion.speed, motion.loop]);

  useEffect(() => {
    if (!master) return;
    claimMotionClock(clock);
    return () => releaseMotionClock(clock);
  }, [master, clock]);

  // Operator exposure lands on the renderer directly (no scene re-render).
  useEffect(() => {
    if (glRef.current) glRef.current.toneMappingExposure = motion.exposure;
  }, [motion.exposure]);

  const Scene = scene;
  const { containerRef, barsRef } = useLetterbox(motion.letterbox);
  const handleBackdropCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    onBackdropRef.current?.(canvas);
  }, []);
  const backdropApiRef = useRef(onBackdropApi);
  useEffect(() => {
    backdropApiRef.current = onBackdropApi;
  }, [onBackdropApi]);
  const handleBackdropApi = useCallback((api: 'webgpu' | 'canvas') => {
    backdropApiRef.current?.(api);
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className ?? 'h-full w-full')}>
      {backdropOn && (
        <MotionBackdrop
          backgroundId={motion.backgroundId}
          accent={accent}
          intensity={motion.bgIntensity}
          saturation={motion.bgSaturation}
          speed={motion.bgSpeed}
          vignette={motion.vignette}
          grain={motion.grain}
          paused={paused}
          onCanvasReady={handleBackdropCanvas}
          onApiReady={handleBackdropApi}
        />
      )}
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 7], fov: 47, near: 0.1, far: 260 }}
        gl={{
          antialias: true,
          alpha: backdropOn || !template.fullFrame,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        onCreated={({ gl }) => {
          glRef.current = gl;
          gl.toneMappingExposure = motion.exposure;
          onReadyRef.current?.(gl.domElement);
        }}
        className={backdropOn ? 'relative h-full w-full' : undefined}
        style={{ display: 'block', background: 'transparent' }}
      >
        {template.fullFrame && !backdropOn && <color attach="background" args={['#000000']} />}
        <MotionClockProvider clock={clock}>
          <MotionLookProvider value={look}>
            <ClockDriver
              duration={template.duration}
              speed={motion.speed}
              loop={motion.loop}
              paused={paused}
            />
            <Scene
              headline={motion.headline || template.headline}
              subline={motion.subline || template.subline}
              accent={accent}
              brand={brand}
              overrides={overrides}
            />
          </MotionLookProvider>
        </MotionClockProvider>
      </Canvas>

      {motion.letterbox && (
        <div ref={barsRef} className="pointer-events-none absolute inset-0 z-30">
          <div className="absolute inset-x-0 top-0 bg-black" style={{ height: 'var(--letterbox-px, 10%)' }} />
          <div className="absolute inset-x-0 bottom-0 bg-black" style={{ height: 'var(--letterbox-px, 10%)' }} />
        </div>
      )}
    </div>
  );
}
