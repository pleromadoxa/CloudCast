import { useEffect, useRef, useState } from 'react';
import { Loader2, Radio } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { readCachedProfile } from '../../lib/profileCache';
import { CloudCastLogo } from '../brand/CloudCastLogo';
import { CLOUDCAST_NAV_LOGO } from '../../lib/branding';
import { cn } from '../../lib/utils';

import {
  isRegalCloudBootDoneThisSession,
  markRegalCloudBootDoneThisSession,
  REGAL_CLOUD_BOOT_MIN_MS,
} from '../../lib/regalCloudBoot';

export { REGAL_CLOUD_BOOT_MIN_MS };

interface UseRegalCloudBootVisibleOptions {
  minMs?: number;
  /** Show the minimum delay on first open even when auth is already ready. */
  enforceMinOnReady?: boolean;
}

/**
 * Keeps the boot screen visible for at least REGAL_CLOUD_BOOT_MIN_MS during the first
 * production open of a browser session. After that, only shows while auth is waiting.
 */
export function useRegalCloudBootVisible(
  waiting: boolean,
  { minMs = REGAL_CLOUD_BOOT_MIN_MS, enforceMinOnReady = false }: UseRegalCloudBootVisibleOptions = {},
): boolean {
  const bootStartedAtRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(() => {
    if (isRegalCloudBootDoneThisSession()) return waiting;
    if (waiting) return true;
    return enforceMinOnReady;
  });

  useEffect(() => {
    if (isRegalCloudBootDoneThisSession()) {
      setVisible(waiting);
      return;
    }

    if (waiting) {
      if (bootStartedAtRef.current === null) {
        bootStartedAtRef.current = Date.now();
      }
      setVisible(true);
      return;
    }

    if (!enforceMinOnReady && bootStartedAtRef.current === null) {
      markRegalCloudBootDoneThisSession();
      setVisible(false);
      return;
    }

    if (bootStartedAtRef.current === null) {
      bootStartedAtRef.current = Date.now();
    }

    const elapsed = Date.now() - bootStartedAtRef.current;
    const remaining = Math.max(0, minMs - elapsed);

    const finish = () => {
      markRegalCloudBootDoneThisSession();
      setVisible(false);
    };

    if (remaining === 0) {
      finish();
      return;
    }

    const timer = window.setTimeout(finish, remaining);
    return () => window.clearTimeout(timer);
  }, [waiting, minMs, enforceMinOnReady]);

  return visible;
}

interface RegalCloudBootScreenProps {
  /** Full-viewport overlay for production consoles. */
  fullscreen?: boolean;
  /** Optional product name shown under the headline. */
  productLabel?: string;
  className?: string;
}

export function RegalCloudBootScreen({
  fullscreen = false,
  productLabel,
  className,
}: RegalCloudBootScreenProps) {
  const { user } = useAuth();
  const hasCachedProfile = Boolean(user && readCachedProfile(user.id));
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 400);
    return () => window.clearInterval(timer);
  }, []);

  const showColdStartHint = !hasCachedProfile && elapsedMs >= 1500;
  const showExtendedHint = !hasCachedProfile && elapsedMs >= 5000;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center bg-mixer-bg px-6 text-center',
        fullscreen ? 'fixed inset-0 z-50' : 'min-h-screen w-full',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <CloudCastLogo variant={CLOUDCAST_NAV_LOGO.variant} className={cn(CLOUDCAST_NAV_LOGO.className, 'mb-6')} />

      <div className="relative mb-5 flex h-14 w-14 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-mixer-red/20 bg-mixer-red/5" />
        <span className="absolute inset-0 animate-ping rounded-full border border-mixer-red/15" />
        <Loader2 className="relative h-7 w-7 animate-spin text-mixer-red" aria-hidden />
      </div>

      <p className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-mixer-red">
        <Radio className="h-3.5 w-3.5" aria-hidden />
        Regal Cloud
      </p>

      <h1 className="mt-2 text-lg font-semibold tracking-tight text-white sm:text-xl">
        Waking Regal Cloud…
      </h1>

      <p className="mt-2 max-w-sm text-sm leading-relaxed text-mixer-muted">
        {productLabel
          ? `Preparing ${productLabel}. Connecting to your broadcast workspace.`
          : 'Connecting to your broadcast workspace and account settings.'}
      </p>

      {showColdStartHint && (
        <p className="mt-4 max-w-md text-xs leading-relaxed text-sky-200/80">
          The cloud may take a few seconds to wake after idle — especially on first open today.
          Your console will load automatically.
        </p>
      )}

      {showExtendedHint && (
        <p className="mt-3 max-w-md text-[11px] text-mixer-muted">
          Still connecting… pairing session and plan data are being restored in parallel.
        </p>
      )}
    </div>
  );
}
