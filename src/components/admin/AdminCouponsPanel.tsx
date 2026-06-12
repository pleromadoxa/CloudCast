import { useState } from 'react';
import { Loader2, Percent, Sparkles, Ticket, TrendingUp } from 'lucide-react';
import { AdminSection, StatCard, StatCardGrid } from './AdminShared';
import { adminCreateCoupon, adminDeactivateCoupon } from '../../lib/adminService';
import type { CouponKind, CouponRow } from '../../types/admin';
import type { PlanTier } from '../../types/plans';
import { PLAN_LABELS } from '../../types/plans';
import { cn } from '../../lib/utils';

export function AdminCouponsPanel({
  coupons,
  onRefresh,
}: {
  coupons: CouponRow[];
  onRefresh: () => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<CouponKind>('plan_upgrade');
  const [planId, setPlanId] = useState<PlanTier>('pro');
  const [percentOff, setPercentOff] = useState('20');
  const [amountOffCents, setAmountOffCents] = useState('500');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!code.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await adminCreateCoupon({
        code: code.trim(),
        kind,
        planId: kind === 'plan_upgrade' ? planId : null,
        percentOff: kind === 'percent_off' ? Number(percentOff) : null,
        amountOffCents: kind === 'fixed_off' ? Number(amountOffCents) : null,
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt || null,
        notes: notes.trim() || null,
      });
      setCode('');
      setNotes('');
      setMaxUses('');
      setExpiresAt('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create coupon.');
    } finally {
      setCreating(false);
    }
  };

  const activeCoupons = coupons.filter((c) => c.is_active).length;
  const totalRedemptions = coupons.reduce((sum, c) => sum + c.use_count, 0);
  const planUpgradeCoupons = coupons.filter((c) => c.kind === 'plan_upgrade').length;
  const discountCoupons = coupons.filter((c) => c.kind !== 'plan_upgrade').length;

  return (
    <div className="space-y-6">
      <StatCardGrid>
        <StatCard label="Active coupons" value={activeCoupons} icon={Ticket} tone="accent" />
        <StatCard label="Total redemptions" value={totalRedemptions} icon={TrendingUp} tone="success" />
        <StatCard label="Plan upgrades" value={planUpgradeCoupons} icon={Sparkles} />
        <StatCard label="Discount codes" value={discountCoupons} icon={Percent} tone="warning" />
      </StatCardGrid>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <AdminSection title="Create coupon" description="Codes are stored uppercase. Users redeem on the pricing page.">
        <div className="space-y-3 text-xs">
          <label className="block">
            <span className="text-mixer-muted">Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="LAUNCH20"
              className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 font-mono text-sm uppercase outline-none focus:border-mixer-red/40"
            />
          </label>
          <label className="block">
            <span className="text-mixer-muted">Type</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as CouponKind)}
              className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm"
            >
              <option value="plan_upgrade">Plan upgrade (instant)</option>
              <option value="percent_off">Percent off (saved for checkout)</option>
              <option value="fixed_off">Fixed amount off (saved for checkout)</option>
            </select>
          </label>
          {kind === 'plan_upgrade' && (
            <label className="block">
              <span className="text-mixer-muted">Upgrade to plan</span>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value as PlanTier)}
                className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm"
              >
                {(['pro', 'pro_master'] as PlanTier[]).map((p) => (
                  <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                ))}
              </select>
            </label>
          )}
          {kind === 'percent_off' && (
            <label className="block">
              <span className="text-mixer-muted">Percent off</span>
              <input
                type="number"
                min={1}
                max={100}
                value={percentOff}
                onChange={(e) => setPercentOff(e.target.value)}
                className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm"
              />
            </label>
          )}
          {kind === 'fixed_off' && (
            <label className="block">
              <span className="text-mixer-muted">Amount off (cents)</span>
              <input
                type="number"
                min={1}
                value={amountOffCents}
                onChange={(e) => setAmountOffCents(e.target.value)}
                className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm"
              />
            </label>
          )}
          <label className="block">
            <span className="text-mixer-muted">Max uses (blank = unlimited)</span>
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm"
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
          <label className="block">
            <span className="text-mixer-muted">Internal notes</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded border border-white/10 bg-black px-3 py-2 text-sm"
            />
          </label>
          {error && <p className="text-mixer-red">{error}</p>}
          <button
            type="button"
            disabled={creating || !code.trim()}
            onClick={() => { void handleCreate(); }}
            className="w-full rounded bg-mixer-red py-2.5 text-[10px] font-bold tracking-wider text-white disabled:opacity-50"
          >
            {creating ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'CREATE COUPON'}
          </button>
        </div>
      </AdminSection>

      <AdminSection title="Coupons" description={`${coupons.length} coupons`}>
        <div className="space-y-2">
          {coupons.map((c) => (
            <div key={c.id} className="rounded border border-white/10 p-3 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-sm font-bold">{c.code}</p>
                  <p className="text-mixer-muted">
                    {c.kind === 'plan_upgrade' && `Upgrade to ${c.plan_name || c.plan_id}`}
                    {c.kind === 'percent_off' && `${c.percent_off}% off`}
                    {c.kind === 'fixed_off' && `$${((c.amount_off_cents ?? 0) / 100).toFixed(2)} off`}
                  </p>
                  <p className="text-[10px] text-mixer-muted">
                    Uses: {c.use_count}{c.max_uses != null ? ` / ${c.max_uses}` : ''}
                    {c.expires_at && ` · Expires ${new Date(c.expires_at).toLocaleString()}`}
                  </p>
                  {c.notes && <p className="text-[10px] text-mixer-muted">{c.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                      c.is_active ? 'bg-mixer-green/20 text-mixer-green' : 'bg-white/10 text-mixer-muted',
                    )}
                  >
                    {c.is_active ? 'active' : 'inactive'}
                  </span>
                  {c.is_active && (
                    <button
                      type="button"
                      onClick={() => { void adminDeactivateCoupon(c.id).then(onRefresh); }}
                      className="text-[10px] text-mixer-red underline"
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {coupons.length === 0 && <p className="text-sm text-mixer-muted">No coupons created yet.</p>}
        </div>
      </AdminSection>
    </div>
    </div>
  );
}
