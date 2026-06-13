import type { DisplayBackground, DisplaySlide } from '../../types/displayFeed';
import {
  DISPLAY_SCRIPTURE_REFERENCE_PX,
  DISPLAY_SCRIPTURE_TEXT_PX,
  DISPLAY_SCRIPTURE_TRANSLATION_PX,
  DISPLAY_TEXT_SIZE_PX,
} from '../../lib/displayCanvas';
import { resolveBackgroundStyle } from '../../lib/displayBackgrounds';
import { DISPLAY_KEY_COLOR } from '../../lib/displayTemplateUtils';
import { CloudCastLogo } from '../brand/CloudCastLogo';
import { DisplayCanvas } from './DisplayCanvas';
import { DisplayFitContent } from './DisplayFitContent';
import { cn } from '../../lib/utils';

const FOREGROUND_SIZE: Record<NonNullable<DisplaySlide['foregroundSize']>, string> = {
  small: 'max-h-[180px] max-w-[400px]',
  medium: 'max-h-[320px] max-w-[720px]',
  large: 'max-h-[480px] max-w-[960px]',
};

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
  const bg = resolveSlideBackground(slide, holdBackground, keyMode);
  const bgStyle = bg ? resolveBackgroundStyle(bg) : { background: keyMode ? DISPLAY_KEY_COLOR : '#0a0a0a' };
  const overlayOpacity = keyMode ? 0 : (bg?.overlayOpacity ?? 0);
  const layout = slide?.layout ?? 'full';
  const bannerHeight = getBannerHeight(slide);
  const isBannerBottom = layout === 'banner-bottom' || layout === 'lower-third';
  const isBannerTop = layout === 'banner-top';
  const measureKey = buildMeasureKey(slide);
  const slideKey = slide?.id ?? 'hold';
  const fadeClass = transition === 'fade' ? 'animate-display-fade-in' : undefined;
  const labelReserveClass = showLabel && label ? 'pb-[96px]' : undefined;

  const renderFields = () => (
    <>
      {slide?.foregroundImageUrl && (
        <img
          src={slide.foregroundImageUrl}
          alt=""
          className={cn(
            'shrink object-contain',
            FOREGROUND_SIZE[slide.foregroundSize ?? 'medium'],
            slide.foregroundPosition === 'top' && 'self-start',
            slide.foregroundPosition === 'bottom' && 'self-end',
          )}
        />
      )}

      {slide?.fields
        .filter((f) => f.visible && f.value.trim())
        .map((field) => (
          <p
            key={field.id}
            className={cn(
              'w-full break-words leading-snug font-semibold text-white drop-shadow-lg',
              field.align === 'left' && 'text-left',
              field.align === 'center' && 'text-center',
              field.align === 'right' && 'text-right',
              slide?.type === 'scripture' && field.label === 'Scripture' && 'font-serif italic leading-relaxed',
            )}
            style={{
              fontSize: DISPLAY_TEXT_SIZE_PX[field.size],
              ...(field.color ? { color: field.color } : null),
            }}
          >
            {field.value}
          </p>
        ))}

      {slide?.type === 'scripture' && slide.scripture && !slide.fields.some((f) => f.visible && f.value.trim()) && (
        <>
          <p
            className="font-bold tracking-wide text-white/80"
            style={{ fontSize: DISPLAY_SCRIPTURE_REFERENCE_PX }}
          >
            {slide.scripture.reference}
          </p>
          <p
            className="max-w-full break-words text-center font-serif italic leading-relaxed text-white"
            style={{ fontSize: DISPLAY_SCRIPTURE_TEXT_PX }}
          >
            {slide.scripture.text}
          </p>
          {slide.scripture.translation && (
            <p className="text-white/50" style={{ fontSize: DISPLAY_SCRIPTURE_TRANSLATION_PX }}>
              {slide.scripture.translation}
            </p>
          )}
        </>
      )}
    </>
  );

  const renderLabel = showLabel && label ? (
    <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-[48px] py-[24px]">
      <span className="text-[28px] font-bold tracking-wide text-white">{label}</span>
    </div>
  ) : null;

  if (!slide) {
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
    const bannerBg = slide.background;
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

        <DisplayFitContent
          measureKey={measureKey}
          className={cn('relative z-[2] px-[120px] py-[48px]', labelReserveClass)}
        >
          {renderFields()}
        </DisplayFitContent>

        {renderLabel}
      </div>
    </DisplayCanvas>
  );
}
