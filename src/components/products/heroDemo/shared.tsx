import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { seeded, useReducedMotion } from './heroDemoUtils';
import './heroDemo.css';

/* ------------------------------------------------------------------ */
/* 3D stage — the tilted "device" every demo lives inside              */
/* ------------------------------------------------------------------ */

interface HeroDemoStageProps {
  children: ReactNode;
  /** Decorative label announced to screen readers via data attribute. */
  label: string;
  /** Accent used for the ambient glow behind the device. */
  glowColor?: string;
  className?: string;
}

/**
 * A perspective stage that lifts the demo dashboard off the page:
 * a slow floating tilt, pointer parallax, ambient glow, and a mirrored
 * reflection that dissolves into the marketing background.
 */
export function HeroDemoStage({
  children,
  label,
  glowColor = 'rgba(225,29,72,0.22)',
  className,
}: HeroDemoStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Gentle pointer parallax — transforms only, never re-renders.
  useEffect(() => {
    const stage = stageRef.current;
    const tilt = tiltRef.current;
    if (!stage || !tilt || reduced) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const rect = stage.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        tilt.style.setProperty('--hero-parallax-x', `${px * 8}deg`);
        tilt.style.setProperty('--hero-parallax-y', `${py * -6}deg`);
      });
    };
    const onLeave = () => {
      tilt.style.setProperty('--hero-parallax-x', '0deg');
      tilt.style.setProperty('--hero-parallax-y', '0deg');
    };
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    return () => {
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reduced]);

  return (
    <div
      ref={stageRef}
      aria-hidden
      data-label={label}
      className={cn('hero-demo-stage select-none', reduced && 'hero-demo-stage--still', className)}
    >
      {/* Ambient glow bleeding from the device into the hero. */}
      <div
        className="hero-demo-glow"
        style={{ background: `radial-gradient(60% 55% at 50% 45%, ${glowColor} 0%, transparent 70%)` }}
      />
      <div className="hero-demo-perspective">
        <div ref={tiltRef} className="hero-demo-tilt">
          {children}
        </div>
      </div>
      {/* Reflection — a soft inverted sheen dissolving into the page. */}
      <div className="hero-demo-reflection" aria-hidden />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard window chrome                                             */
/* ------------------------------------------------------------------ */

export function HeroWindow({
  title,
  accent = '#e11d48',
  badge,
  badgeTone = 'live',
  right,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  accent?: string;
  badge?: ReactNode;
  badgeTone?: 'live' | 'idle';
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn('hero-win', className)}>
      <div className="hero-win__bar">
        <span className="hero-win__dots" aria-hidden>
          <i /> <i /> <i />
        </span>
        <span className="hero-win__title">{title}</span>
        {badge && (
          <span
            className={cn('hero-win__badge', badgeTone === 'live' ? 'hero-win__badge--live' : 'hero-win__badge--idle')}
            style={badgeTone === 'live' ? { '--badge-accent': accent } as CSSProperties : undefined}
          >
            {badge}
          </span>
        )}
        <span className="hero-win__spacer" />
        {right}
      </div>
      <div className={cn('hero-win__body', bodyClassName)}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small UI atoms                                                      */
/* ------------------------------------------------------------------ */

export function HeroPanel({
  title,
  right,
  children,
  className,
  accent,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <section className={cn('hero-panel', className)}>
      {title && (
        <header className="hero-panel__head">
          <span className="hero-panel__title">{title}</span>
          {right && <span className="hero-panel__right">{right}</span>}
        </header>
      )}
      <div className="hero-panel__body" style={accent ? { ['--panel-accent' as string]: accent } : undefined}>
        {children}
      </div>
    </section>
  );
}

export function HeroChip({
  children,
  tone = 'neutral',
  className,
  blink,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'live' | 'green' | 'amber' | 'muted';
  className?: string;
  blink?: boolean;
}) {
  return (
    <span className={cn('hero-chip', `hero-chip--${tone}`, blink && 'hero-anim-blink', className)}>{children}</span>
  );
}

export function HeroButton({
  children,
  tone = 'neutral',
  className,
  active,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'red' | 'green' | 'accent' | 'amber';
  className?: string;
  active?: boolean;
}) {
  return (
    <span className={cn('hero-btn', `hero-btn--${tone}`, active && 'hero-btn--active', className)}>{children}</span>
  );
}

/** Animated level meter — bounces organically, frozen under reduced motion. */
export function HeroMeter({
  seed = 1,
  vertical = true,
  segments = 14,
  accent = 'green',
  className,
  hot,
}: {
  seed?: number;
  vertical?: boolean;
  segments?: number;
  accent?: 'green' | 'sky' | 'amber' | 'red' | 'violet';
  className?: string;
  hot?: boolean;
}) {
  return (
    <div
      className={cn(
        'hero-meter',
        vertical ? 'hero-meter--v' : 'hero-meter--h',
        `hero-meter--${accent}`,
        hot && 'hero-meter--hot',
        className,
      )}
    >
      <div
        className="hero-meter__fill hero-anim-meter"
        style={{
          ['--meter-speed' as string]: `${1.1 + seeded(seed) * 1.4}s`,
          ['--meter-delay' as string]: `${seeded(seed, 3) * -2}s`,
          ['--meter-peak' as string]: `${52 + seeded(seed, 7) * 44}%`,
        }}
      />
      <div className="hero-meter__segments" aria-hidden>
        {Array.from({ length: segments }, (_, i) => (
          <i key={i} />
        ))}
      </div>
    </div>
  );
}

/** Static fader with a cap parked at `level` (0–100) plus a slow drift. */
export function HeroFader({
  level,
  seed = 1,
  drift = true,
  className,
}: {
  level: number;
  seed?: number;
  drift?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('hero-fader', className)}>
      <div className="hero-fader__track" aria-hidden>
        <div className="hero-fader__fill" style={{ height: `${level}%` }} />
        <div
          className={cn('hero-fader__cap', drift && 'hero-anim-fader')}
          style={{
            bottom: `calc(${level}% - 5px)`,
            ['--fader-drift' as string]: `${1.5 + seeded(seed) * 2}%`,
            ['--fader-speed' as string]: `${3 + seeded(seed, 2) * 3}s`,
            ['--fader-delay' as string]: `${seeded(seed, 5) * -3}s`,
          }}
        />
      </div>
    </div>
  );
}

export function HeroKnob({ value = 60, accent = '#22c55e', label }: { value?: number; accent?: string; label?: string }) {
  const angle = -135 + (value / 100) * 270;
  return (
    <div className="hero-knob">
      <div className="hero-knob__dial">
        <span className="hero-knob__indicator" style={{ transform: `rotate(${angle}deg)`, background: accent }} />
      </div>
      {label && <span className="hero-knob__label">{label}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fake live footage                                                   */
/* ------------------------------------------------------------------ */

export type FeedVariant = 'studio' | 'stage' | 'crowd' | 'desk' | 'sky' | 'chroma';

/**
 * Decorative "camera feed" — layered gradients, drifting light beams and
 * scanlines that read as motion footage inside tiny preview tiles.
 */
export function HeroFeed({
  variant = 'studio',
  seed = 1,
  children,
  className,
  scanlines = true,
}: {
  variant?: FeedVariant;
  seed?: number;
  children?: ReactNode;
  className?: string;
  scanlines?: boolean;
}) {
  return (
    <div className={cn('hero-feed', `hero-feed--${variant}`, className)}>
      <div className="hero-feed__scene" aria-hidden>
        <div
          className="hero-feed__beam hero-anim-beam"
          style={{ ['--beam-speed' as string]: `${7 + seeded(seed) * 6}s`, ['--beam-delay' as string]: `${seeded(seed, 2) * -8}s` }}
        />
        <div
          className="hero-feed__beam hero-feed__beam--b hero-anim-beam"
          style={{ ['--beam-speed' as string]: `${9 + seeded(seed, 4) * 7}s`, ['--beam-delay' as string]: `${seeded(seed, 6) * -9}s` }}
        />
        <div className="hero-feed__horizon" />
        <div className="hero-feed__props" />
      </div>
      {scanlines && <div className="hero-feed__scan hero-anim-scan" aria-hidden />}
      <div className="hero-feed__vignette" aria-hidden />
      {children}
    </div>
  );
}

/** Small overlay widgets that float on top of feeds. */
export function HeroLowerThird({ title, sub, accent = '#e11d48' }: { title: string; sub?: string; accent?: string }) {
  return (
    <div className="hero-l3 hero-anim-l3">
      <span className="hero-l3__bar" style={{ background: accent }} />
      <span className="hero-l3__text">
        <strong>{title}</strong>
        {sub && <em>{sub}</em>}
      </span>
    </div>
  );
}

export function HeroTimecode({ value, tone = 'light' }: { value: string; tone?: 'light' | 'red' }) {
  return <span className={cn('hero-timecode', tone === 'red' && 'hero-timecode--red')}>{value}</span>;
}
