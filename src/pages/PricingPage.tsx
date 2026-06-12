import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { redeemCoupon } from '../lib/couponService';
import { useAuth } from '../context/AuthContext';
import type { PlanTier, SubscriptionPlan } from '../types/plans';
import { formatPrice } from '../types/plans';
import {
  connectionModeLabel,
  displayFeaturesForPlan,
  normalizeConnectionMode,
  streamQualityForPlan,
} from '../lib/branding';
import { cn } from '../lib/utils';

const HIGHLIGHT: PlanTier = 'pro';

export function PricingPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<PlanTier | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const { user, profile, updatePlan, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getSupabase()
      .rpc('list_subscription_plans')
      .then(({ data, error }) => {
        if (!error && Array.isArray(data)) {
          setPlans(
            (data as Record<string, unknown>[]).map((p) => ({
              id: p.id as PlanTier,
              name: String(p.name),
              max_mobile_devices: Number(p.max_mobile_devices),
              max_usb_devices: Number(p.max_usb_devices),
              max_total_channels: Number(p.max_total_channels),
              connection_mode: normalizeConnectionMode(p.connection_mode as string),
              price_monthly_cents: Number(p.price_monthly_cents),
              features: Array.isArray(p.features) ? (p.features as string[]) : [],
            })),
          );
        }
        setLoading(false);
      });
  }, []);

  const handleRedeemCoupon = async () => {
    if (!user) {
      navigate('/login', { state: { from: '/pricing' } });
      return;
    }
    if (!couponCode.trim()) return;
    setRedeeming(true);
    setCouponError(null);
    setCouponMessage(null);
    try {
      const result = await redeemCoupon(couponCode.trim());
      setCouponMessage(result.message);
      setCouponCode('');
      if (result.kind === 'plan_upgrade') {
        await refreshProfile();
      }
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : 'Could not redeem coupon.');
    } finally {
      setRedeeming(false);
    }
  };

  const handleSelect = async (planId: PlanTier) => {
    if (!user) {
      navigate('/login', { state: { from: '/pricing' } });
      return;
    }
    setUpgrading(planId);
    try {
      await updatePlan(planId);
      navigate('/dashboard');
    } catch {
      /* keep on page */
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <main className="px-6 py-20">
      <div className="mx-auto max-w-5xl text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple, transparent pricing</h1>
        <p className="mt-3 text-sm text-mixer-muted">
          Start free with Regal Mesh. Upgrade to Regal Cloud for HD and UHD streaming.
        </p>
        <div className="mx-auto mt-6 flex max-w-md flex-wrap items-center justify-center gap-2">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="Coupon code"
            className="min-w-[160px] flex-1 rounded border border-white/10 bg-black px-3 py-2 text-sm font-mono uppercase outline-none focus:border-mixer-red/40"
          />
          <button
            type="button"
            disabled={redeeming || !couponCode.trim()}
            onClick={() => { void handleRedeemCoupon(); }}
            className="rounded border border-white/20 px-4 py-2 text-xs font-bold tracking-wider hover:border-white/40 disabled:opacity-50"
          >
            {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : 'APPLY'}
          </button>
        </div>
        {couponMessage && <p className="mt-2 text-sm text-mixer-green">{couponMessage}</p>}
        {couponError && <p className="mt-2 text-sm text-mixer-red">{couponError}</p>}
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-mixer-red" />
        </div>
      ) : (
        <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = profile?.plan_id === plan.id;
            const highlighted = plan.id === HIGHLIGHT;

            return (
              <div
                key={plan.id}
                className={cn(
                  'relative flex flex-col rounded-xl border p-8',
                  highlighted ? 'border-mixer-red bg-mixer-panel shadow-[0_0_40px_#e11d4820]' : 'border-white/10 bg-[#0a0a0a]',
                )}
              >
                {highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-mixer-red px-3 py-0.5 text-[10px] font-bold tracking-wider text-white">
                    POPULAR
                  </span>
                )}

                <h2 className="text-lg font-bold tracking-wide">{plan.name}</h2>
                <p className="mt-2 text-3xl font-bold">
                  {formatPrice(plan.price_monthly_cents)}
                </p>
                <p className="mt-1 text-xs text-mixer-muted">
                  {plan.max_mobile_devices} mobile
                  {plan.max_usb_devices > 0 && ` + ${plan.max_usb_devices} USB`}
                  {' · '}
                  {connectionModeLabel(plan.connection_mode)}
                  {plan.id !== 'free' && ` · ${streamQualityForPlan(plan.id)}`}
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {displayFeaturesForPlan(plan.id, plan.features).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-mixer-muted">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mixer-green" />
                      {f}
                    </li>
                  ))}
                  <li className="flex items-start gap-2 text-xs text-mixer-muted">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mixer-green" />
                    Up to {plan.max_total_channels} total channels
                  </li>
                </ul>

                <button
                  type="button"
                  disabled={isCurrent || upgrading !== null}
                  onClick={() => handleSelect(plan.id)}
                  className={cn(
                    'mt-8 w-full rounded py-3 text-xs font-bold tracking-wider transition-colors disabled:opacity-50',
                    highlighted
                      ? 'bg-mixer-red text-white hover:bg-mixer-red-dim'
                      : 'border border-white/20 hover:border-white/40',
                  )}
                >
                  {upgrading === plan.id ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    'CURRENT PLAN'
                  ) : plan.price_monthly_cents === 0 ? (
                    'GET STARTED FREE'
                  ) : (
                    `CHOOSE ${plan.name.toUpperCase()}`
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mx-auto mt-10 max-w-xl text-center text-xs text-mixer-muted">
        Payment integration coming soon — selecting a plan updates your account immediately for testing.
        {' '}
        <Link to="/login" className="text-mixer-red underline">Sign in</Link> to manage your subscription.
      </p>
    </main>
  );
}
