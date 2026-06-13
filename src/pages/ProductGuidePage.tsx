import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  DollarSign,
  Gem,
  Lightbulb,
  MonitorPlay,
  Music2,
  PlayCircle,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Video,
} from 'lucide-react';
import { CLOUDCAST_PRODUCTS, getProduct } from '../config/products';
import {
  PRODUCT_GUIDE_SECTIONS,
  WHY_CLOUDCAST_POINTS,
} from '../config/productGuideContent';
import { UniversalPlanCard } from '../components/products/ProductCard';
import { SITE_LEGAL } from '../config/siteLegal';
import type { CloudCastProduct, CloudCastProductId } from '../types/products';
import { cn } from '../lib/utils';

const PRODUCT_ICONS = {
  video_mixer: Video,
  audio_mixer: SlidersHorizontal,
  symphony_studio: Music2,
  instant_replay: Clapperboard,
  regal_display: MonitorPlay,
  regal_prism: Gem,
} as const;

const NAV_ITEMS: { id: CloudCastProductId | 'why' | 'universal'; label: string }[] = [
  ...CLOUDCAST_PRODUCTS.map((p) => ({ id: p.id as CloudCastProductId, label: p.shortName })),
  { id: 'universal', label: 'Universal' },
  { id: 'why', label: 'Why CloudCast' },
];

function accentStyles(accent: CloudCastProduct['accent']) {
  if (accent === 'blue') {
    return {
      border: 'border-sky-500/30',
      bg: 'bg-sky-500/10',
      text: 'text-sky-400',
      badge: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
    };
  }
  if (accent === 'purple') {
    return {
      border: 'border-violet-500/30',
      bg: 'bg-violet-500/10',
      text: 'text-violet-400',
      badge: 'border-violet-500/40 bg-violet-500/15 text-violet-300',
    };
  }
  if (accent === 'emerald') {
    return {
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      badge: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    };
  }
  if (accent === 'amber') {
    return {
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      badge: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
    };
  }
  return {
    border: 'border-mixer-red/30',
    bg: 'bg-mixer-red/10',
    text: 'text-mixer-red',
    badge: 'border-mixer-red/40 bg-mixer-red/15 text-mixer-red',
  };
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow && (
        <p className="text-xs font-bold tracking-[0.25em] text-mixer-red">{eyebrow}</p>
      )}
      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      {description && (
        <p className="mt-4 text-sm leading-relaxed text-mixer-muted sm:text-base">{description}</p>
      )}
    </div>
  );
}

