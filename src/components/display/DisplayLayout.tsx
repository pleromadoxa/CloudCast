import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock,
  Copy,
  ExternalLink,
  LayoutGrid,
  LogOut,
  Maximize2,
  Minimize2,
  Monitor,
  MonitorPlay,
  Radio,
  Send,
  SlidersHorizontal,
  Square,
  Video,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCloudCastOptional } from '../../context/CloudCastContext';
import { useDisplayFeed } from '../../context/DisplayFeedContext';
import { useProduction } from '../../context/ProductionContext';
import { useDisplayKeyboardShortcuts } from '../../hooks/useDisplayKeyboardShortcuts';
import { REGAL_DISPLAY_DEVICE_ID } from '../../types/displayFeed';
import { buildCongregationViewUrl } from '../../lib/displayFeedSync';
import { DisplaySlideRenderer } from './DisplaySlideRenderer';
import { DisplayControlDeck } from './DisplayControlDeck';
import { AccessCodePanel } from '../session/AccessCodePanel';
import { cn } from '../../lib/utils';
import { ProgramPresetToolbar } from '../presets/ProgramPresetToolbar';
import { productionShellClass } from '../../lib/productionShell';

interface DisplayLayoutProps {
  /** Off-screen render while Display Feed stays live on another route */
  hidden?: boolean;
}

