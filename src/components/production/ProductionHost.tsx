import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
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
import { RegalCloudBootScreen, useRegalCloudBootVisible } from '../system/RegalCloudBootScreen';
import { cn } from '../../lib/utils';
import { ProgramPresetGate } from '../presets/ProgramPresetGate';
import { ProductionShellNav } from './ProductionShellNav';
import { CLOUDCAST_PRODUCTS } from '../../config/products';
import { isRegalCloudBootDoneThisSession } from '../../lib/regalCloudBoot';

type ProductionConsoleId = 'video' | 'audio' | 'replay' | 'display' | 'prism';

const INITIAL_MOUNTED_CONSOLES: Record<ProductionConsoleId, boolean> = {
  video: false,
  audio: false,
  replay: false,
  display: false,
  prism: false,
};

/**
 * Keeps mixer, display, prism, audio, and replay sessions alive while the user
 * navigates between production routes or marketing pages. Unmounts only when
 * every console is idle and the user leaves production dashboards.
 */
export function ProductionHost() {
  const { user, profile, loading } = useAuth();
  const { pathname } = useLocation();
  const { isOnAir, audioConsoleActive, setAudioConsoleActive, setReplayConsoleActive } =
    useProduction();
  const { isOnline } = useNetworkOptional();
  const prismFeed = usePrismFeedOptional();
  const displayFeed = useDisplayFeedOptional();

  const onDashboard = pathname === '/dashboard';
  const onReplay = pathname === '/replay';
  const onDisplay = pathname === '/display';
  const onPrism = pathname === '/prism';
  const onAudio = pathname === '/audio';
  const onHub = pathname === '/hub';
  const prismFeedLive = Boolean(prismFeed?.isLive);
  const displayFeedLive = Boolean(displayFeed?.isLive);
  const onProductionRoute = onDashboard || onReplay || onDisplay || onPrism || onAudio;

  const productionProductLabel = CLOUDCAST_PRODUCTS.find((product) => {
    if (onDashboard && product.id === 'video_mixer') return true;
    if (onAudio && product.id === 'audio_mixer') return true;
    if (onReplay && product.id === 'instant_replay') return true;
    if (onDisplay && product.id === 'regal_display') return true;
    if (onPrism && product.id === 'regal_prism') return true;
    return false;
  })?.name;

  const [shellWarm, setShellWarm] = useState(false);
  const [visitedConsoles, setVisitedConsoles] = useState(INITIAL_MOUNTED_CONSOLES);

  useEffect(() => {
    if (onProductionRoute) setShellWarm(true);
  }, [onProductionRoute]);

  const keepAlive = Boolean(
    user &&
      (onProductionRoute ||
        (onHub && shellWarm) ||
        isOnAir ||
        prismFeedLive ||
        displayFeedLive) &&
      (user || (!isOnline && onProductionRoute)),
  );

  useLayoutEffect(() => {
    if (!keepAlive) {
      setVisitedConsoles(INITIAL_MOUNTED_CONSOLES);
      return;
    }
    setVisitedConsoles((prev) => {
      const next = {
        video: prev.video || onDashboard,
        audio: prev.audio || onAudio,
        replay: prev.replay || onReplay,
        display: prev.display || onDisplay || displayFeedLive,
        prism: prev.prism || onPrism || prismFeedLive,
      };
      if (
        next.video === prev.video &&
        next.audio === prev.audio &&
        next.replay === prev.replay &&
        next.display === prev.display &&
        next.prism === prev.prism
      ) {
        return prev;
      }
      return next;
    });
  }, [keepAlive, onDashboard, onAudio, onReplay, onDisplay, onPrism, displayFeedLive, prismFeedLive]);

  const mountedConsoles = useMemo(
    () => ({
      video: visitedConsoles.video || onDashboard,
      audio: visitedConsoles.audio || onAudio,
      replay: visitedConsoles.replay || onReplay,
      display: visitedConsoles.display || onDisplay || displayFeedLive,
      prism: visitedConsoles.prism || onPrism || prismFeedLive,
    }),
    [visitedConsoles, onDashboard, onAudio, onReplay, onDisplay, onPrism, displayFeedLive, prismFeedLive],
  );

  const audioMixerActive = onAudio || audioConsoleActive || mountedConsoles.audio;
  const shellOffscreen = keepAlive && !onProductionRoute;

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

  const waitingForAuth = Boolean((loading || (user && !profile && isOnline)) && onProductionRoute);
  const showBoot = useRegalCloudBootVisible(waitingForAuth, {
    enforceMinOnReady: onProductionRoute && !isRegalCloudBootDoneThisSession(),
  });

  if (!keepAlive) return null;

  return (
    <>
      {onProductionRoute && <ProgramPresetGate />}
      <div
        className={cn(
          'fixed inset-0 z-40 flex h-full w-full flex-col bg-mixer-bg',
          shellOffscreen && 'pointer-events-none hidden',
        )}
        aria-hidden={shellOffscreen}
      >
        {onProductionRoute && <ProductionShellNav />}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <MixerErrorBoundary>
            <CloudCastProvider audioMixerActive={audioMixerActive}>
              <PgmAudioProvider>
                <DisplayFeedSyncBridge enabled={displayFeedLive || onDisplay} />
                <ReplayPgmOverlay />
                {mountedConsoles.replay && <ReplayLayout hidden={!onReplay} />}
                {mountedConsoles.display && <DisplayLayout hidden={!onDisplay} />}
                {mountedConsoles.prism && <PrismLayout hidden={!onPrism} />}
                {mountedConsoles.audio && (
                  <PgmAudioProvider localPlayback={false}>
                    <AudioMixerLayout hidden={!onAudio} />
                  </PgmAudioProvider>
                )}
                {mountedConsoles.video && (
                  <div
                    className={cn(
                      'absolute inset-0 min-h-0 flex flex-col overflow-hidden',
                      onDashboard ? 'z-10' : 'pointer-events-none hidden z-0',
                    )}
                    aria-hidden={!onDashboard}
                  >
                    <DashboardLayout active={onDashboard} />
                  </div>
                )}
              </PgmAudioProvider>
            </CloudCastProvider>
          </MixerErrorBoundary>
        </div>
      </div>
      {showBoot && onProductionRoute && (
        <RegalCloudBootScreen fullscreen productLabel={productionProductLabel} />
      )}
    </>
  );
}
