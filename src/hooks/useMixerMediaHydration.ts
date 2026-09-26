import { useEffect, useRef } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  mergeCloudMediaLibrary,
  syncLayersWithMediaLibrary,
} from '../lib/mixerMediaService';
import { trimMediaLibrary } from '../lib/mediaUpload';
import type { LayerSettings } from '../types/mixer';

interface UseMixerMediaHydrationOptions {
  enabled: boolean;
  userId: string | null | undefined;
  layers: LayerSettings;
  onPatchLayers: (partial: Partial<LayerSettings>) => void;
}

/** Loads the user's cloud media library on sign-in / refresh and hydrates playback URLs. */
export function useMixerMediaHydration({
  enabled,
  userId,
  layers,
  onPatchLayers,
}: UseMixerMediaHydrationOptions) {
  const hydratedForUserRef = useRef<string | null>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;

  useEffect(() => {
    if (!enabled || !userId || !isSupabaseConfigured()) return;
    if (hydratedForUserRef.current === userId) return;

    let cancelled = false;

    void (async () => {
      try {
        const merged = await mergeCloudMediaLibrary(layersRef.current.mediaLibrary);
        if (cancelled) return;
        hydratedForUserRef.current = userId;
        const library = trimMediaLibrary(merged);
        onPatchLayers(syncLayersWithMediaLibrary(layersRef.current, library));
      } catch {
        /* offline or migration pending — keep local library */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, userId, onPatchLayers]);

  useEffect(() => {
    if (!userId) hydratedForUserRef.current = null;
  }, [userId]);
}
