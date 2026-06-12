import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, Smartphone } from 'lucide-react';
import { CLOUDCAST_PRODUCTS } from '../../config/products';
import { formatBytes } from '../../lib/formatBytes';
import { fetchPublishedMobileApps, getMobileAppDownloadUrl } from '../../lib/mobileAppService';
import type { PublishedMobileApp } from '../../types/mobileApps';
import type { CloudCastProductId } from '../../types/products';
import { cn } from '../../lib/utils';

const PRODUCT_ACCENTS: Record<CloudCastProductId, { border: string; badge: string }> = {
  video_mixer: { border: 'border-mixer-red/25', badge: 'text-mixer-red' },
  audio_mixer: { border: 'border-blue-500/25', badge: 'text-blue-400' },
  symphony_studio: { border: 'border-purple-500/25', badge: 'text-purple-400' },
  instant_replay: { border: 'border-emerald-500/25', badge: 'text-emerald-400' },
};

const MOBILE_LABELS: Record<CloudCastProductId, string> = {
  video_mixer: 'CloudCast Video Mobile',
  audio_mixer: 'CloudCast Audio Mobile',
  symphony_studio: 'CloudCast Symphony Mobile',
  instant_replay: 'CloudCast Replay Mobile',
};

export function MobileAppsSection({ className }: { className?: string }) {
  const [apps, setApps] = useState<PublishedMobileApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setApps(await fetchPublishedMobileApps());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mobile apps.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = async (release: PublishedMobileApp) => {
    setDownloadingId(release.id);
    setError(null);
    try {
      const url = await getMobileAppDownloadUrl(release.id);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = release.file_name ?? 'cloudcast.apk';
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <section className={cn('rounded-xl border border-white/10 bg-mixer-panel p-5', className)}>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-mixer-muted">
          <Smartphone className="h-4 w-4" />
          Mobile apps
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-mixer-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading downloads…
        </div>
      </section>
    );
  }

  if (apps.length === 0) {
    return null;
  }

  return (
    <section className={cn('rounded-xl border border-white/10 bg-mixer-panel p-5', className)}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-mixer-muted">
        <Smartphone className="h-4 w-4 text-mixer-red" />
        Mobile apps
      </div>
      <p className="mt-2 text-sm text-mixer-muted">
        Download the Android companion app for each product. Pair with your dashboard access code after install.
      </p>

      {error && <p className="mt-3 text-sm text-mixer-red">{error}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CLOUDCAST_PRODUCTS.map((product) => {
          const release = apps.find((a) => a.product_id === product.id);
          const accent = PRODUCT_ACCENTS[product.id];
          return (
            <div
              key={product.id}
              className={cn('rounded-lg border bg-black/30 p-4', accent.border)}
            >
              <p className={cn('text-[10px] font-bold uppercase tracking-wider', accent.badge)}>
                {product.shortName}
              </p>
              <p className="mt-1 text-sm font-bold">{MOBILE_LABELS[product.id]}</p>
              {release ? (
                <>
                  <p className="mt-1 text-xs text-mixer-muted">
                    Version {release.version_name}
                    {release.size_bytes > 0 ? ` · ${formatBytes(release.size_bytes)}` : ''}
                  </p>
                  {release.description && (
                    <p className="mt-2 text-xs leading-relaxed text-white/75">{release.description}</p>
                  )}
                  <button
                    type="button"
                    disabled={downloadingId === release.id}
                    onClick={() => { void handleDownload(release); }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:border-white/30 disabled:opacity-50"
                  >
                    {downloadingId === release.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Download APK
                  </button>
                </>
              ) : (
                <p className="mt-2 text-xs text-mixer-muted">Android build coming soon.</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
