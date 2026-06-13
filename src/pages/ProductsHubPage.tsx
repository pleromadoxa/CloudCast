import { Link } from 'react-router-dom';
import { LayoutGrid, LogOut, Settings, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CLOUDCAST_PRODUCTS } from '../config/products';
import { MobileAppsSection } from '../components/products/MobileAppsSection';
import { ProductCard, UniversalPlanCard } from '../components/products/ProductCard';
import { ProgramPresetSelector } from '../components/presets/ProgramPresetSelector';
import { listProductSubscriptions, isUniversalPlan, universalTierLabel } from '../lib/productEntitlements';
import { PLAN_LABELS } from '../types/plans';
import { useProgramPresets } from '../context/ProgramPresetContext';

export function ProductsHubPage() {
  const { profile, signOut } = useAuth();
  const { activePreset } = useProgramPresets();
  const subscriptions = listProductSubscriptions(profile);
  const isUniversal = profile ? isUniversalPlan(profile.plan_id) || profile.entitlements?.universal : false;
  const universalLabel = profile ? universalTierLabel(profile.plan_id) : 'Universal';

  return (
    <main className="min-h-[calc(100vh-8rem)] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-mixer-muted">WELCOME BACK</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {profile?.full_name?.trim() || profile?.email || 'Your CloudCast hub'}
            </h1>
            <p className="mt-2 text-sm text-mixer-muted">
              Open a product dashboard or manage subscriptions below.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 rounded border border-white/15 px-3 py-2 text-xs font-bold tracking-wider hover:border-white/30"
            >
              <Settings className="h-3.5 w-3.5" /> ACCOUNT
            </Link>
            <button
              type="button"
              onClick={() => { void signOut(); }}
              className="inline-flex items-center gap-1.5 rounded border border-white/15 px-3 py-2 text-xs font-bold tracking-wider hover:border-white/30"
            >
              <LogOut className="h-3.5 w-3.5" /> SIGN OUT
            </button>
          </div>
        </div>

        <section className="mt-8">
          <ProgramPresetSelector variant="embedded" />
        </section>

        {!activePreset && (
          <p className="mt-3 text-center text-xs text-amber-400/90">
            Select or create a program preset above before opening a product dashboard.
          </p>
        )}

        <section className="mt-8 rounded-xl border border-white/10 bg-mixer-panel p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-mixer-muted">
            <Sparkles className="h-4 w-4 text-mixer-red" />
            Your subscriptions
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {isUniversal ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 sm:col-span-3">
                <p className="text-sm font-bold text-amber-200">{universalLabel}</p>
                <p className="mt-1 text-xs text-mixer-muted">
                  All six products · audio ↔ video bridge included
                </p>
              </div>
            ) : (
              subscriptions.map((sub) => {
                const product = CLOUDCAST_PRODUCTS.find((p) => p.id === sub.product)!;
                return (
                  <div key={sub.product} className="rounded-lg border border-white/10 bg-black/30 p-4">
                    <p className="text-sm font-bold">{product.shortName} Mixer</p>
                    <p className="mt-1 text-xs text-mixer-muted">{PLAN_LABELS[sub.plan_id]}</p>
                    <Link
                      to={product.dashboardPath}
                      className="mt-3 inline-block text-[10px] font-bold uppercase tracking-wider text-mixer-red hover:underline"
                    >
                      Open dashboard →
                    </Link>
                  </div>
                );
              })
            )}
          </div>
          {!isUniversal && (
            <Link
              to="/pricing?product=universal"
              className="mt-4 inline-flex items-center gap-2 text-xs font-bold tracking-wider text-amber-400 hover:text-amber-300"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Upgrade to CloudCast Universal
            </Link>
          )}
        </section>

        <MobileAppsSection className="mt-8" />

        <h2 className="mt-10 text-lg font-bold tracking-tight">Broadcast products</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {CLOUDCAST_PRODUCTS.map((product) => (
            <ProductCard key={product.id} product={product} compact />
          ))}
        </div>

        {!isUniversal && (
          <div className="mt-8">
            <UniversalPlanCard />
          </div>
        )}
      </div>
    </main>
  );
}
