import { AdminPagination, AdminSection, StatCard, StatCardGrid } from './AdminShared';
import { AlertCircle, CheckCircle2, Clock, Mail } from 'lucide-react';
import type { EmailQueueRow } from '../../types/admin';
import { cn } from '../../lib/utils';

export function AdminEmailQueuePanel({
  items,
  total,
  page,
  pageSize,
  onPageChange,
}: {
  items: EmailQueueRow[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const sent = items.filter((e) => e.status === 'sent').length;
  const pending = items.filter((e) => e.status === 'pending').length;
  const failed = items.filter((e) => e.status === 'failed').length;

  return (
    <div className="space-y-4">
      <StatCardGrid cols={4}>
        <StatCard label="Queued total" value={total} icon={Mail} />
        <StatCard label="Sent" value={sent} icon={CheckCircle2} tone="success" hint="This page" />
        <StatCard label="Pending" value={pending} icon={Clock} tone="warning" hint="This page" />
        <StatCard label="Failed" value={failed} icon={AlertCircle} tone="danger" hint="This page" />
      </StatCardGrid>

    <AdminSection title="Email queue" description={`${total} transactional emails`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-[10px] text-mixer-muted">
              <th className="px-2 py-2">TO</th>
              <th className="px-2 py-2">TEMPLATE</th>
              <th className="px-2 py-2">STATUS</th>
              <th className="px-2 py-2">CREATED</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b border-white/5">
                <td className="px-2 py-3">{e.email_to}</td>
                <td className="px-2 py-3 font-mono text-[10px]">{e.template}</td>
                <td className="px-2 py-3">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                      e.status === 'sent' && 'bg-mixer-green/20 text-mixer-green',
                      e.status === 'failed' && 'bg-mixer-red/20 text-mixer-red',
                      e.status === 'pending' && 'bg-white/10 text-mixer-muted',
                    )}
                  >
                    {e.status}
                  </span>
                  {e.last_error && <p className="mt-1 text-[10px] text-mixer-red">{e.last_error}</p>}
                </td>
                <td className="px-2 py-3 text-mixer-muted">{new Date(e.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && <p className="mt-4 text-sm text-mixer-muted">No emails queued yet.</p>}
      <AdminPagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
    </AdminSection>
    </div>
  );
}
