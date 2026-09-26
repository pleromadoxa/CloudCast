import { useEffect, useRef } from 'react';
import { Globe, MousePointer2, Volume2, VolumeX } from 'lucide-react';
import { useBrowserFeedOptional } from '../../context/BrowserFeedContext';
import type { BrowserFeedRole } from '../../types/browserFeed';
import { cn } from '../../lib/utils';

interface BrowserFeedPlayerProps {
  feedRole: BrowserFeedRole;
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

/**
 * Video Mixer Browser Shot player.
 * Only one role mounts the live iframe at a time (singleton) so YouTube/web audio
 * is not duplicated across PST + PGM + strip.
 */
export function BrowserFeedPlayer({
  feedRole,
  compact = false,
  showLabel = true,
  className,
}: BrowserFeedPlayerProps) {
  const browser = useBrowserFeedOptional();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  const hasUrl = Boolean(browser?.state.embedUrl);
  const isOwner = browser?.iframeOwner === feedRole;
  const canClaim =
    Boolean(browser) &&
    hasUrl &&
    !compact &&
    (feedRole === 'pgm' ||
      feedRole === 'pst' ||
      feedRole === 'panel' ||
      (feedRole === 'strip' && !browser?.pstIsBrowser && !browser?.pgmIsBrowser));

  useEffect(() => {
    if (!browser || !canClaim) return;
    browser.claimIframe(feedRole);
    return () => browser.releaseIframe(feedRole);
  }, [browser, canClaim, feedRole]);

  const allowInteract =
    Boolean(browser?.state.interactive) &&
    isOwner &&
    (feedRole !== 'pgm' || Boolean(browser?.state.interactiveOnPgm));

  useEffect(() => {
    if (!isOwner || !browser || browser.urlKind !== 'youtube') {
      if (isOwner) browser?.registerYoutubeFrame(null);
      return;
    }
    const frame = iframeRef.current?.contentWindow ?? null;
    browser.registerYoutubeFrame(frame);
    return () => browser.registerYoutubeFrame(null);
  }, [isOwner, browser, browser?.urlKind, browser?.state.reloadToken, browser?.state.embedUrl]);

  const label =
    feedRole === 'pgm'
      ? browser?.pgmIsBrowser
        ? 'Browser · PGM'
        : 'Browser'
      : feedRole === 'pst'
        ? 'Browser · PST'
        : 'Browser';

  const showControls = isOwner && hasUrl && !compact && Boolean(browser);

  return (
    <div
      ref={hostRef}
      className={cn('relative h-full w-full overflow-hidden bg-black', className)}
      data-browser-feed-role={feedRole}
      data-browser-feed-owner={isOwner ? '1' : '0'}
    >
      {isOwner && hasUrl ? (
        <iframe
          key={`${browser!.state.embedUrl}::${browser!.state.reloadToken}`}
          ref={iframeRef}
          title="CloudCast Browser Shot"
          src={browser!.state.embedUrl}
          className={cn(
            'absolute inset-0 h-full w-full border-0 bg-black',
            allowInteract ? 'pointer-events-auto' : 'pointer-events-none',
          )}
          // sandbox keeps the page contained but still allows typical web apps / YouTube.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; microphone; camera"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : hasUrl ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-sky-950/50 to-black p-4 text-center">
          <Globe className={cn(compact ? 'h-4 w-4' : 'h-8 w-8', 'text-sky-400/70')} />
          {!compact && (
            <>
              <p className="text-xs font-bold tracking-[0.2em] text-sky-300/90">BROWSER</p>
              <p className="max-w-[220px] text-[10px] text-mixer-muted">
                {browser?.iframeOwner === 'pgm'
                  ? 'Live on Program — interact on the PGM monitor.'
                  : 'Shot is open on another monitor.'}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-sky-950/40 to-black p-4 text-center">
          {compact ? (
            <Globe className="h-4 w-4 text-sky-400/60" />
          ) : (
            <>
              <Globe className="h-8 w-8 text-sky-400/60" />
              <p className="text-xs font-bold tracking-[0.2em] text-sky-400/80">BROWSER</p>
              <p className="max-w-[220px] text-[10px] text-mixer-muted">
                Open a URL in the Browser panel, preview here, then take to PGM.
              </p>
            </>
          )}
        </div>
      )}

      {showLabel && !compact && (
        <div className="pointer-events-none absolute left-2 top-2 z-30 rounded bg-black/70 px-2 py-0.5 text-[9px] font-bold tracking-wider text-sky-300">
          {hasUrl ? label : 'Browser · STANDBY'}
        </div>
      )}

      {hasUrl && feedRole === 'pgm' && browser?.pgmIsBrowser && (
        <div className="pointer-events-none absolute right-2 top-2 z-30 rounded bg-sky-600/90 px-2 py-0.5 text-[9px] font-bold tracking-wider text-white">
          LIVE
        </div>
      )}

      {showControls && (
        <div className="absolute inset-x-0 bottom-0 z-40 flex items-center gap-1 bg-gradient-to-t from-black/90 to-transparent px-2 py-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (feedRole === 'pgm') browser!.onToggleProgramMute();
              else browser!.onTogglePreviewMute();
            }}
            className={cn(
              'rounded bg-black/60 p-1 text-white hover:bg-sky-600/80',
              !browser!.effectiveMuted && 'ring-1 ring-sky-400/60',
            )}
            title={browser!.effectiveMuted ? 'Unmute' : 'Mute'}
          >
            {browser!.effectiveMuted ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </button>
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold tracking-wider',
              allowInteract ? 'text-sky-300' : 'text-mixer-muted',
            )}
          >
            <MousePointer2 className="h-3 w-3" />
            {allowInteract ? 'INTERACT' : 'LOCKED'}
          </span>
        </div>
      )}
    </div>
  );
}
