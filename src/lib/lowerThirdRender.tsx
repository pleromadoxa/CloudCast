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

  switch (layout as LowerThirdLayout) {
    case 'accent-top':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex min-w-[180px] max-w-full flex-col overflow-hidden shadow-lg', RADIUS[c.borderRadius])}>
            <div className="h-1" style={{ background: `linear-gradient(90deg, ${c.accentColor}, ${c.accentColor}99)` }} />
            <div className="px-4 py-2.5 backdrop-blur-sm" style={panelStyle}>{HeadlineBlock}</div>
          </div>
        </div>
      );

    case 'side-stripe':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full overflow-hidden shadow-xl', RADIUS[c.borderRadius])}>
            <div className="flex min-w-[180px] flex-col px-4 py-2.5" style={panelStyle}>{HeadlineBlock}</div>
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
            <div className="px-4 py-2.5" style={panelStyle}>{HeadlineBlock}</div>
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
            {HeadlineBlock}
          </div>
        </div>
      );

    case 'corporate-stripe':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full overflow-hidden shadow-lg', RADIUS[c.borderRadius])}>
            <div className="w-1 shrink-0" style={{ background: `linear-gradient(180deg, ${c.accentColor}, ${c.accentColor}88)` }} />
            <div className="px-4 py-2.5" style={panelStyle}>{HeadlineBlock}</div>
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
            <div className="min-w-0">{HeadlineBlock}</div>
          </div>
        </div>
      );

    case 'solid-bar':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full overflow-hidden border-l-4 shadow-md', RADIUS[c.borderRadius])} style={{ ...panelStyle, borderColor: c.accentColor }}>
            <div className="px-4 py-2.5">{HeadlineBlock}</div>
          </div>
        </div>
      );

    case 'double-rule':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className={cn('inline-flex max-w-full flex-col overflow-hidden', RADIUS[c.borderRadius])}>
            <div className="h-px w-full" style={{ backgroundColor: c.accentColor }} />
            <div className="px-4 py-2.5" style={panelStyle}>{HeadlineBlock}</div>
            <div className="h-px w-full opacity-60" style={{ backgroundColor: c.accentColor }} />
          </div>
        </div>
      );

    case 'angled-ribbon':
      return (
        <div className={wrapperClass} style={wrapperStyle}>
          <div className="inline-flex max-w-full -skew-x-6 overflow-hidden shadow-lg">
            <div className="skew-x-6 px-5 py-2.5" style={panelStyle}>{HeadlineBlock}</div>
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
            {HeadlineBlock}
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
            <div className="px-4 py-2.5" style={panelStyle}>{HeadlineBlock}</div>
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
            {HeadlineBlock}
          </div>
        </div>
      );

    default:
      return null;
  }
}
