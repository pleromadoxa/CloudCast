import { useState } from 'react';
import { CalendarClock, CheckCircle2, Gift, Loader2, Undo2 } from 'lucide-react';
import { AdminPagination, AdminSection, StatCard, StatCardGrid } from './AdminShared';
import { adminIssuePlan, adminRevokePlanGrant } from '../../lib/adminService';
import type { PlanGrantRow } from '../../types/admin';
import type { PlanTier } from '../../types/plans';
import { PLAN_LABELS } from '../../types/plans';
import { cn } from '../../lib/utils';

const PAGE_SIZE = 50;

export function AdminPlanIssuingPanel({
  grants,
  grantsTotal,
  grantPage,
  onGrantPageChange,
  onRefresh,
}: {
  grants: PlanGrantRow[];
  grantsTotal: number;
  grantPage: number;
  onGrantPageChange: (page: number) => void;
  onRefresh: () => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [planId, setPlanId] = useState<PlanTier>('pro');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleIssue = async () => {
    if (!email.trim()) return;
    setIssuing(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await adminIssuePlan({
        email: email.trim(),
        planId,
        reason: reason.trim() || undefined,
        expiresAt: expiresAt || null,
      });
      setSuccess(`Issued ${PLAN_LABELS[planId]} to ${String(result.email ?? email)}`);
      setEmail('');
      setReason('');
      setExpiresAt('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue plan.');
    } finally {
      setIssuing(false);
    }
  };

  const handleRevoke = async (grantId: string) => {
    setError(null);
    try {
      await adminRevokePlanGrant(grantId);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke grant.');
    }
  };

  const activeGrants = grants.filter(
    (g) => !g.revoked_at && (!g.expires_at || new Date(g.expires_at) > new Date()),
  ).length;
  const revokedGrants = grants.filter((g) => g.revoked_at).length;
  const expiringGrants = grants.filter(
    (g) => !g.revoked_at && g.expires_at && new Date(g.expires_at) > new Date(),
  ).length;

  return (
    <div className="space-y-6">
      <StatCardGrid>
        <StatCard label="Total grants" value={grantsTotal} icon={Gift} tone="accent" />
        <StatCard label="Active" value={activeGrants} icon={CheckCircle2} tone="success" hint="On this page" />
        <StatCard label="With expiry" value={expiringGrants} icon={CalendarClock} tone="warning" />
        <StatCard label="Revoked" value={revokedGrants} icon={Undo2} hint="On this page" />
      </StatCardGrid>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <AdminSection title="Issue plan manually" description="Assign a plan by user email with optional expiry.">
        <div className="space-y-3 text-xs">
          <label className="block">
            <span className="text-mixer-muted">User email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-mixer-red/40"
            />
          </label>
          <label className="block">
            <span className="text-mixer-muted">Plan</span>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value as PlanTier)}
              className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm"
            >
              {(['free', 'pro', 'pro_master'] as PlanTier[]).map((p) => (
                <option key={p} value={p}>{PLAN_LABELS[p]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-mixer-muted">Reason (optional)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Partner account, support credit…"
              className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm outline-none focus:border-mixer-red/40"
            />
          </label>
          <label className="block">
            <span className="text-mixer-muted">Expires at (optional)</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm"
            />
          </label>
          {error && <p className="text-mixer-red">{error}</p>}
          {success && <p className="text-mixer-green">{success}</p>}
          <button
            type="button"
            disabled={issuing || !email.trim()}
            onClick={() => { void handleIssue(); }}
            className="w-full rounded bg-mixer-red py-2.5 text-[10px] font-bold tracking-wider text-white disabled:opacity-50"
          >
            {issuing ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'ISSUE PLAN'}
          </button>
        </div>
      </AdminSection>

      <AdminSection title="Plan grant history" description={`${grantsTotal} grants issued`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[10px] text-mixer-muted">
                <th className="px-2 py-2">USER</th>
                <th className="px-2 py-2">PLAN</th>
                <th className="px-2 py-2">EXPIRES</th>
                <th className="px-2 py-2">STATUS</th>
                <th className="px-2 py-2">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => {
                const active = !g.revoked_at && (!g.expires_at || new Date(g.expires_at) > new Date());
                return (
                  <tr key={g.id} className="border-b border-white/5">
                    <td className="px-2 py-3">
                      <p className="font-medium">{g.user_name || '—'}</p>
                      <p className="text-[10px] text-mixer-muted">{g.user_email}</p>
                      {g.reason && <p className="text-[10px] text-mixer-muted">{g.reason}</p>}
                    </td>
                    <td className="px-2 py-3">
                      {g.plan_name || g.plan_id}
                      <p className="text-[10px] text-mixer-muted">from {g.previous_plan_id}</p>
                    </td>
                    <td className="px-2 py-3 text-mixer-muted">
                      {g.expires_at ? new Date(g.expires_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                          active ? 'bg-mixer-green/20 text-mixer-green' : 'bg-white/10 text-mixer-muted',
                        )}
                      >
                        {g.revoked_at ? 'revoked' : active ? 'active' : 'expired'}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      {active && (
                        <button
                          type="button"
                          onClick={() => { void handleRevoke(g.id); }}
                          className="text-[10px] text-mixer-red underline"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {grants.length === 0 && <p className="mt-4 text-sm text-mixer-muted">No plan grants yet.</p>}
        <AdminPagination
          page={grantPage}
          pageSize={PAGE_SIZE}
          total={grantsTotal}
          onPageChange={onGrantPageChange}
        />
      </AdminSection>
    </div>
    </div>
  );
}
