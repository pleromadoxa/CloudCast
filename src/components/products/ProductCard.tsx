import { Link } from 'react-router-dom';
import { ArrowRight, Clapperboard, LayoutGrid, Lock, Music, SlidersHorizontal, Video } from 'lucide-react';
import type { CloudCastProduct } from '../../types/products';
import { cn } from '../../lib/utils';
import { canAccessProduct, resolveProductPlan } from '../../lib/productEntitlements';
import { useAuth } from '../../context/AuthContext';
import { PLAN_LABELS } from '../../types/plans';

const ICONS = {
  video_mixer: Video,
  audio_mixer: SlidersHorizontal,
  symphony_studio: Music,
  instant_replay: Clapperboard,
} as const;

function accentStyles(accent: CloudCastProduct['accent']) {
  if (accent === 'blue') {
    return {
      border: 'border-sky-500/40',
      glow: 'shadow-[0_0_40px_#0ea5e920]',
      btn: 'bg-sky-600 text-white hover:bg-sky-500',
      icon: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
    };
  }
  if (accent === 'purple') {
    return {
      border: 'border-violet-500/40',
      glow: 'shadow-[0_0_40px_#8b5cf620]',
      btn: 'bg-violet-600 text-white hover:bg-violet-500',
      icon: 'border-violet-500/30 bg-violet-500/10 text-violet-400',
    };
  }
  if (accent === 'emerald') {
    return {
      border: 'border-emerald-500/40',
      glow: 'shadow-[0_0_40px_#10b98120]',
      btn: 'bg-emerald-600 text-white hover:bg-emerald-500',
      icon: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    };
  }
  return {
    border: 'border-mixer-red/40',
    glow: 'shadow-[0_0_40px_#e11d4820]',
    btn: 'bg-mixer-red text-white hover:bg-mixer-red-dim',
    icon: 'border-mixer-red/30 bg-mixer-red/10 text-mixer-red',
  };
}

interface ProductCardProps {
  product: CloudCastProduct;
  compact?: boolean;
}

export function ProductCard({ product, compact = false }: ProductCardProps) {
  const { profile, user } = useAuth();
  const Icon = ICONS[product.id];
  const hasAccess = user ? canAccessProduct(profile, product.id) : true;
  const plan = user ? resolveProductPlan(profile, product.id) : null;
  const accent = accentStyles(product.accent);
  const pricingPath = product.id === 'instant_replay' ? '/pricing?product=video_mixer' : product.pricingPath;
  const pricingLabel = product.id === 'instant_replay' ? 'VIDEO PLANS' : 'PRICING';

  return (
    <article
      className={cn(
        'flex flex-col rounded-xl border bg-[#0a0a0a] p-6 transition-colors',
        accent.border,
        !compact && accent.glow,
      )}
    >
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
      </div>
    </article>
  );
}

export function UniversalPlanCard() {
  const { profile } = useAuth();
  const isUniversal = profile?.plan_id === 'universal' || profile?.entitlements?.universal;

  return (
    <article className="relative flex flex-col rounded-xl border border-amber-500/35 bg-gradient-to-b from-amber-500/10 to-[#0a0a0a] p-8">
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-0.5 text-[10px] font-bold tracking-wider text-black">
        ALL PRODUCTS
      </span>
      <div className="flex items-center gap-3">
        <LayoutGrid className="h-6 w-6 text-amber-400" />
        <h3 className="text-xl font-bold">CloudCast Universal</h3>
      </div>
      <p className="mt-2 text-sm text-mixer-muted">
        One subscription for every CloudCast product — Video Mixer, Audio Mixer, Symphony, and Replay with Pro Master
        features on all four.
      </p>
      <p className="mt-4 text-3xl font-bold">$119<span className="text-base font-normal text-mixer-muted">/mo</span></p>
      <Link
        to="/pricing?product=universal"
        className={cn(
          'mt-6 inline-flex items-center justify-center rounded py-3 text-xs font-bold tracking-wider',
          isUniversal
            ? 'border border-amber-500/40 text-amber-300'
            : 'bg-amber-500 text-black hover:bg-amber-400',
        )}
      >
        {isUniversal ? 'CURRENT UNIVERSAL PLAN' : 'VIEW UNIVERSAL PLAN'}
      </Link>
    </article>
  );
}
