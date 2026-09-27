import type { LowerThirdCustomization, LowerThirdLayout, LowerThirdTemplateId } from '../types/overlays';
import { LOWER_THIRD_Y, resolveLowerThirdX } from './overlayPlacement';
import { getLowerThirdTemplate } from './lowerThirdTemplates';
import { cn } from './utils';

const FONT_SIZE: Record<LowerThirdCustomization['fontSize'], string> = {
  sm: 'text-xs md:text-sm',
  md: 'text-sm md:text-base',
  lg: 'text-base md:text-lg',
};

const RADIUS: Record<LowerThirdCustomization['borderRadius'], string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  full: 'rounded-full',
};

interface RenderLowerThirdProps {
  templateId: LowerThirdTemplateId;
  customization: LowerThirdCustomization;
  headline: string;
  subline?: string;
  preview?: boolean;
  className?: string;
}

export function renderLowerThird({
  templateId,
  customization: c,
  headline,
  subline,
  preview = false,
  className,
}: RenderLowerThirdProps) {
  const layout = getLowerThirdTemplate(templateId).layout;
  const displayHeadline = headline || (preview ? 'Your Headline' : '');
  const displaySubline = subline || (preview ? 'Subtitle line' : '');

  if (!displayHeadline && !preview) return null;

  const lowerThirdX = resolveLowerThirdX(c.position, c.xPercent);
  const wrapperClass = cn(
    preview ? 'relative w-full' : 'absolute z-20 max-w-[85%]',
    className,
  );
  const wrapperStyle = preview
    ? undefined
    : {
        left: `${lowerThirdX}%`,
        top: `${LOWER_THIRD_Y}%`,
        transform: 'translate(-50%, -50%)',
      };

  const headlineClass = cn(
    'truncate font-bold tracking-wide',
    FONT_SIZE[c.fontSize],
    c.uppercase && 'uppercase',
  );
  const sublineClass = cn('mt-0.5 truncate text-[11px] font-medium');

  const panelStyle = {
    backgroundColor: c.backgroundColor,
    opacity: c.opacity / 100,
  };
  const headlineStyle = { color: c.textColor };
  const sublineStyle = { color: c.subtextColor };

  const LiveBadge = c.showLiveBadge ? (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: c.accentColor }} />
      Live
    </span>
  ) : null;

  const HeadlineBlock = (
    <>
      <p className={headlineClass} style={headlineStyle}>{displayHeadline}</p>
      {displaySubline && <p className={sublineClass} style={sublineStyle}>{displaySubline}</p>}
    </>
  );

  /** Operator-uploaded logo on the plate — scaled against the headline size. */
  const logoScale = Math.min(200, Math.max(40, c.logoScale ?? 100));
  const PlateContent = c.logoDataUrl ? (
    <div className="flex items-center gap-2.5">
      <img
        src={c.logoDataUrl}
        alt=""
        className="shrink-0 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
        style={{ height: `${Math.round((18 * logoScale) / 100)}px`, maxWidth: '96px' }}
      />
      <div className="min-w-0">{HeadlineBlock}</div>
    </div>
  ) : (
    HeadlineBlock
  );

  switch (layout as LowerThirdLayout) {
    case 'accent-top':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex min-w-[180px] max-w-full flex-col overflow-hidden shadow-lg', RADIUS[c.borderRadius])}>
            <div className="h-1" style={{ background: `linear-gradient(90deg, ${c.accentColor}, ${c.accentColor}99)` }} />
            <div className="px-4 py-2.5 backdrop-blur-sm" style={panelStyle}>{PlateContent}</div>
          </div>
        </div>
      );

    case 'side-stripe':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full overflow-hidden shadow-xl', RADIUS[c.borderRadius])}>
            <div className="flex min-w-[180px] flex-col px-4 py-2.5" style={panelStyle}>{PlateContent}</div>
            <div className="w-1 shrink-0" style={{ backgroundColor: c.accentColor }} />
          </div>
        </div>
      );

    case 'sport-split':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full items-stretch overflow-hidden shadow-lg', RADIUS[c.borderRadius])}>
            <div className="flex items-center px-2" style={{ background: `linear-gradient(180deg, ${c.accentColor}, ${c.accentColor}cc)` }}>
              <span className="text-[10px] font-black text-black">▶</span>
            </div>
            <div className="px-4 py-2.5" style={panelStyle}>{PlateContent}</div>
          </div>
        </div>
      );

    case 'glass-minimal':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div
            className={cn('inline-block max-w-full border-l-2 px-4 py-2 backdrop-blur-md', RADIUS[c.borderRadius])}
            style={{ ...panelStyle, borderColor: c.accentColor }}
          >
            {PlateContent}
          </div>
        </div>
      );

    case 'corporate-stripe':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full overflow-hidden shadow-lg', RADIUS[c.borderRadius])}>
            <div className="w-1 shrink-0" style={{ background: `linear-gradient(180deg, ${c.accentColor}, ${c.accentColor}88)` }} />
            <div className="px-4 py-2.5" style={panelStyle}>{PlateContent}</div>
          </div>
        </div>
      );

    case 'pill-live':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div
            className={cn('inline-flex max-w-full items-center gap-3 overflow-hidden px-4 py-2 shadow-lg backdrop-blur-sm', RADIUS[c.borderRadius])}
            style={{ ...panelStyle, background: `linear-gradient(90deg, ${c.backgroundColor}, ${c.accentColor}55)` }}
          >
            {LiveBadge}
            <div className="min-w-0">{PlateContent}</div>
          </div>
        </div>
      );

    case 'solid-bar':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full overflow-hidden border-l-4 shadow-md', RADIUS[c.borderRadius])} style={{ ...panelStyle, borderColor: c.accentColor }}>
            <div className="px-4 py-2.5">{PlateContent}</div>
          </div>
        </div>
      );

    case 'double-rule':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full flex-col overflow-hidden', RADIUS[c.borderRadius])}>
            <div className="h-px w-full" style={{ backgroundColor: c.accentColor }} />
            <div className="px-4 py-2.5" style={panelStyle}>{PlateContent}</div>
            <div className="h-px w-full opacity-60" style={{ backgroundColor: c.accentColor }} />
          </div>
        </div>
      );

    case 'angled-ribbon':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className="inline-flex max-w-full -skew-x-6 overflow-hidden shadow-lg">
            <div className="skew-x-6 px-5 py-2.5" style={panelStyle}>{PlateContent}</div>
            <div className="w-3 skew-x-6" style={{ backgroundColor: c.accentColor }} />
          </div>
        </div>
      );

    case 'neon-glow':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div
            className={cn('inline-block max-w-full px-4 py-2.5 shadow-lg', RADIUS[c.borderRadius])}
            style={{ ...panelStyle, boxShadow: `0 0 18px ${c.accentColor}88, inset 0 0 0 1px ${c.accentColor}` }}
          >
            {PlateContent}
          </div>
        </div>
      );

    case 'split-duo':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full overflow-hidden shadow-lg', RADIUS[c.borderRadius])}>
            <div className="flex items-center px-3 py-2.5 font-black uppercase" style={{ backgroundColor: c.accentColor, color: '#0f172a' }}>
              <span className="text-[10px]">LIVE</span>
            </div>
            <div className="px-4 py-2.5" style={panelStyle}>{PlateContent}</div>
          </div>
        </div>
      );

    case 'outline-box':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div
            className={cn('inline-block max-w-full border px-4 py-2.5 backdrop-blur-sm', RADIUS[c.borderRadius])}
            style={{ ...panelStyle, borderColor: `${c.accentColor}99` }}
          >
            {PlateContent}
          </div>
        </div>
      );

    /* ── 26 new layouts ── */

    case 'gradient-bar':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div
            className={cn('inline-flex max-w-full overflow-hidden shadow-xl', RADIUS[c.borderRadius])}
            style={{ background: `linear-gradient(135deg, ${c.accentColor}, ${c.accentColor}88, ${c.backgroundColor})` }}
          >
            <div className="px-5 py-2.5">{PlateContent}</div>
          </div>
        </div>
      );

    case 'frosted-pill':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div
            className={cn('inline-flex max-w-full items-center gap-3 overflow-hidden px-5 py-2 backdrop-blur-xl', RADIUS[c.borderRadius])}
            style={{ ...panelStyle, border: `1px solid ${c.accentColor}44` }}
          >
            {LiveBadge}
            <div className="min-w-0">{PlateContent}</div>
          </div>
        </div>
      );

    case 'diagonal-cut':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className="inline-flex max-w-full overflow-hidden shadow-lg">
            <div className="px-5 py-2.5" style={panelStyle}>{PlateContent}</div>
            <div className="w-6 -skew-x-12" style={{ backgroundColor: c.accentColor }} />
          </div>
        </div>
      );

    case 'bottom-accent':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full flex-col overflow-hidden shadow-lg', RADIUS[c.borderRadius])}>
            <div className="px-4 py-2.5" style={panelStyle}>{PlateContent}</div>
            <div className="h-1" style={{ background: `linear-gradient(90deg, ${c.accentColor}, transparent)` }} />
          </div>
        </div>
      );

    case 'tag-badge':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full items-center gap-2 overflow-hidden shadow-lg', RADIUS[c.borderRadius])}>
            <div className="px-2.5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: c.accentColor }}>
              <span className="rotate-0">▶</span>
            </div>
            <div className="px-3 py-2" style={panelStyle}>{PlateContent}</div>
          </div>
        </div>
      );

    case 'split-name':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full overflow-hidden shadow-lg', RADIUS[c.borderRadius])}>
            <div className="flex items-center px-3 py-2.5" style={{ backgroundColor: c.accentColor }}>
              <span className="text-[10px] font-black uppercase text-white/90">●</span>
            </div>
            <div className="px-4 py-2.5" style={panelStyle}>{PlateContent}</div>
          </div>
        </div>
      );

    case 'layered-stack':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full flex-col overflow-hidden shadow-xl', RADIUS[c.borderRadius])}>
            <div className="h-0.5 w-full" style={{ backgroundColor: c.accentColor }} />
            <div className="px-4 py-2.5" style={panelStyle}>{PlateContent}</div>
            <div className="h-0.5 w-2/3 opacity-50" style={{ backgroundColor: c.accentColor }} />
          </div>
        </div>
      );

    case 'corner-bracket':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('relative inline-block max-w-full px-5 py-3', RADIUS[c.borderRadius])} style={panelStyle}>
            <div className="absolute left-0 top-0 h-3 w-0.5" style={{ backgroundColor: c.accentColor }} />
            <div className="absolute left-0 top-0 h-0.5 w-3" style={{ backgroundColor: c.accentColor }} />
            <div className="absolute bottom-0 right-0 h-3 w-0.5" style={{ backgroundColor: c.accentColor }} />
            <div className="absolute bottom-0 right-0 h-0.5 w-3" style={{ backgroundColor: c.accentColor }} />
            {PlateContent}
          </div>
        </div>
      );

    case 'underline-slide':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-block max-w-full px-4 py-2', RADIUS[c.borderRadius])} style={panelStyle}>
            {PlateContent}
            <div className="mt-1 h-0.5 w-full origin-left animate-[scaleX_0.4s_ease-out]" style={{ backgroundColor: c.accentColor, transform: 'scaleX(1)' }} />
          </div>
        </div>
      );

    case 'circle-avatar':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full items-center gap-3 px-4 py-2 shadow-lg', RADIUS[c.borderRadius])} style={panelStyle}>
            <div className="h-8 w-8 shrink-0 rounded-full border-2" style={{ borderColor: c.accentColor, backgroundColor: `${c.accentColor}33` }} />
            <div className="min-w-0">{PlateContent}</div>
          </div>
        </div>
      );

    case 'wave-ribbon':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className="inline-flex max-w-full overflow-hidden shadow-lg">
            <div className="px-5 py-2.5" style={panelStyle}>{PlateContent}</div>
            <div className="flex items-center px-1">
              <svg width="24" height="40" viewBox="0 0 24 40" className="shrink-0">
                <path d="M0,0 Q12,10 0,20 Q12,30 0,40 L24,40 L24,0 Z" fill={c.accentColor} />
              </svg>
            </div>
          </div>
        </div>
      );

    case 'hex-accent':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full items-center gap-2 overflow-hidden shadow-lg', RADIUS[c.borderRadius])}>
            <div className="ml-2 h-6 w-6 rotate-45" style={{ backgroundColor: c.accentColor }} />
            <div className="px-3 py-2.5" style={panelStyle}>{PlateContent}</div>
          </div>
        </div>
      );

    case 'shadow-plate':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div
            className={cn('inline-block max-w-full px-5 py-3', RADIUS[c.borderRadius])}
            style={{ ...panelStyle, boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${c.accentColor}22` }}
          >
            {PlateContent}
          </div>
        </div>
      );

    case 'top-accent-bar':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full flex-col overflow-hidden shadow-lg', RADIUS[c.borderRadius])}>
            <div className="h-1 w-full" style={{ backgroundColor: c.accentColor }} />
            <div className="px-4 py-2.5" style={panelStyle}>{PlateContent}</div>
          </div>
        </div>
      );

    case 'left-thick-bar':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full overflow-hidden shadow-xl', RADIUS[c.borderRadius])}>
            <div className="w-1.5 shrink-0" style={{ backgroundColor: c.accentColor }} />
            <div className="px-4 py-2.5" style={panelStyle}>{PlateContent}</div>
          </div>
        </div>
      );

    case 'gradient-border':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div
            className={cn('inline-block max-w-full px-4 py-2.5', RADIUS[c.borderRadius])}
            style={{ ...panelStyle, border: `2px solid transparent`, backgroundImage: `linear-gradient(${c.backgroundColor}, ${c.backgroundColor}), linear-gradient(135deg, ${c.accentColor}, ${c.accentColor}66)`, backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' }}
          >
            {PlateContent}
          </div>
        </div>
      );

    case 'glass-card':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div
            className={cn('inline-block max-w-full px-5 py-3 backdrop-blur-lg', RADIUS[c.borderRadius])}
            style={{ ...panelStyle, border: `1px solid ${c.accentColor}33`, boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}
          >
            {PlateContent}
          </div>
        </div>
      );

    case 'split-header':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full overflow-hidden shadow-xl', RADIUS[c.borderRadius])}>
            <div className="flex items-center px-3 py-2.5 font-black uppercase" style={{ backgroundColor: c.accentColor, color: '#fff' }}>
              <span className="text-[10px] tracking-widest">{c.uppercase ? 'LIVE' : '●'}</span>
            </div>
            <div className="px-4 py-2.5" style={panelStyle}>{PlateContent}</div>
          </div>
        </div>
      );

    case 'minimal-line':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-block max-w-full px-4 py-2', RADIUS[c.borderRadius])} style={panelStyle}>
            {PlateContent}
            <div className="mt-1 h-px w-full" style={{ backgroundColor: `${c.accentColor}66` }} />
          </div>
        </div>
      );

    case 'bold-stripe':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full overflow-hidden shadow-lg', RADIUS[c.borderRadius])}>
            <div className="w-2 shrink-0" style={{ backgroundColor: c.accentColor }} />
            <div className="px-4 py-2.5" style={panelStyle}>{PlateContent}</div>
            <div className="w-2 shrink-0 opacity-50" style={{ backgroundColor: c.accentColor }} />
          </div>
        </div>
      );

    case 'retro-box':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div
            className={cn('inline-block max-w-full border-2 px-4 py-2.5', RADIUS[c.borderRadius])}
            style={{ ...panelStyle, borderColor: c.accentColor }}
          >
            {PlateContent}
          </div>
        </div>
      );

    case 'cinematic-bar':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full flex-col overflow-hidden', RADIUS[c.borderRadius])}>
            <div className="h-px w-full opacity-30" style={{ backgroundColor: c.accentColor }} />
            <div className="px-5 py-3" style={panelStyle}>{PlateContent}</div>
            <div className="h-px w-full opacity-30" style={{ backgroundColor: c.accentColor }} />
          </div>
        </div>
      );

    case 'wide-banner':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full overflow-hidden', RADIUS[c.borderRadius])} style={{ ...panelStyle, background: `linear-gradient(90deg, ${c.accentColor}, ${c.backgroundColor})` }}>
            <div className="px-6 py-2.5">{PlateContent}</div>
          </div>
        </div>
      );

    case 'text-only':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-block max-w-full px-3 py-1.5', RADIUS[c.borderRadius])} style={panelStyle}>
            {PlateContent}
          </div>
        </div>
      );

    case 'dual-accent':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full overflow-hidden shadow-lg', RADIUS[c.borderRadius])}>
            <div className="w-1 shrink-0" style={{ backgroundColor: c.accentColor }} />
            <div className="px-4 py-2.5" style={panelStyle}>{PlateContent}</div>
            <div className="w-1 shrink-0" style={{ backgroundColor: c.subtextColor }} />
          </div>
        </div>
      );

    case 'pill-outline':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div
            className={cn('inline-flex max-w-full items-center gap-3 overflow-hidden px-5 py-2', RADIUS[c.borderRadius])}
            style={{ border: `1.5px solid ${c.accentColor}`, backgroundColor: 'transparent' }}
          >
            {LiveBadge}
            <div className="min-w-0">{PlateContent}</div>
          </div>
        </div>
      );

    default:
      return null;
  }
}
