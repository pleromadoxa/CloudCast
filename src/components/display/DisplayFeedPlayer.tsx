import { useDisplayFeedOptional } from '../../context/DisplayFeedContext';
import { DisplaySlideRenderer } from './DisplaySlideRenderer';
import { cn } from '../../lib/utils';

interface DisplayFeedPlayerProps {
  /** When true, show live output; otherwise show preview slide */
  live?: boolean;
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

/** Video mixer source player for the Regal Display Feed virtual input. */
export function DisplayFeedPlayer({
  live = true,
  compact = false,
  showLabel = true,
  className,
}: DisplayFeedPlayerProps) {
  const display = useDisplayFeedOptional();

  const slide = live ? display?.liveSlide : display?.previewSlide;
  const holdBg = display?.state.holdBackground;
  const keyMode = display?.state.keyMode ?? false;
  const label = live
    ? display?.isLive
      ? 'Display Feed · LIVE'
      : 'Display Feed · HOLD'
    : 'Display Feed · PREVIEW';

  return (
    <div className={cn('relative h-full w-full overflow-hidden', keyMode ? '' : 'bg-black', className)}>
      <DisplaySlideRenderer
        slide={slide ?? null}
        holdBackground={holdBg}
        showLabel={showLabel}
        label={compact ? undefined : label}
        animate={live && Boolean(display?.isLive)}
        compact={compact}
        keyMode={keyMode}
        transition={display?.state.transition ?? 'cut'}
      />
      {live && display?.isLive && (
        <div className="absolute right-2 top-2 z-30 rounded bg-violet-600/90 px-2 py-0.5 text-[9px] font-bold tracking-wider text-white">
          LIVE
        </div>
      )}
    </div>
  );
}
