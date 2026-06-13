import { Link } from 'react-router-dom';
import { ArrowRight, Check, Clapperboard, Gem, LayoutGrid, Lock, MonitorPlay, Music, SlidersHorizontal, Video } from 'lucide-react';
import type { CloudCastProduct } from '../../types/products';
import { productLandingPath } from '../../config/productLanding';
import { cn } from '../../lib/utils';
import { canAccessProduct, isUniversalPlan, resolveProductPlan } from '../../lib/productEntitlements';
import { UNIVERSAL_TIERS } from '../../config/products';
import { useAuth } from '../../context/AuthContext';
import { formatPrice, isUniversalPlanTier, PLAN_LABELS } from '../../types/plans';
import { productAccentTheme } from './productAccent';
import { ProductScene3D } from './ProductScene3D';

const ICONS = {
  video_mixer: Video,
  audio_mixer: SlidersHorizontal,
  symphony_studio: Music,
  instant_replay: Clapperboard,
  regal_display: MonitorPlay,
  regal_prism: Gem,
} as const;

interface ProductCardProps {
  product: CloudCastProduct;
  compact?: boolean;
  show3D?: boolean;
}

export function ProductCard({ product, compact = false, show3D = false }: ProductCardProps) {
  const { profile, user } = useAuth();
  const Icon = ICONS[product.id];
  const hasAccess = user ? canAccessProduct(profile, product.id) : true;
  const plan = user ? resolveProductPlan(profile, product.id) : null;
  const accent = productAccentTheme(product.accent);
  const pricingPath =
    product.id === 'instant_replay' || product.id === 'regal_display'
      ? '/pricing?product=video_mixer'
      : product.pricingPath;
  const pricingLabel = product.id === 'instant_replay' ? 'VIDEO PLANS' : 'PRICING';

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border bg-[#0a0a0a] transition-all duration-300',
        accent.border,
        !compact && accent.glow,
        show3D ? 'hover:-translate-y-1 hover:shadow-2xl' : 'p-6',
      )}
    >
      {show3D && (
        <ProductScene3D
          productId={product.id}
          accent={product.accent}
          className="relative h-44 w-full shrink-0 border-b border-white/5 bg-black/50"
        />
      )}
      <div className={cn('flex flex-1 flex-col', show3D ? 'p-6' : undefined)}>
        <div className="flex items-start justify-between gap-3">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg border', accent.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        {user && plan && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-mixer-muted">
            {product.id === 'instant_replay' ? `${PLAN_LABELS[plan]} · Video` : PLAN_LABELS[plan]}
          </span>
        )}
      </div>

      <h3 className="mt-4 text-lg font-bold tracking-tight">{product.name}</h3>
      <p className="mt-1 text-xs font-medium uppercase tracking-wider text-mixer-muted">
        {product.tagline}
      </p>
      {!compact && <p className="mt-3 flex-1 text-sm leading-relaxed text-mixer-muted">{product.description}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        {user ? (
          hasAccess ? (
            <Link
              to={product.dashboardPath}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-2 rounded py-2.5 text-xs font-bold tracking-wider',
                accent.btn,
              )}
            >
              OPEN DASHBOARD <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link
              to={product.pricingPath}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded border border-white/20 py-2.5 text-xs font-bold tracking-wider hover:border-white/40"
            >
              <Lock className="h-3.5 w-3.5" /> UPGRADE
            </Link>
          )
        ) : (
          <Link
            to="/login"
            state={{ from: product.dashboardPath }}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-2 rounded py-2.5 text-xs font-bold tracking-wider',
              accent.btn,
            )}
          >
            GET STARTED
          </Link>
        )}
        <Link
          to={pricingPath}
          className="rounded border border-white/15 px-4 py-2.5 text-xs font-bold tracking-wider text-mixer-muted hover:border-white/30 hover:text-white"
        >
          {pricingLabel}
        </Link>
        {!compact && (
          <Link
            to={productLandingPath(product.id)}
            className="rounded border border-white/15 px-4 py-2.5 text-xs font-bold tracking-wider text-mixer-muted hover:border-white/30 hover:text-white"
          >
            LEARN MORE
          </Link>
        )}
        </div>
      </div>
    </article>
  );
}

