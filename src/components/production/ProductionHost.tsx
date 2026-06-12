import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNetworkOptional } from '../../context/NetworkContext';
import { useProduction } from '../../context/ProductionContext';
import { CloudCastProvider } from '../../context/CloudCastContext';
import { PgmAudioProvider } from '../../context/PgmAudioContext';
import { DashboardLayout } from '../layout/DashboardLayout';
import { ReplayLayout } from '../replay/ReplayLayout';
import { ReplayPgmOverlay } from '../replay/ReplayPgmOverlay';
import { MixerErrorBoundary } from '../error/MixerErrorBoundary';
import { cn } from '../../lib/utils';

/**
 * Keeps the mixer session, device connections, and live output alive while the user
 * navigates to marketing, replay, or other routes. Unmounts only when off-air and off-dashboard/replay.
 */
export function ProductionHost() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const { isOnAir } = useProduction();
  const { isOnline } = useNetworkOptional();

  const onDashboard = pathname === '/dashboard';
  const onReplay = pathname === '/replay';
  const keepAlive = Boolean(
    !loading &&
      (onDashboard || onReplay || isOnAir) &&
      (user || (!isOnline && (onDashboard || onReplay))),
  );

  useEffect(() => {
    if (!isOnAir) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isOnAir]);

  if (loading && (onDashboard || onReplay)) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-mixer-bg">
        <Loader2 className="h-8 w-8 animate-spin text-mixer-red" />
      </div>
    );
  }

  if (!keepAlive) return null;

  const hiddenWhileReplay = onReplay && !onDashboard;
  const hiddenWhileOffDashboard = !onDashboard && !onReplay;

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 flex h-full w-full flex-col bg-mixer-bg',
        hiddenWhileOffDashboard && 'pointer-events-none opacity-0',
      )}
      style={hiddenWhileOffDashboard ? { left: '-10000px', top: 0 } : undefined}
      aria-hidden={hiddenWhileOffDashboard}
    >
      <MixerErrorBoundary>
        <CloudCastProvider>
          <PgmAudioProvider>
            <ReplayPgmOverlay />
            {onReplay && <ReplayLayout />}
            {(onDashboard || isOnAir) && (
              <div
                className={cn(
                  'flex h-full min-h-0 flex-col',
                  hiddenWhileReplay && 'pointer-events-none absolute opacity-0',
                )}
                style={hiddenWhileReplay ? { left: '-10000px', top: 0, width: '100%', height: '100%' } : undefined}
                aria-hidden={hiddenWhileReplay}
              >
                <DashboardLayout />
              </div>
            )}
          </PgmAudioProvider>
        </CloudCastProvider>
      </MixerErrorBoundary>
    </div>
  );
}
