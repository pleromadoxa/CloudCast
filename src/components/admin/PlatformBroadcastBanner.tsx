import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { fetchActiveBroadcasts, type ActiveBroadcast } from '../../lib/broadcastService';
import { cn } from '../../lib/utils';

export function PlatformBroadcastBanner() {
  const [broadcasts, setBroadcasts] = useState<ActiveBroadcast[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    void fetchActiveBroadcasts()
      .then(setBroadcasts)
      .catch(() => setBroadcasts([]));
  }, []);

  const visible = broadcasts.filter((b) => !dismissed.has(b.id));
  if (visible.length === 0) return null;

  const b = visible[0];

  return (
    <div
      className={cn(
        'border-b px-4 py-2 text-xs',
        b.severity === 'warning' && 'border-mixer-yellow/30 bg-mixer-yellow/10 text-mixer-yellow',
        b.severity === 'promo' && 'border-mixer-red/30 bg-mixer-red/10 text-white',
        b.severity === 'info' && 'border-white/10 bg-white/5 text-mixer-text',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">{b.title}</p>
          <p className="text-[11px] opacity-90">{b.message}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {b.link_url && (
            b.link_url.startsWith('/') ? (
              <Link
                to={b.link_url}
                className="rounded border border-current/30 px-2 py-1 text-[10px] font-bold tracking-wider"
              >
                {b.link_label || 'Learn more'}
              </Link>
            ) : (
              <a
                href={b.link_url}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-current/30 px-2 py-1 text-[10px] font-bold tracking-wider"
              >
                {b.link_label || 'Learn more'}
              </a>
            )
          )}
          <button
            type="button"
            onClick={() => setDismissed((prev) => new Set(prev).add(b.id))}
            className="rounded p-1 opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
