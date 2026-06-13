import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNetworkOptional } from '../../context/NetworkContext';
import { useProduction } from '../../context/ProductionContext';
import { CloudCastProvider } from '../../context/CloudCastContext';
import { usePrismFeedOptional } from '../../context/PrismFeedContext';
import { useDisplayFeedOptional } from '../../context/DisplayFeedContext';
import { PgmAudioProvider } from '../../context/PgmAudioContext';
import { DashboardLayout } from '../layout/DashboardLayout';
import { DisplayLayout } from '../display/DisplayLayout';
import { DisplayFeedSyncBridge } from '../display/DisplayFeedSyncBridge';
import { AudioMixerLayout } from '../audio/AudioMixerLayout';
import { PrismLayout } from '../prism/PrismLayout';
import { ReplayLayout } from '../replay/ReplayLayout';
import { ReplayPgmOverlay } from '../replay/ReplayPgmOverlay';
import { MixerErrorBoundary } from '../error/MixerErrorBoundary';
import { cn } from '../../lib/utils';
import { ProgramPresetGate } from '../presets/ProgramPresetGate';
import { PRODUCTION_OFFSCREEN_STYLE } from '../../lib/productionShell';

/**
 * Keeps mixer, display, prism, audio, and replay sessions alive while the user
 * navigates between production routes or marketing pages. Unmounts only when
 * every console is idle and the user leaves production dashboards.
 */
export function ProductionHost() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const { isOnAir, audioConsoleActive, replayConsoleActive, setAudioConsoleActive, setReplayConsoleActive } =
    useProduction();
  const { isOnline } = useNetworkOptional();
  const prismFeed = usePrismFeedOptional();
  const displayFeed = useDisplayFeedOptional();

  const onDashboard = pathname === '/dashboard';
  const onReplay = pathname === '/replay';
  const onDisplay = pathname === '/display';
  const onPrism = pathname === '/prism';
  const onAudio = pathname === '/audio';
  const prismFeedLive = Boolean(prismFeed?.isLive);
  const displayFeedLive = Boolean(displayFeed?.isLive);
  const audioMixerActive = onAudio || audioConsoleActive;
  const replayConsoleActiveNow = onReplay || replayConsoleActive;

  const onProductionRoute = onDashboard || onReplay || onDisplay || onPrism || onAudio;
  const keepAlive = Boolean(
    !loading &&
      (onProductionRoute || isOnAir || prismFeedLive || displayFeedLive) &&
      (user || (!isOnline && onProductionRoute)),
  );

  useEffect(() => {
    if (keepAlive) return;
    setAudioConsoleActive(false);
    setReplayConsoleActive(false);
  }, [keepAlive, setAudioConsoleActive, setReplayConsoleActive]);

  useEffect(() => {
    if (!keepAlive) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [keepAlive]);

  if (loading && onProductionRoute) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-mixer-bg">
        <Loader2 className="h-8 w-8 animate-spin text-mixer-red" />
      </div>
    );
  }

  if (!keepAlive) return null;

  const hiddenWhileReplay = onReplay && !onDashboard && !onDisplay && !onPrism && !onAudio;
  const hiddenWhileDisplay = onDisplay && !onDashboard && !onReplay && !onPrism && !onAudio;
  const hiddenWhilePrism = onPrism && !onDashboard && !onReplay && !onDisplay && !onAudio;
  const hiddenWhileAudio = onAudio && !onDashboard && !onReplay && !onDisplay && !onPrism;
  const hiddenWhileOffDashboard = !onDashboard && !onReplay && !onDisplay && !onPrism && !onAudio;
  const hiddenPrismFeed = prismFeedLive && !onPrism;
  const hiddenDisplayFeed = displayFeedLive && !onDisplay;
  const hiddenAudioConsole = audioMixerActive && !onAudio;
  const hiddenReplayConsole = replayConsoleActiveNow && !onReplay;
  const hideDashboard =
    hiddenWhileReplay || hiddenWhileDisplay || hiddenWhilePrism || hiddenWhileAudio;

  return (
    <>
      {onProductionRoute && <ProgramPresetGate />}
      <div
        className={cn(
          'fixed inset-0 z-40 flex h-full w-full flex-col bg-mixer-bg',
          hiddenWhileOffDashboard && 'pointer-events-none opacity-0',
        )}
        style={hiddenWhileOffDashboard ? PRODUCTION_OFFSCREEN_STYLE : undefined}
        aria-hidden={hiddenWhileOffDashboard}
      >
        <MixerErrorBoundary>
          <CloudCastProvider audioMixerActive={audioMixerActive}>
            <PgmAudioProvider>
              <DisplayFeedSyncBridge enabled={displayFeedLive || onDisplay} />
              <ReplayPgmOverlay />
              {replayConsoleActiveNow && (
                <ReplayLayout hidden={hiddenReplayConsole} />
              )}
              {(onDisplay || displayFeedLive) && (
                <DisplayLayout hidden={hiddenDisplayFeed} />
              )}
              {(onPrism || hiddenPrismFeed) && <PrismLayout hidden={hiddenPrismFeed} />}
              {audioMixerActive && (
                <PgmAudioProvider localPlayback={false}>
                  <AudioMixerLayout hidden={hiddenAudioConsole} />
                </PgmAudioProvider>
              )}
              {keepAlive && (
                <div
                  className={cn(
                    'flex h-full min-h-0 flex-col',
                    (!onDashboard || hideDashboard) && 'pointer-events-none absolute opacity-0',
                  )}
                  style={!onDashboard || hideDashboard ? PRODUCTION_OFFSCREEN_STYLE : undefined}
                  aria-hidden={!onDashboard || hideDashboard}
                >
                  <DashboardLayout />
                </div>
              )}
            </PgmAudioProvider>
          </CloudCastProvider>
        </MixerErrorBoundary>
      </div>
    </>
  );
}
