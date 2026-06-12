import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, LayoutGrid, Loader2, Music, SlidersHorizontal, Video } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { redeemCoupon } from '../lib/couponService';
import { useAuth } from '../context/AuthContext';
import type { PlanTier, ProductPlanTier, SubscriptionPlan } from '../types/plans';
import { formatPrice, isProductPlanTier, PRODUCT_PLAN_LABELS } from '../types/plans';
import {
  connectionModeLabel,
  displayFeaturesForPlan,
  normalizeConnectionMode,
  streamQualityForPlan,
} from '../lib/branding';
import {
  CLOUDCAST_PRODUCTS,
  PRODUCT_TIER_PRICES,
  UNIVERSAL_PLAN_PRICE_CENTS,
  AUDIO_MIXER_CHANNELS,
  SYMPHONY_TRACKS,
  SYMPHONY_CLOUD_PROJECTS,
  REPLAY_BANKS,
  REPLAY_BUFFER_SECONDS,
} from '../config/products';
import type { CloudCastProductId } from '../types/products';
import { parseProductId } from '../config/products';
import { resolveProductPlan } from '../lib/productEntitlements';
import { cn } from '../lib/utils';

const HIGHLIGHT: ProductPlanTier = 'pro';

type PricingTab = CloudCastProductId | 'universal';
type PricingTabUi = Exclude<PricingTab, 'instant_replay'>;

const TAB_META: Record<PricingTabUi, { label: string; icon: typeof Video }> = {
  video_mixer: { label: 'Video Mixer', icon: Video },
  audio_mixer: { label: 'Audio Mixer', icon: SlidersHorizontal },
  symphony_studio: { label: 'Symphony', icon: Music },
  universal: { label: 'Universal', icon: LayoutGrid },
};

function videoFeaturesForPlan(planId: ProductPlanTier, fallback: string[]): string[] {
  return displayFeaturesForPlan(planId, fallback);
}

function audioFeaturesForPlan(planId: ProductPlanTier): string[] {
  const channels = AUDIO_MIXER_CHANNELS[planId];
  const base = [
    `${channels} channel faders`,
    'Monitor + PGM master bus',
    'Per-channel solo & mute',
    'Live input metering',
    'Access code pairing',
  ];
  if (planId === 'free') return base;
  if (planId === 'pro') return [...base, '8-channel console', 'Advanced routing', 'FX send banks'];
  return [...base, '16-channel console', 'Full Fat Channel controls', 'Priority support'];
}

function symphonyFeaturesForPlan(planId: ProductPlanTier): string[] {
  const tracks = SYMPHONY_TRACKS[planId];
  const projects = SYMPHONY_CLOUD_PROJECTS[planId];
  const base = [
    `${tracks} arrangement tracks`,
    'Loop browser & instrument library',
    'Piano roll & MIDI editor',
    'Web Audio synthesizers & strings',
    'Multi-track mixdown export',
  ];
  if (planId === 'free') return [...base, `${projects} Regal Cloud Archive projects`];
  if (planId === 'pro') return [...base, 'Full synth & string libraries', `${projects} cloud projects`, 'Automation lanes'];
  return [...base, '32-track studio', `${projects} Regal Cloud Archive projects`, 'Priority support'];
}


