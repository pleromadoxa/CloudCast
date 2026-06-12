import { useState } from 'react';
import { Loader2, Megaphone, Radio, Rss, Tv } from 'lucide-react';
import { AdminPagination, AdminSection, StatCard, StatCardGrid } from './AdminShared';
import { adminCreateBroadcast, adminDeactivateBroadcast } from '../../lib/adminService';
import type { AdminStreamDestinationRow, BroadcastSeverity, BroadcastTarget, PlatformBroadcastRow } from '../../types/admin';
import { STREAM_PLATFORM_LABELS } from '../../types/streaming';
import { cn } from '../../lib/utils';

const PAGE_SIZE = 50;

export function AdminBroadcastingPanel({
  broadcasts,
  destinations,
  destinationsTotal,
  destinationPage,
  destinationSearch,
  onDestinationPageChange,
  onDestinationSearchChange,
  onDestinationSearch,
  onRefresh,
}: {
  broadcasts: PlatformBroadcastRow[];
  destinations: AdminStreamDestinationRow[];
  destinationsTotal: number;
  destinationPage: number;
  destinationSearch: string;
  onDestinationPageChange: (page: number) => void;
  onDestinationSearchChange: (value: string) => void;
  onDestinationSearch: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<BroadcastSeverity>('info');
  const [targetPlan, setTargetPlan] = useState<BroadcastTarget>('all');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await adminCreateBroadcast({
        title: title.trim(),
        message: message.trim(),
        severity,
        targetPlan,
        linkUrl: linkUrl.trim() || null,
        linkLabel: linkLabel.trim() || null,
        endsAt: endsAt || null,
      });
      setTitle('');
      setMessage('');
      setLinkUrl('');
      setLinkLabel('');
      setEndsAt('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create broadcast.');
    } finally {
      setCreating(false);
    }
  };

  const activeBroadcasts = broadcasts.filter((b) => b.is_active).length;
  const enabledDestinations = destinations.filter((d) => d.is_enabled).length;
  const youtubeDestinations = destinations.filter((d) => d.platform === 'youtube').length;

  return (
    <div className="space-y-6">
      <StatCardGrid>
        <StatCard label="Live announcements" value={activeBroadcasts} icon={Megaphone} tone="accent" />
        <StatCard label="RTMP destinations" value={destinationsTotal} icon={Rss} />
        <StatCard label="Enabled streams" value={enabledDestinations} icon={Tv} tone="success" hint="Current page" />
        <StatCard label="YouTube outputs" value={youtubeDestinations} icon={Radio} tone="warning" hint="Current page" />
      </StatCardGrid>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <AdminSection title="Platform broadcast" description="In-app announcements shown to users in the header.">
          <div className="space-y-3 text-xs">
            <label className="block">
              <span className="text-mixer-muted">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-mixer-red/40"
              />
            </label>
            <label className="block">
              <span className="text-mixer-muted">Message</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-mixer-red/40"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-mixer-muted">Severity</span>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as BroadcastSeverity)}
                  className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="promo">Promo</option>
                </select>
              </label>
              <label className="block">
                <span className="text-mixer-muted">Target audience</span>
                <select
                  value={targetPlan}
                  onChange={(e) => setTargetPlan(e.target.value as BroadcastTarget)}
                  className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm"
                >
                  <option value="all">All users</option>
                  <option value="free">Free plan</option>
                  <option value="pro">Pro plan</option>
                  <option value="pro_master">Pro Master plan</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-mixer-muted">Link URL (optional)</span>
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-mixer-muted">Link label</span>
                <input
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder="Learn more"
                  className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-mixer-muted">Ends at (optional)</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm"
              />
            </label>
            {error && <p className="text-mixer-red">{error}</p>}
            <button
              type="button"
              disabled={creating || !title.trim() || !message.trim()}
              onClick={() => { void handleCreate(); }}
              className="w-full rounded bg-mixer-red py-2.5 text-[10px] font-bold tracking-wider text-white disabled:opacity-50"
            >
              {creating ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'PUBLISH BROADCAST'}
            </button>
          </div>
        </AdminSection>

        <AdminSection title="Active & past broadcasts" description={`${broadcasts.length} broadcasts`}>
          <div className="space-y-2">
            {broadcasts.map((b) => (
              <div key={b.id} className="rounded border border-white/10 p-3 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{b.title}</p>
                    <p className="text-mixer-muted">{b.message}</p>
                    <p className="mt-1 text-[10px] text-mixer-muted">
                      {b.severity} · {b.target_plan} · {new Date(b.starts_at).toLocaleString()}
                      {b.ends_at && ` → ${new Date(b.ends_at).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                        b.is_active ? 'bg-mixer-green/20 text-mixer-green' : 'bg-white/10 text-mixer-muted',
                      )}
                    >
                      {b.is_active ? 'active' : 'inactive'}
                    </span>
                    {b.is_active && (
                      <button
                        type="button"
                        onClick={() => { void adminDeactivateBroadcast(b.id).then(onRefresh); }}
                        className="text-[10px] text-mixer-red underline"
                      >
                        End
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {broadcasts.length === 0 && <p className="text-sm text-mixer-muted">No broadcasts yet.</p>}
          </div>
        </AdminSection>
      </div>

      <AdminSection title="User stream destinations" description={`${destinationsTotal} RTMP configs platform-wide`}>
        <div className="mb-4 flex gap-2">
          <input
            type="search"
            value={destinationSearch}
            onChange={(e) => onDestinationSearchChange(e.target.value)}
            placeholder="Search user, platform, destination name…"
            className="flex-1 rounded border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-mixer-red/40"
          />
          <button type="button" onClick={onDestinationSearch} className="rounded border border-white/10 px-3 text-xs font-bold">
            SEARCH
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[10px] text-mixer-muted">
                <th className="px-2 py-2">USER</th>
                <th className="px-2 py-2">NAME</th>
                <th className="px-2 py-2">PLATFORM</th>
                <th className="px-2 py-2">URL</th>
                <th className="px-2 py-2">KEY</th>
                <th className="px-2 py-2">ENABLED</th>
              </tr>
            </thead>
            <tbody>
              {destinations.map((d) => (
                <tr key={d.id} className="border-b border-white/5">
                  <td className="px-2 py-3">
                    <p>{d.user_name || '—'}</p>
                    <p className="text-[10px] text-mixer-muted">{d.user_email}</p>
                  </td>
                  <td className="px-2 py-3 font-medium">{d.name}</td>
                  <td className="px-2 py-3">
                    {STREAM_PLATFORM_LABELS[d.platform as keyof typeof STREAM_PLATFORM_LABELS] ?? d.platform}
                  </td>
                  <td className="max-w-[200px] truncate px-2 py-3 text-mixer-muted">{d.stream_url}</td>
                  <td className="px-2 py-3 font-mono text-mixer-muted">{d.stream_key_masked}</td>
                  <td className="px-2 py-3">
                    <span className={cn('text-[10px] font-bold', d.is_enabled ? 'text-mixer-green' : 'text-mixer-muted')}>
                      {d.is_enabled ? 'YES' : 'NO'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {destinations.length === 0 && <p className="mt-4 text-sm text-mixer-muted">No stream destinations found.</p>}
        <AdminPagination
          page={destinationPage}
          pageSize={PAGE_SIZE}
          total={destinationsTotal}
          onPageChange={onDestinationPageChange}
        />
      </AdminSection>
    </div>
  );
}