function ProductGuideBlock({ productId }: { productId: CloudCastProductId }) {
  const product = getProduct(productId);
  const section = PRODUCT_GUIDE_SECTIONS.find((s) => s.id === productId)!;
  const Icon = PRODUCT_ICONS[productId];
  const accent = accentStyles(product.accent);

  return (
    <section id={productId} className="scroll-mt-28 border-t border-white/5 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-wrap items-start gap-4">
          <div
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border',
              accent.border,
              accent.bg,
            )}
          >
            <Icon className={cn('h-7 w-7', accent.text)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-mixer-muted">
              {product.tagline}
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight">{product.name}</h2>
            <p className="mt-1 text-sm font-medium text-mixer-muted">{section.costEffectiveness.monthlyRange}</p>
          </div>
          <Link
            to={product.pricingPath}
            className={cn(
              'inline-flex items-center gap-2 rounded border px-4 py-2 text-xs font-bold tracking-wider transition-colors hover:text-white',
              accent.border,
              accent.text,
            )}
          >
            VIEW PRICING <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-10 rounded-xl border border-white/10 bg-mixer-panel p-6 sm:p-8">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
            <Sparkles className="h-4 w-4 text-mixer-red" />
            What it is
          </h3>
          <p className="mt-4 text-sm leading-relaxed text-mixer-muted sm:text-base">
            {section.overview}
          </p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {section.keyCapabilities.map((cap) => (
              <li key={cap} className="flex items-start gap-2 text-sm text-mixer-muted">
                <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', accent.text)} />
                {cap}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
              <Lightbulb className="h-4 w-4 text-amber-400" />
              Problems it solves
            </h3>
            <div className="mt-4 space-y-4">
              {section.problems.map((problem) => (
                <div
                  key={problem.title}
                  className="rounded-lg border border-white/5 bg-[#0a0a0a] p-5"
                >
                  <h4 className="text-sm font-bold text-white">{problem.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-mixer-muted">
                    {problem.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
              <DollarSign className="h-4 w-4 text-emerald-400" />
              Cost effectiveness
            </h3>
            <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5">
              <p className="text-sm leading-relaxed text-mixer-muted">{section.costEffectiveness.summary}</p>
              <ul className="mt-4 space-y-2">
                {section.costEffectiveness.comparisonPoints.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-mixer-muted">
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {point}
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded border border-white/10 bg-black/30 px-3 py-2 text-xs leading-relaxed text-mixer-muted">
                <span className="font-bold text-white">Recommended: </span>
                {section.costEffectiveness.recommendedTier}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-white/10 bg-[#0a0a0a] p-6 sm:p-8">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
            <PlayCircle className="h-4 w-4 text-sky-400" />
            How to use it
          </h3>
          <ol className="mt-6 space-y-5">
            {section.howToUse.map((step) => (
              <li key={step.step} className="flex gap-4">
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                    accent.badge,
                  )}
                >
                  {step.step}
                </span>
                <div>
                  <h4 className="text-sm font-bold text-white">{step.title}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-mixer-muted">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div
          className={cn(
            'mt-8 rounded-xl border p-6 sm:p-8',
            accent.border,
            'bg-gradient-to-br from-white/[0.03] to-transparent',
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-mixer-muted">
            Live case scenario
          </p>
          <h3 className="mt-2 text-xl font-bold tracking-tight">{section.liveScenario.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-mixer-muted">{section.liveScenario.context}</p>
          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-wider text-white">Workflow</p>
            <ul className="mt-3 space-y-2">
              {section.liveScenario.workflow.map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm text-mixer-muted">
                  <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', accent.bg, accent.border, 'border')} />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-6 border-t border-white/10 pt-5 text-sm leading-relaxed text-mixer-text">
            <span className="font-bold text-white">Outcome: </span>
            {section.liveScenario.outcome}
          </p>
        </div>
      </div>
    </section>
  );
}

export function ProductGuidePage() {
  const [activeId, setActiveId] = useState<string>('video_mixer');

  useEffect(() => {
    const ids = NAV_ITEMS.map((item) => item.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.25, 0.5] },
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <main>
      <section className="relative overflow-hidden px-6 pb-12 pt-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#e11d4812_0%,_transparent_55%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold tracking-[0.3em] text-mixer-red">PRODUCT GUIDE</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            Every CloudCast product, explained
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-mixer-muted sm:text-base">
            A detailed look at what each {SITE_LEGAL.brandLine} product does, the production problems
            it solves, how cost-effective it is compared to traditional gear, step-by-step usage, and
            real live-event scenarios — plus why teams choose Quantum Regal.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded bg-mixer-red px-5 py-2.5 text-xs font-bold tracking-wider text-white hover:bg-mixer-red-dim"
            >
              START FREE <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/pricing"
              className="rounded border border-white/20 px-5 py-2.5 text-xs font-bold tracking-wider hover:border-white/40"
            >
              COMPARE PLANS
            </Link>
          </div>
        </div>
      </section>

      <nav className="sticky top-[57px] z-40 border-y border-white/5 bg-[#060606]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6 py-2">
          {NAV_ITEMS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-xs font-bold tracking-wider transition-colors',
                activeId === id
                  ? 'bg-white/10 text-white'
                  : 'text-mixer-muted hover:text-white',
              )}
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      {CLOUDCAST_PRODUCTS.map((product) => (
        <ProductGuideBlock key={product.id} productId={product.id} />
      ))}

      <section id="universal" className="scroll-mt-28 border-t border-white/5 bg-[#0a0a0a] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="BEST VALUE"
            title="CloudCast Universal"
            description="Three bundle tiers — Essential, Studio, and Master — covering all six CloudCast products with Pro or Pro Master features matched to your production scale."
          />
          <div className="mt-10">
            <UniversalPlanCard hideHeader />
          </div>
        </div>
      </section>

      <section id="why" className="scroll-mt-28 border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="WHY QUANTUM REGAL"
            title={`Why choose ${SITE_LEGAL.brandLine}?`}
            description={`${SITE_LEGAL.companyName} built CloudCast because broadcast teams deserve professional tools without the capital expense, truck racks, and fragmented software stacks that slow live production down.`}
          />

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {WHY_CLOUDCAST_POINTS.map((point) => (
              <div
                key={point.title}
                className="rounded-xl border border-white/10 bg-mixer-panel p-6"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-mixer-red/30 bg-mixer-red/10">
                  <Shield className="h-5 w-5 text-mixer-red" />
                </div>
                <h3 className="text-sm font-bold tracking-wide text-white">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mixer-muted">{point.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-xl border border-white/10 bg-[#0a0a0a] p-8 text-center">
            <h3 className="text-xl font-bold">Ready to replace the rack with a browser tab?</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm text-mixer-muted">
              Start on the free tier with Regal Mesh, run your first live show this week, and upgrade
              when your audience — or your client — demands HD, UHD, or the full Universal suite.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded bg-mixer-red px-5 py-2.5 text-xs font-bold tracking-wider text-white hover:bg-mixer-red-dim"
              >
                BROWSE PRODUCTS <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/login"
                className="rounded border border-white/20 px-5 py-2.5 text-xs font-bold tracking-wider hover:border-white/40"
              >
                CREATE ACCOUNT
              </Link>
            </div>
            <p className="mt-6 text-xs text-mixer-muted">
              Questions? Contact{' '}
              <a href={`mailto:${SITE_LEGAL.supportEmail}`} className="text-mixer-red underline">
                {SITE_LEGAL.supportEmail}
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
