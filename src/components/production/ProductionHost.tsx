import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNetworkOptional } from '../../context/NetworkContext';
import { useProduction } from '../../context/ProductionContext';
import { CloudCastProvider } from '../../context/CloudCastContext';
import { PgmAudioProvider } from '../../context/PgmAudioContext';
import { DashboardLayout } from '../layout/DashboardLayout';
import { MixerErrorBoundary } from '../error/MixerErrorBoundary';
import { cn } from '../../lib/utils';

/**
 * Keeps the mixer session, device connections, and live output alive while the user
 * navigates to marketing or other routes. Unmounts only when off-air and off-dashboard.
 */
export function ProductionHost() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const { isOnAir } = useProduction();
  const { isOnline } = useNetworkOptional();

  const onDashboard = pathname === '/dashboard';
  // Keep mixer mounted on dashboard even when offline (session + layout stay in memory).
  const keepAlive = Boolean(
    !loading && (onDashboard || isOnAir) && (user || (!isOnline && onDashboard)),
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

  if (loading && onDashboard) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-mixer-bg">
        <Loader2 className="h-8 w-8 animate-spin text-mixer-red" />
      </div>
    );
  }

  if (!keepAlive) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 flex h-full w-full flex-col bg-mixer-bg',
        !onDashboard && 'pointer-events-none opacity-0',
      )}
      style={!onDashboard ? { left: '-10000px', top: 0 } : undefined}
      aria-hidden={!onDashboard}
    >
      <MixerErrorBoundary>
        <CloudCastProvider>
          <PgmAudioProvider>
            <DashboardLayout />
          </PgmAudioProvider>
        </CloudCastProvider>
      </MixerErrorBoundary>
    </div>
  );
}
