import { useEffect, useState } from 'react';
import {
  currentAppBuildId,
  fetchLatestAppBuildId,
  isNewerBuildAvailable,
} from '../lib/appFreshness';

const CHECK_INTERVAL_MS = 120_000;

/** Prompt when Chrome is running a cached dashboard bundle after deploy. */
export function useAppFreshness() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return;

    let cancelled = false;

    const check = async () => {
      const latest = await fetchLatestAppBuildId();
      if (cancelled) return;
      setUpdateAvailable(isNewerBuildAvailable(latest));
    };

    void check();
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const reloadForUpdate = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('_cc', currentAppBuildId());
    window.location.replace(url.toString());
  };

  return { updateAvailable, reloadForUpdate };
}