export function PricingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProduct = parseProductId(searchParams.get('product'));
  const initialTab: PricingTabUi =
    searchParams.get('product') === 'universal'
      ? 'universal'
      : initialProduct === 'instant_replay'
        ? 'video_mixer'
        : (initialProduct ?? 'video_mixer');
  const [tab, setTab] = useState<PricingTabUi>(initialTab);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const { user, profile, updateProductPlan, refreshProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fromUrl = parseProductId(searchParams.get('product'));
    if (searchParams.get('product') === 'universal') setTab('universal');
    else if (fromUrl === 'instant_replay') setTab('video_mixer');
    else if (fromUrl) setTab(fromUrl);
  }, [searchParams]);

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

  const productPlans = useMemo(() => {
    return (['free', 'pro', 'pro_master'] as ProductPlanTier[]).map((tier) => {
      const fromDb = plans.find((p) => p.id === tier);
      return {
        id: tier,
        name: PRODUCT_PLAN_LABELS[tier],
        price_monthly_cents: fromDb?.price_monthly_cents ?? PRODUCT_TIER_PRICES[tier],
        max_total_channels: fromDb?.max_total_channels,
        connection_mode: fromDb?.connection_mode ?? (tier === 'free' ? 'mesh' : 'regal'),
        features: fromDb?.features ?? [],
      };
    });
  }, [plans]);

  const selectTab = (next: PricingTabUi) => {
    setTab(next);
    setSearchParams({ product: next }, { replace: true });
  };

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
      if (result.kind === 'plan_upgrade') await refreshProfile();
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : 'Could not redeem coupon.');
    } finally {
      setRedeeming(false);
    }
  };

  const handleSelectProductPlan = async (planId: ProductPlanTier) => {
    if (!user) {
      navigate('/login', { state: { from: `/pricing?product=${tab}` } });
      return;
    }
    if (tab === 'universal') return;
    setUpgrading(planId);
    try {
      await updateProductPlan(tab, planId);
      navigate('/hub');
    } catch {
      /* stay */
    } finally {
      setUpgrading(null);
    }
  };

  const handleSelectUniversal = async () => {
    if (!user) {
      navigate('/login', { state: { from: '/pricing?product=universal' } });
      return;
    }
    setUpgrading('universal');
    try {
      await updateProductPlan('universal', 'universal');
      navigate('/hub');
    } catch {
      /* stay */
    } finally {
      setUpgrading(null);
    }
  };

  const currentProductPlan =
    tab !== 'universal' && profile ? resolveProductPlan(profile, tab) : null;
  const isUniversalCurrent = profile?.plan_id === 'universal' || profile?.entitlements?.universal;
  const productMeta = tab !== 'universal' ? CLOUDCAST_PRODUCTS.find((p) => p.id === tab)! : null;

  return (
    <main className="px-6 py-20">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-xs font-bold tracking-[0.3em] text-mixer-red">CLOUDCAST PRODUCTS</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Pricing by product</h1>
        <p className="mt-3 text-sm text-mixer-muted">
          Subscribe to Video Mixer (includes CloudCast Replay), Audio Mixer, Symphony, or unlock everything with CloudCast Universal.
        </p>

        <div className="mx-auto mt-8 flex flex-wrap justify-center gap-2">
          {(Object.keys(TAB_META) as PricingTabUi[]).map((id) => {
            const Icon = TAB_META[id].icon;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectTab(id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold tracking-wider transition-colors',
                  tab === id
                    ? id === 'universal'
                      ? 'border-amber-500 bg-amber-500/15 text-amber-200'
                      : 'border-mixer-red bg-mixer-red/15 text-white'
                    : 'border-white/10 text-mixer-muted hover:border-white/25 hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {TAB_META[id].label}
              </button>
            );
          })}
        </div>

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
      ) : tab === 'universal' ? (
        <div className="mx-auto mt-14 max-w-lg">
          <div className="rounded-xl border border-amber-500/35 bg-gradient-to-b from-amber-500/10 to-[#0a0a0a] p-8 text-center">
            <h2 className="text-2xl font-bold">CloudCast Universal</h2>
            <p className="mt-2 text-sm text-mixer-muted">
              Video Mixer + Audio Mixer + Symphony + Replay · Pro Master features on every product · one login, full suite.
            </p>
            <p className="mt-6 text-4xl font-bold">{formatPrice(UNIVERSAL_PLAN_PRICE_CENTS)}</p>
            <ul className="mt-6 space-y-2 text-left text-xs text-mixer-muted">
              {displayFeaturesForPlan('universal', []).map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={isUniversalCurrent || upgrading !== null}
              onClick={() => { void handleSelectUniversal(); }}
              className="mt-8 w-full rounded bg-amber-500 py-3 text-xs font-bold tracking-wider text-black hover:bg-amber-400 disabled:opacity-50"
            >
              {upgrading === 'universal' ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : isUniversalCurrent ? (
                'CURRENT PLAN'
              ) : (
                'CHOOSE UNIVERSAL'
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-mixer-muted">
            {productMeta?.name} — {productMeta?.tagline}
            {tab === 'video_mixer' && (
              <span className="mt-1 block text-emerald-400/90">
                CloudCast Replay included at every tier — {REPLAY_BANKS.free}–{REPLAY_BANKS.pro_master} banks, up to {REPLAY_BUFFER_SECONDS.pro_master}s buffer on Pro Master.
              </span>
            )}
          </p>
          <div className="mx-auto mt-10 grid max-w-5xl gap-6 lg:grid-cols-3">
            {productPlans.map((plan) => {
              const isCurrent = currentProductPlan === plan.id;
              const highlighted = plan.id === HIGHLIGHT;
              const features =
                tab === 'audio_mixer'
                  ? audioFeaturesForPlan(plan.id)
                  : tab === 'symphony_studio'
                    ? symphonyFeaturesForPlan(plan.id)
                    : tab === 'video_mixer'
                      ? videoFeaturesForPlan(plan.id, plan.features)
                      : displayFeaturesForPlan(plan.id, plan.features);

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
                  <p className="mt-2 text-3xl font-bold">{formatPrice(plan.price_monthly_cents)}</p>
                  {tab === 'video_mixer' && (
                    <p className="mt-1 text-xs text-mixer-muted">
                      {connectionModeLabel(plan.connection_mode)}
                      {plan.id !== 'free' && ` · ${streamQualityForPlan(plan.id)}`}
                      {' · '}
                      {REPLAY_BANKS[plan.id]} replay banks · {REPLAY_BUFFER_SECONDS[plan.id]}s buffer
                    </p>
                  )}
                  {tab === 'audio_mixer' && (
                    <p className="mt-1 text-xs text-mixer-muted">
                      {AUDIO_MIXER_CHANNELS[plan.id]} channel console
                    </p>
                  )}
                  {tab === 'symphony_studio' && (
                    <p className="mt-1 text-xs text-mixer-muted">
                      {SYMPHONY_TRACKS[plan.id]} tracks · {SYMPHONY_CLOUD_PROJECTS[plan.id]} cloud projects
                    </p>
                  )}

                  <ul className="mt-6 flex-1 space-y-3">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-mixer-muted">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mixer-green" />
                        {f}
                      </li>
                    ))}
                    {tab === 'video_mixer' && plan.max_total_channels && (
                      <li className="flex items-start gap-2 text-xs text-mixer-muted">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mixer-green" />
                        Up to {plan.max_total_channels} total channels
                      </li>
                    )}
                  </ul>

                  <button
                    type="button"
                    disabled={isCurrent || upgrading !== null}
                    onClick={() => {
                      if (isProductPlanTier(plan.id)) void handleSelectProductPlan(plan.id);
                    }}
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
        </>
      )}

      <p className="mx-auto mt-10 max-w-xl text-center text-xs text-mixer-muted">
        Payment integration coming soon — selecting a plan updates your account immediately for testing.{' '}
        <Link to="/products" className="text-mixer-red underline">Browse products</Link>
        {' · '}
        <Link to="/login" className="text-mixer-red underline">Sign in</Link>
      </p>
    </main>
  );
}
