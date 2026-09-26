import { useMemo, useState } from 'react';
import {
  Clapperboard,
  Gem,
  Loader2,
  MonitorPlay,
  Music,
  Power,
  SlidersHorizontal,
  Video,
} from 'lucide-react';
import { ConfirmServiceToggleModal } from './ConfirmServiceToggleModal';
import { AdminSection, StatCard, StatCardGrid } from './AdminShared';
import { CLOUDCAST_PRODUCTS } from '../../config/products';
import { adminSetPlatformProductService } from '../../lib/adminService';
import { setPlatformProductServiceMap } from '../../lib/platformProductServices';
import { useAuth } from '../../context/AuthContext';
import type { PlatformProductServiceRow } from '../../types/admin';
import type { CloudCastProductId } from '../../types/products';
import { cn } from '../../lib/utils';

const ICONS = {
  video_mixer: Video,
  audio_mixer: SlidersHorizontal,
  symphony_studio: Music,
  instant_replay: Clapperboard,
  regal_display: MonitorPlay,
  regal_prism: Gem,
} as const;

export function AdminServicesPanel({
  services,
  onRefresh,
}: {
  services: PlatformProductServiceRow[];
  onRefresh: () => Promise<void>;
}) {
  const { refreshPlatformServices } = useAuth();
  const [pending, setPending] = useState<{
    productId: CloudCastProductId;
    enabling: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => {
    const map = new Map<CloudCastProductId, PlatformProductServiceRow>();
    for (const row of services) map.set(row.product_id, row);
    return map;
  }, [services]);

  const enabledCount = CLOUDCAST_PRODUCTS.filter((p) => byId.get(p.id)?.is_enabled !== false).length;
  const disabledCount = CLOUDCAST_PRODUCTS.length - enabledCount;

  const pendingProduct = pending
    ? CLOUDCAST_PRODUCTS.find((p) => p.id === pending.productId)
    : null;

  const requestToggle = (productId: CloudCastProductId, currentlyEnabled: boolean) => {
    setError(null);
    setPending({ productId, enabling: !currentlyEnabled });
  };

  const confirmToggle = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await adminSetPlatformProductService(pending.productId, pending.enabling);
      // Keep client gate in sync immediately for this admin session.
      setPlatformProductServiceMap(
        Object.fromEntries(
          CLOUDCAST_PRODUCTS.map((p) => {
            const row = byId.get(p.id);
            const enabled =
              p.id === pending.productId ? pending.enabling : row?.is_enabled !== false;
            return [p.id, enabled];
          }),
        ) as Record<CloudCastProductId, boolean>,
      );
      setPending(null);
      await Promise.all([onRefresh(), refreshPlatformServices()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update service.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <StatCardGrid cols={3}>
        <StatCard label="Total services" value={CLOUDCAST_PRODUCTS.length} icon={Power} tone="accent" />
        <StatCard label="Enabled" value={enabledCount} icon={Power} tone="success" />
        <StatCard label="Disabled" value={disabledCount} icon={Power} tone="danger" />
      </StatCardGrid>

      <AdminSection
        title="Dashboard apps & services"
        description="Platform-wide switches for every CloudCast product. Disabled services are hidden from hubs, nav, and route gates."
      >
        {error && (
          <p className="mb-3 rounded border border-mixer-red/30 bg-mixer-red/10 px-3 py-2 text-xs text-mixer-red">
            {error}
          </p>
        )}

        <div className="space-y-2">
          {CLOUDCAST_PRODUCTS.map((product) => {
            const row = byId.get(product.id);
            const enabled = row?.is_enabled !== false;
            const Icon = ICONS[product.id];
            return (
              <div
                key={product.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3',
                  enabled ? 'border-white/10 bg-black/30' : 'border-mixer-red/25 bg-mixer-red/5',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                    enabled ? 'border-white/10 bg-white/5 text-white' : 'border-mixer-red/30 text-mixer-red',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white">{product.name}</p>
                  <p className="text-[11px] text-mixer-muted">
                    {product.tagline}
                    {row?.updated_at && (
                      <>
                        {' · '}
                        Updated {new Date(row.updated_at).toLocaleString()}
                        {row.updated_by_email ? ` by ${row.updated_by_email}` : ''}
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider',
                      enabled
                        ? 'bg-mixer-green/15 text-mixer-green'
                        : 'bg-mixer-red/15 text-mixer-red',
                    )}
                  >
                    {enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`${enabled ? 'Disable' : 'Enable'} ${product.shortName}`}
                    onClick={() => requestToggle(product.id, enabled)}
                    className={cn(
                      'relative h-7 w-12 shrink-0 rounded-full transition-colors',
                      enabled ? 'bg-mixer-green/80' : 'bg-white/15',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                        enabled ? 'left-5' : 'left-0.5',
                      )}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {services.length === 0 && (
          <p className="mt-3 flex items-center gap-2 text-xs text-mixer-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            No service rows yet — apply the platform_product_services migration, then refresh.
          </p>
        )}
      </AdminSection>

      <ConfirmServiceToggleModal
        open={Boolean(pending && pendingProduct)}
        productName={pendingProduct?.name ?? ''}
        enabling={pending?.enabling ?? false}
        busy={busy}
        onConfirm={() => { void confirmToggle(); }}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
      />
    </div>
  );
}