export function UniversalPlanCard({ hideHeader = false }: { hideHeader?: boolean }) {
  const { profile } = useAuth();
  const isUniversal = profile ? isUniversalPlan(profile.plan_id) || profile.entitlements?.universal : false;
  const currentUniversalTier = isUniversalPlanTier(profile?.plan_id)
    ? profile.plan_id
    : profile?.entitlements?.universal_tier;

  return (
    <section>
      {!hideHeader && (
        <div className="text-center">
          <p className="text-xs font-bold tracking-[0.25em] text-amber-400/90">ONE SUBSCRIPTION · SIX PRODUCTS</p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <LayoutGrid className="h-6 w-6 text-amber-400" />
            <h3 className="text-xl font-bold sm:text-2xl">CloudCast Universal</h3>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-mixer-muted">
            Video Mixer, Audio Mixer, Symphony, Replay, Regal Display, and Regal Prism — pick the bundle that
            fits your budget. Every tier includes the audio ↔ video bridge.
          </p>
        </div>
      )}

      <div className={cn('grid gap-6 lg:grid-cols-3', !hideHeader && 'mt-10')}>
        {UNIVERSAL_TIERS.map((tier) => {
          const isCurrent = currentUniversalTier === tier.id;
          const highlighted = tier.highlight === true;
          const savings = tier.compareAtCents - tier.priceCents;

          return (
            <article
              key={tier.id}
              className={cn(
                'relative flex flex-col rounded-xl border p-8 transition-shadow',
                highlighted
                  ? 'border-amber-500/50 bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-[#0a0a0a] shadow-[0_0_48px_#f59e0b18] lg:scale-[1.02]'
                  : tier.id === 'universal'
                    ? 'border-amber-400/30 bg-gradient-to-b from-amber-400/10 to-[#0a0a0a]'
                    : 'border-white/10 bg-[#0a0a0a]',
              )}
            >
              {tier.badge && (
                <span
                  className={cn(
                    'absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[10px] font-bold tracking-wider',
                    highlighted ? 'bg-amber-500 text-black' : 'border border-amber-500/40 bg-[#0a0a0a] text-amber-300',
                  )}
                >
                  {tier.badge}
                </span>
              )}

              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200/70">{tier.shortName}</p>
              <h4 className="mt-1 text-xl font-bold">{tier.name}</h4>
              <p className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-mixer-muted">{tier.tagline}</p>

              <div className="mt-6 flex items-end gap-2">
                <p className="text-4xl font-bold">{formatPrice(tier.priceCents)}</p>
                <p className="pb-1 text-sm text-mixer-muted line-through">
                  ${(tier.compareAtCents / 100).toFixed(0)}
                </p>
              </div>
              <p className="mt-1 text-[11px] font-medium text-emerald-400/90">
                Save ${(savings / 100).toFixed(0)}/mo vs separate subscriptions
              </p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-mixer-muted">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                to="/pricing?product=universal"
                className={cn(
                  'mt-8 inline-flex w-full items-center justify-center rounded py-3 text-xs font-bold tracking-wider transition-colors',
                  isCurrent
                    ? 'border border-amber-500/40 text-amber-300'
                    : highlighted
                      ? 'bg-amber-500 text-black hover:bg-amber-400'
                      : tier.id === 'universal'
                        ? 'border border-amber-400/40 text-amber-200 hover:border-amber-400/60 hover:bg-amber-500/10'
                        : 'border border-white/20 hover:border-white/40',
                )}
              >
                {isCurrent ? 'CURRENT PLAN' : isUniversal ? `SWITCH TO ${tier.shortName.toUpperCase()}` : `VIEW ${tier.shortName.toUpperCase()}`}
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
