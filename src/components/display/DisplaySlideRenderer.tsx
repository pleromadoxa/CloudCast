import type { DisplayBackground, DisplaySlide } from '../../types/displayFeed';
import {
  DISPLAY_SCRIPTURE_REFERENCE_PX,
  DISPLAY_SCRIPTURE_TEXT_PX,
  DISPLAY_SCRIPTURE_TRANSLATION_PX,
  DISPLAY_TEXT_SIZE_PX,
} from '../../lib/displayCanvas';
import { resolveBackgroundStyle } from '../../lib/displayBackgrounds';
import { resolveForegroundPlacement } from '../../lib/displayForegroundPosition';
import { isOverlaySlide, overlaySlideStyle } from '../../lib/displayOverlaySlide';
import { DISPLAY_KEY_COLOR } from '../../lib/displayTemplateUtils';
import { CloudCastLogo } from '../brand/CloudCastLogo';
import { DisplayCanvas } from './DisplayCanvas';
import { DisplayFitContent } from './DisplayFitContent';
import { cn } from '../../lib/utils';

interface DisplaySlideRendererProps {
  slide: DisplaySlide | null;
  holdBackground?: DisplayBackground;
  className?: string;
  showLabel?: boolean;
  label?: string;
  /** Fade-in when going live */
  animate?: boolean;
  /** Smaller hold screen for mixer thumbnails */
  compact?: boolean;
  /** Key mode — clear top area for mixer chroma overlay */
  keyMode?: boolean;
  /** Slide transition style */
  transition?: 'cut' | 'fade';
}

function getBannerHeight(slide: DisplaySlide | null): number {
  if (!slide) return 30;
  if (slide.layout === 'lower-third') return slide.bannerHeight ?? 22;
  if (slide.layout === 'banner-bottom' || slide.layout === 'banner-top') return slide.bannerHeight ?? 30;
  return 30;
}

function resolveSlideBackground(
  slide: DisplaySlide | null,
  holdBackground: DisplayBackground | undefined,
  keyMode: boolean,
): DisplayBackground | undefined {
  if (slide && isOverlaySlide(slide)) {
    return keyMode ? { kind: 'chroma', overlayOpacity: 0 } : holdBackground;
  }

  const bg = slide?.background ?? holdBackground;
  if (!bg || !keyMode) return bg;

  const layout = slide?.layout ?? 'full';
  const isBannerLayout = layout === 'banner-bottom' || layout === 'lower-third' || layout === 'banner-top';

  if (isBannerLayout && bg.kind !== 'image') {
    return { kind: 'color', color: DISPLAY_KEY_COLOR, overlayOpacity: 0 };
  }

  if (layout === 'full' && bg.kind !== 'image') {
    return { kind: 'color', color: DISPLAY_KEY_COLOR, overlayOpacity: 0 };
  }

  return bg;
}

function buildMeasureKey(slide: DisplaySlide | null): string {
  if (!slide) return 'hold';
  return [
    slide.id,
    slide.layout,
    slide.bannerHeight,
    slide.foregroundImageUrl,
    ...slide.fields.map((field) => `${field.id}:${field.visible}:${field.value}:${field.size}`),
    slide.scripture?.reference,
    slide.scripture?.text,
  ].join('|');
}

