import { Activity, HardDrive, Radio, Rss } from 'lucide-react';
import { InsightCard, StatCardGrid } from './AdminShared';
import type { AdminUserDetail } from '../../types/admin';
import { formatBytes } from '../../lib/formatBytes';

export function AdminUserDetailCards({ detail }: { detail: AdminUserDetail }) {
  const recordingBytes = detail.recordings.reduce((sum, r) => sum + r.size_bytes, 0);
  const enabledDestinations = detail.destinations.filter((d) => d.is_enabled).length;
  const activeSessions = detail.sessions.filter((s) => s.is_active).length;

  return (
    <StatCardGrid cols={2} className="mb-4">
      <InsightCard
        title="Sessions"
        value={detail.sessions.length}
        description={`${activeSessions} active`}
        icon={Radio}
        tone={activeSessions > 0 ? 'success' : 'default'}
      />
      <InsightCard
        title="Recordings"
        value={detail.recordings.length}
        description={formatBytes(recordingBytes)}
        icon={HardDrive}
      />
      <InsightCard
        title="Stream outputs"
        value={detail.destinations.length}
        description={`${enabledDestinations} enabled`}
        icon={Rss}
        tone={enabledDestinations > 0 ? 'accent' : 'default'}
      />
      <InsightCard
        title="Recent events"
        value={detail.recent_activity.length}
        description="Last 30 logged"
        icon={Activity}
      />
    </StatCardGrid>
  );
}