export function DisplayLayout({ hidden = false }: DisplayLayoutProps) {
  const { profile, signOut } = useAuth();
  const cloudcast = useCloudCastOptional();
  const feed = useDisplayFeed();
  const { requestDisplayRoute } = useProduction();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [liveFullscreen, setLiveFullscreen] = useState(false);
  const liveOutputRef = useRef<HTMLDivElement>(null);

  const accessCode = cloudcast?.session?.accessCode ?? '';
  const congregationUrl = useMemo(
    () => (accessCode ? buildCongregationViewUrl(accessCode) : ''),
    [accessCode],
  );

  const copyCongregationUrl = useCallback(async () => {
    if (!congregationUrl) return;
    try {
      await navigator.clipboard.writeText(congregationUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      /* ignore */
    }
  }, [congregationUrl]);

  const openCongregationWindow = useCallback(() => {
    if (!congregationUrl) return;
    window.open(congregationUrl, 'regal-display-congregation', 'noopener,noreferrer,width=1280,height=720');
  }, [congregationUrl]);

  const handleGoLive = useCallback(() => {
    feed.goLive();
  }, [feed]);

  const handleGoLiveAndRoutePgm = useCallback(() => {
    feed.goLive();
    requestDisplayRoute('pgm');
  }, [feed, requestDisplayRoute]);

  const handleRoutePreview = useCallback(() => {
    requestDisplayRoute('pst');
  }, [requestDisplayRoute]);

  const handleRoutePgm = useCallback(() => {
    requestDisplayRoute('pgm');
  }, [requestDisplayRoute]);

  const toggleLiveFullscreen = useCallback(async () => {
    const el = liveOutputRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
        setLiveFullscreen(false);
      } else {
        await el.requestFullscreen();
        setLiveFullscreen(true);
      }
    } catch {
      /* unsupported */
    }
  }, []);

  useDisplayKeyboardShortcuts(!hidden, {
    prevSlide: feed.prevSlide,
    nextSlide: feed.nextSlide,
    goLive: feed.goLive,
    takeLiveAndAdvance: feed.takeLiveAndAdvance,
    clearLive: feed.clearLive,
  });

  useEffect(() => {
    if (hidden) return;
    const onFullscreenChange = () => {
      setLiveFullscreen(document.fullscreenElement === liveOutputRef.current);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [hidden]);

  const playlistSlide = feed.state.playlist[feed.state.playlistIndex]
    ? feed.state.slides.find((s) => s.id === feed.state.playlist[feed.state.playlistIndex])
    : null;

  return (
    <div
      className={cn(
        productionShellClass(hidden, 'flex h-full min-h-0 flex-col bg-mixer-bg'),
      )}
      aria-hidden={hidden}
    >
      {!hidden && (
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-mixer-border bg-mixer-panel px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <MonitorPlay className="h-7 w-7 shrink-0 text-violet-400 sm:h-8 sm:w-8" />
          <span className="text-xs font-bold tracking-[0.18em] text-violet-300 sm:text-sm">REGAL DISPLAY</span>
          {profile && (
            <span className="rounded bg-white/5 px-2 py-0.5 text-[9px] font-bold tracking-wider text-mixer-muted">
              {profile.plan.name.toUpperCase()}
            </span>
          )}
          {feed.isLive && (
            <span className="animate-pulse text-[10px] font-bold text-emerald-400">● DISPLAY LIVE</span>
          )}
        </div>

        {cloudcast && (
          <AccessCodePanel
            session={cloudcast.session}
            isLoading={cloudcast.sessionLoading}
            onRegenerate={cloudcast.regenerateCode}
            isRegenerating={cloudcast.isRegenerating}
            product="video"
            error={cloudcast.error}
            onRetry={cloudcast.reconnect}
            className="min-w-0 flex"
          />
        )}

        <div className="flex shrink-0 items-center gap-2 text-[10px] sm:gap-3">
          <ProgramPresetToolbar />
          <Link to="/hub" className="hidden items-center gap-1 text-mixer-muted hover:text-white lg:inline-flex">
            <LayoutGrid className="h-3.5 w-3.5" /> HUB
          </Link>
          <Link to="/replay" className="hidden items-center gap-1 text-mixer-muted hover:text-white xl:inline-flex">
            <Clapperboard className="h-3.5 w-3.5" /> REPLAY
          </Link>
          <Link to="/audio" className="hidden items-center gap-1 text-mixer-muted hover:text-white xl:inline-flex">
            <SlidersHorizontal className="h-3.5 w-3.5" /> AUDIO
          </Link>
          <button type="button" onClick={() => signOut()} className="mixer-btn p-1" title="Sign out">
            <LogOut className="h-3 w-3" />
          </button>
        </div>
      </header>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Monitors */}
        <div className="flex min-h-0 flex-1 flex-col border-b border-mixer-border lg:border-b-0 lg:border-r">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-mixer-border md:grid-cols-2">
            {/* Preview */}
            <div className="flex min-h-0 flex-col bg-mixer-bg">
              <div className="flex shrink-0 items-center justify-between border-b border-mixer-border/60 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <Monitor className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-[10px] font-bold tracking-wider text-violet-300">PREVIEW</span>
                </div>
                <span className="truncate text-[10px] text-mixer-muted">
                  {feed.previewSlide?.title ?? 'No slide'}
                </span>
              </div>
              <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
                <DisplaySlideRenderer
                  slide={feed.previewSlide}
                  keyMode={feed.state.keyMode}
                  transition={feed.state.transition}
                  className="h-full w-full"
                />
                {feed.state.showNotes && feed.previewSlide?.notes && (
                  <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-yellow-500/30 bg-yellow-950/80 px-3 py-2">
                    <p className="text-[10px] text-yellow-200">{feed.previewSlide.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Live Display Feed output */}
            <div className="flex min-h-0 flex-col bg-mixer-bg">
              <div className="flex shrink-0 items-center justify-between border-b border-mixer-border/60 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <MonitorPlay className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[10px] font-bold tracking-wider text-emerald-300">LIVE OUTPUT</span>
                  {feed.isLive && (
                    <span className="rounded bg-emerald-600/80 px-1.5 py-0.5 text-[8px] font-bold text-white">
                      ON AIR
                    </span>
                  )}
                </div>
                <span className="truncate text-[10px] text-mixer-muted">
                  {feed.liveSlide?.title ?? 'Hold screen'}
                </span>
              </div>
              <div
                ref={liveOutputRef}
                className="relative min-h-0 flex-1 overflow-hidden bg-black"
              >
                <DisplaySlideRenderer
                  slide={feed.liveSlide}
                  holdBackground={feed.state.holdBackground}
                  animate={feed.isLive}
                  keyMode={feed.state.keyMode}
                  transition={feed.state.transition}
                  className="h-full w-full"
                />
                <button
                  type="button"
                  onClick={() => void toggleLiveFullscreen()}
                  className="absolute right-2 top-2 z-20 rounded bg-black/60 p-1.5 text-white/70 hover:bg-black/80 hover:text-white"
                  title={liveFullscreen ? 'Exit fullscreen' : 'Fullscreen live output'}
                >
                  {liveFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Transport bar */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-mixer-border bg-[#0d0d0d] px-3 py-2">
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={feed.prevSlide} className="mixer-btn px-2 py-1.5" title="Previous">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={feed.nextSlide} className="mixer-btn px-2 py-1.5" title="Next">
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="px-2 text-[10px] text-mixer-muted">
                {feed.state.playlist.length > 0
                  ? `${feed.state.playlistIndex + 1} / ${feed.state.playlist.length}`
                  : '—'}
                {playlistSlide && ` · ${playlistSlide.title}`}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center rounded border border-mixer-border/60 bg-black/30 p-0.5">
                <button
                  type="button"
                  onClick={() => feed.patchState({ transition: 'cut' })}
                  className={cn(
                    'rounded px-2 py-1 text-[8px] font-bold tracking-wider',
                    feed.state.transition === 'cut' ? 'bg-white/10 text-white' : 'text-mixer-muted hover:text-white',
                  )}
                  title="Instant cut between slides"
                >
                  CUT
                </button>
                <button
                  type="button"
                  onClick={() => feed.patchState({ transition: 'fade' })}
                  className={cn(
                    'rounded px-2 py-1 text-[8px] font-bold tracking-wider',
                    feed.state.transition === 'fade' ? 'bg-white/10 text-white' : 'text-mixer-muted hover:text-white',
                  )}
                  title="Fade between slides"
                >
                  FADE
                </button>
              </div>
              <button
                type="button"
                onClick={() => feed.patchState({ showCongregationClock: !feed.state.showCongregationClock })}
                className={cn(
                  'mixer-btn px-2 py-1.5 text-[9px] font-bold',
                  feed.state.showCongregationClock && 'atem-toggle-on',
                )}
                title="Show clock on congregation output"
              >
                <Clock className="mr-1 inline h-3 w-3" />
                CLOCK
              </button>
              <button
                type="button"
                onClick={() => feed.setKeyMode(!feed.state.keyMode)}
                className={cn(
                  'mixer-btn px-2 py-1.5 text-[9px] font-bold',
                  feed.state.keyMode && 'bg-emerald-600/40 text-emerald-200 ring-1 ring-emerald-500/50',
                )}
                title="Key mode — green top area for mixer chroma key overlays"
              >
                <KeyRound className="mr-1 inline h-3 w-3" />
                KEY
              </button>
              <button
                type="button"
                onClick={() => feed.patchState({ showNotes: !feed.state.showNotes })}
                className={cn(
                  'mixer-btn px-2 py-1.5 text-[9px] font-bold',
                  feed.state.showNotes && 'atem-toggle-on',
                )}
                title="Toggle operator notes on preview"
              >
                NOTES
              </button>
              <button
                type="button"
                onClick={handleRoutePreview}
                className="mixer-btn px-3 py-1.5 text-[10px] font-bold tracking-wider"
                title="Send Display Feed to mixer preview (PST)"
              >
                <Send className="mr-1 inline h-3 w-3" />
                TO PREVIEW
              </button>
              <button
                type="button"
                onClick={handleGoLive}
                className={cn(
                  'rounded px-4 py-1.5 text-[10px] font-bold tracking-wider transition-colors',
                  feed.isLive
                    ? 'bg-emerald-600/30 text-emerald-200 ring-1 ring-emerald-500/50'
                    : 'bg-violet-600 text-white hover:bg-violet-500',
                )}
              >
                <Radio className="mr-1 inline h-3 w-3" />
                GO LIVE
              </button>
              <button
                type="button"
                onClick={handleGoLiveAndRoutePgm}
                className="rounded bg-emerald-600 px-4 py-1.5 text-[10px] font-bold tracking-wider text-white hover:bg-emerald-500"
                title="Push to Display Feed and cut to program on video mixer"
              >
                LIVE + PGM
              </button>
              <button
                type="button"
                onClick={feed.takeLiveAndAdvance}
                className="rounded border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-[10px] font-bold tracking-wider text-emerald-200 hover:bg-emerald-900/50"
                title="Go live with preview, then advance to next slide (Shift+Enter)"
              >
                TAKE & NEXT
              </button>
              <button
                type="button"
                onClick={handleRoutePgm}
                className="mixer-btn px-3 py-1.5 text-[10px] font-bold tracking-wider text-emerald-300"
                title="Cut Display Feed to program on video mixer"
              >
                CUT TO PGM
              </button>
              <button
                type="button"
                onClick={feed.clearLive}
                className="mixer-btn px-2 py-1.5 text-mixer-red"
                title="Clear live output"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <p className="shrink-0 border-t border-mixer-border/40 px-3 py-1.5 text-[9px] text-mixer-muted">
            Shortcuts: ←/→ prev/next · Enter go live · Shift+Enter take & next · Esc clear live.
            Display Feed appears as a video source on the mixer ({REGAL_DISPLAY_DEVICE_ID}).
          </p>
        </div>

        {/* Control deck */}
        <div className="flex h-[45vh] min-h-[280px] w-full flex-col lg:h-auto lg:w-[420px] xl:w-[480px]">
          <DisplayControlDeck />
        </div>
      </div>

      <div className="shrink-0 border-t border-mixer-border bg-[#0d0d0d]">
        {congregationUrl && (
          <div className="border-b border-violet-500/20 bg-violet-950/20 px-3 py-2.5 sm:px-4">
            <p className="mb-1.5 text-[10px] font-bold tracking-wider text-violet-300">CONGREGATION OUTPUT URL</p>
            <p className="mb-2 text-[9px] text-mixer-muted">
              Open on a projector PC, tablet, or TV — shows live Display Feed only (no operator controls).
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-black/40 px-2 py-1.5 text-[10px] text-violet-200">
                {congregationUrl}
              </code>
              <button
                type="button"
                onClick={() => void copyCongregationUrl()}
                className="mixer-btn flex items-center gap-1 px-3 py-1.5 text-[9px] font-bold"
              >
                {copiedUrl ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copiedUrl ? 'COPIED' : 'COPY URL'}
              </button>
              <button
                type="button"
                onClick={openCongregationWindow}
                className="inline-flex items-center gap-1.5 rounded border border-violet-500/40 bg-violet-600/30 px-3 py-1.5 text-[9px] font-bold tracking-wider text-violet-100 hover:bg-violet-600/50"
              >
                <ExternalLink className="h-3.5 w-3.5" /> OPEN CONGREGATION VIEW
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <p className="text-[9px] text-mixer-muted">Regal Display · connected to Video Mixer</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded border border-mixer-border bg-mixer-surface px-3 py-1.5 text-[10px] font-bold tracking-wider text-mixer-text hover:border-white/20"
            >
              <Video className="h-3.5 w-3.5" /> VIDEO MIXER
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