export function DisplaySlideRenderer({
  slide,
  holdBackground,
  className,
  showLabel,
  label,
  animate,
  compact = false,
  keyMode = false,
  transition = 'cut',
}: DisplaySlideRendererProps) {
  const overlaySlide = Boolean(slide && isOverlaySlide(slide));
  const renderSlide = overlaySlide && !keyMode ? null : slide;
  const bg = resolveSlideBackground(renderSlide, holdBackground, keyMode);
  const bgStyle = overlaySlide && keyMode
    ? overlaySlideStyle()
    : bg
      ? resolveBackgroundStyle(bg)
      : { background: keyMode ? DISPLAY_KEY_COLOR : '#0a0a0a' };
  const overlayOpacity = (overlaySlide && keyMode) || keyMode ? 0 : (bg?.overlayOpacity ?? 0);
  const layout = renderSlide?.layout ?? 'full';
  const bannerHeight = getBannerHeight(renderSlide);
  const isBannerBottom = layout === 'banner-bottom' || layout === 'lower-third';
  const isBannerTop = layout === 'banner-top';
  const measureKey = buildMeasureKey(renderSlide);
  const slideKey = renderSlide?.id ?? 'hold';
  const fadeClass = transition === 'fade' ? 'animate-display-fade-in' : undefined;
  const labelReserveClass = showLabel && label ? 'pb-[96px]' : undefined;
  const foregroundPlacement = renderSlide ? resolveForegroundPlacement(renderSlide) : null;

  const renderVideo = () => {
    if (!renderSlide?.videoUrl) return null;
    return (
      <video
        key={renderSlide.videoUrl}
        src={renderSlide.videoUrl}
        autoPlay
        loop={renderSlide.videoLoop ?? true}
        muted={renderSlide.videoMuted ?? true}
        playsInline
        className="absolute inset-0 z-[1] h-full w-full object-contain"
      />
    );
  };

  const renderForegroundImage = () => {
    if (!renderSlide?.foregroundImageUrl || !foregroundPlacement) return null;
    const widthPct = renderSlide.foregroundWidthPct ?? (isOverlaySlide(renderSlide) ? 100 : 35);
    const heightPct = renderSlide.foregroundHeightPct;
    return (
      <img
        src={renderSlide.foregroundImageUrl}
        alt=""
        className="pointer-events-none absolute z-[3] object-contain"
        style={{
          left: `${foregroundPlacement.x}%`,
          top: `${foregroundPlacement.y}%`,
          width: `${widthPct}%`,
          ...(heightPct ? { height: `${heightPct}%` } : { height: 'auto', maxHeight: '90%' }),
          transform: 'translate(-50%, -50%)',
        }}
      />
    );
  };

  const renderFields = () => {
    if (overlaySlide && keyMode) return null;
    return (
    <>
      {renderSlide?.fields
        .filter((f) => f.visible && (f.value.trim() || f.imageUrl))
        .map((field) => (
          <div
            key={field.id}
            className={cn(
              'w-full',
              field.align === 'left' && 'text-left',
              field.align === 'center' && 'text-center',
              field.align === 'right' && 'text-right',
            )}
          >
            {field.imageUrl && (
              <img
                src={field.imageUrl}
                alt=""
                className="mx-auto mb-[12px] max-h-[280px] max-w-full object-contain"
              />
            )}
            {field.value.trim() && (
              <p
                className={cn(
                  'w-full break-words leading-snug font-semibold text-white drop-shadow-lg',
                  renderSlide?.type === 'scripture' && field.label === 'Scripture' && 'font-serif italic leading-relaxed',
                )}
                style={{
                  fontSize: DISPLAY_TEXT_SIZE_PX[field.size],
                  ...(field.color ? { color: field.color } : null),
                }}
              >
                {field.value}
              </p>
            )}
          </div>
        ))}

      {renderSlide?.type === 'scripture' && renderSlide.scripture && !renderSlide.fields.some((f) => f.visible && f.value.trim()) && (
        <>
          <p
            className="font-bold tracking-wide text-white/80"
            style={{ fontSize: DISPLAY_SCRIPTURE_REFERENCE_PX }}
          >
            {renderSlide.scripture.reference}
          </p>
          <p
            className="max-w-full break-words text-center font-serif italic leading-relaxed text-white"
            style={{ fontSize: DISPLAY_SCRIPTURE_TEXT_PX }}
          >
            {renderSlide.scripture.text}
          </p>
          {renderSlide.scripture.translation && (
            <p className="text-white/50" style={{ fontSize: DISPLAY_SCRIPTURE_TRANSLATION_PX }}>
              {renderSlide.scripture.translation}
            </p>
          )}
        </>
      )}
    </>
    );
  };

  const renderLabel = showLabel && label ? (
    <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-[48px] py-[24px]">
      <span className="text-[28px] font-bold tracking-wide text-white">{label}</span>
    </div>
  ) : null;

  if (!renderSlide) {
    const holdStyle = keyMode
      ? { background: DISPLAY_KEY_COLOR }
      : holdBackground
        ? resolveBackgroundStyle(holdBackground)
        : { background: '#0a0a0a' };

    return (
      <DisplayCanvas className={className}>
        <div
          key={slideKey}
          className={cn(
            'relative flex h-full w-full flex-col overflow-hidden',
            animate && 'opacity-100 transition-opacity duration-500',
            fadeClass,
          )}
          style={holdStyle}
        >
          {!keyMode && (holdBackground?.overlayOpacity ?? 0) > 0 && (
            <div
              className="absolute inset-0 bg-black"
              style={{ opacity: (holdBackground?.overlayOpacity ?? 0) / 100 }}
            />
          )}
          {!keyMode && (
            <DisplayFitContent
              measureKey="hold"
              className={cn('relative z-10 px-[96px] py-[48px]', labelReserveClass)}
              contentClassName="gap-[24px] text-center"
            >
              <CloudCastLogo
                variant="dark-header"
                className={cn('opacity-90', compact ? 'h-[36px]' : 'h-[72px]')}
              />
              <p
                className="font-semibold tracking-wide text-white/80"
                style={{ fontSize: compact ? 28 : 48 }}
              >
                Welcome
              </p>
              <p
                className="tracking-[0.35em] text-white/30 uppercase"
                style={{ fontSize: compact ? 18 : 24 }}
              >
                Hold
              </p>
            </DisplayFitContent>
          )}
          {renderLabel}
        </div>
      </DisplayCanvas>
    );
  }

  if (isBannerBottom || isBannerTop) {
    const bannerBg = renderSlide.background;
    const bannerStyle =
      bannerBg.kind === 'image' && bannerBg.imageUrl
        ? resolveBackgroundStyle(bannerBg)
        : bannerBg.kind === 'color' && bannerBg.color
          ? { background: bannerBg.color }
          : resolveBackgroundStyle(bannerBg);

    const clearArea = (
      <div
        className={cn('relative', isBannerBottom ? 'shrink-0' : 'min-h-0 flex-1')}
        style={{
          height: isBannerBottom ? `${100 - bannerHeight}%` : undefined,
          background: keyMode ? DISPLAY_KEY_COLOR : 'transparent',
        }}
      />
    );

    const bannerArea = (
      <div
        className="relative flex shrink-0 flex-col overflow-hidden"
        style={{
          height: `${bannerHeight}%`,
          ...bannerStyle,
        }}
      >
        {(bannerBg.overlayOpacity ?? 0) > 0 && !keyMode && (
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-black"
            style={{ opacity: (bannerBg.overlayOpacity ?? 0) / 100 }}
          />
        )}
        <DisplayFitContent
          measureKey={measureKey}
          className={cn('relative z-[2] px-[80px] py-[20px]', labelReserveClass)}
          contentClassName="gap-[12px]"
        >
          {renderFields()}
        </DisplayFitContent>
      </div>
    );

    return (
      <DisplayCanvas className={className}>
        <div
          key={slideKey}
          className={cn(
            'relative flex h-full w-full flex-col overflow-hidden',
            animate && 'opacity-100 transition-opacity duration-500',
            fadeClass,
          )}
          style={keyMode ? { background: DISPLAY_KEY_COLOR } : bgStyle}
        >
          {isBannerTop ? (
            <>
              {bannerArea}
              {clearArea}
            </>
          ) : (
            <>
              {clearArea}
              {bannerArea}
            </>
          )}
          {renderVideo()}
          {renderForegroundImage()}
          {renderLabel}
        </div>
      </DisplayCanvas>
    );
  }

  return (
    <DisplayCanvas className={className}>
      <div
        key={slideKey}
        className={cn(
          'relative flex h-full w-full flex-col overflow-hidden',
          animate && 'opacity-100 transition-opacity duration-500',
          fadeClass,
        )}
        style={bgStyle}
      >
        {overlayOpacity > 0 && (
          <div className="pointer-events-none absolute inset-0 z-[1] bg-black" style={{ opacity: overlayOpacity / 100 }} />
        )}

        {renderVideo()}

        <DisplayFitContent
          measureKey={measureKey}
          className={cn('relative z-[2] px-[120px] py-[48px]', labelReserveClass)}
        >
          {renderFields()}
        </DisplayFitContent>

        {renderForegroundImage()}

        {renderLabel}
      </div>
    </DisplayCanvas>
  );
}
