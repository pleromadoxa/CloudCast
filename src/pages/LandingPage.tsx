import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Camera, Clapperboard, Cloud, Gem, LayoutGrid, MonitorPlay, Music2, Radio, SlidersHorizontal, Smartphone, Tv, Video, Zap } from 'lucide-react';
import { CLOUDCAST_PRODUCTS } from '../config/products';
import { productLandingPath } from '../config/productLanding';
import { SOLUTION_PAGES, solutionPath } from '../config/solutions';
import { HomeFaq } from '../components/marketing/HomeFaq';
import { SITE_LEGAL } from '../config/siteLegal';
import type { CloudCastProduct } from '../types/products';

const PRODUCT_ICONS = {
  video_mixer: Video,
  audio_mixer: SlidersHorizontal,
  symphony_studio: Music2,
  instant_replay: Clapperboard,
  regal_display: MonitorPlay,
  regal_prism: Gem,
} as const;

function productAccentClass(accent: CloudCastProduct['accent'], part: 'icon' | 'card') {
  if (accent === 'blue') {
    return part === 'icon'
      ? 'border-sky-500/30 bg-sky-500/10 text-sky-400'
      : 'hover:border-sky-500/30';
  }
  if (accent === 'purple') {
    return part === 'icon'
      ? 'border-violet-500/30 bg-violet-500/10 text-violet-400'
      : 'hover:border-violet-500/30';
  }
  if (accent === 'emerald') {
    return part === 'icon'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
      : 'hover:border-emerald-500/30';
  }
  if (accent === 'amber') {
    return part === 'icon'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
      : 'hover:border-amber-500/30';
  }
  return part === 'icon'
    ? 'border-mixer-red/30 bg-mixer-red/10 text-mixer-red'
    : 'hover:border-white/20';
}

const broadcastFirms = [
  { name: 'Regal Broadcast Group', tag: 'Flagship network' },
  { name: 'Meridian Live Events', tag: 'OB & field production' },
  { name: 'Horizon News Network', tag: '24/7 news desk' },
  { name: 'Apex Sports Media', tag: 'Multi-cam sports' },
  { name: 'Vertex Studio Group', tag: 'Studio & streaming' },
  { name: 'Nexus Production Co.', tag: 'Corporate & faith' },
];

const firmUseCases = [
  {
    icon: Tv,
    title: 'Television & cable networks',
    body: 'Replace rack-mounted switchers for remotes, breaking news, and second-screen feeds. Pro Master delivers UHD across ten channels including USB capture for graphics and replay.',
  },
  {
    icon: Building2,
    title: 'Production companies & OB firms',
    body: 'Deploy a full mixer from a laptop on location. Pair field cameras over Regal Mesh on the free tier or Regal Cloud HD+ on Pro for distributed crews.',
  },
  {
    icon: Radio,
    title: 'Streaming & digital broadcasters',
    body: 'Run PST/PGM workflows, transitions, and on-air branding without hardware. Scale from two-camera streams to full multi-source HD and UHD productions.',
  },
];

const features = [
  {
    icon: Smartphone,
    title: 'Regal Mesh',
    body: 'Pair iOS and Android devices with a 6-digit access code. Free tier uses stable direct mesh — no relay required, ideal for small crews.',
  },
  {
    icon: Cloud,
    title: 'Regal Cloud HD+',
    body: 'Pro and Pro Master plans use Regal\'s global delivery network for broadcast-grade HD and UHD streaming with ultra-low latency.',
  },
  {
    icon: Radio,
    title: 'Broadcast Mixer',
    body: 'PST/PGM monitors, transitions, PiP, chroma key, audio mixer, and multiview — a full production switcher in your browser.',
  },
  {
    icon: Zap,
    title: 'Instant Pairing',
    body: 'Mobile apps detect your plan from the access code and connect through the right Regal pipeline automatically.',
  },
];

export function LandingPage() {
  return (
    <main>
      <section className="relative overflow-hidden px-6 pb-24 pt-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#e11d4815_0%,_transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="mb-4 text-xs font-bold tracking-[0.3em] text-mixer-red">CLOUDCAST BROADCAST SUITE</p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Professional broadcast tools
            <span className="block text-mixer-muted">in the cloud.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-mixer-muted sm:text-lg">
            {SITE_LEGAL.brandLine} is the platform — start with the multi-channel video mixer, the
            StudioLive-inspired audio console, CloudCast Symphony for music production, or CloudCast Replay for
            instant replay on live events. Subscribe per product or unlock everything with CloudCast Universal.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded bg-mixer-red px-6 py-3 text-sm font-bold tracking-wider text-white hover:bg-mixer-red-dim"
            >
              VIEW PRODUCTS <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/products/guide"
              className="rounded border border-white/20 px-6 py-3 text-sm font-bold tracking-wider hover:border-white/40"
            >
              PRODUCT GUIDE
            </Link>
            <Link
              to="/pricing"
              className="rounded border border-white/20 px-6 py-3 text-sm font-bold tracking-wider hover:border-white/40"
            >
              VIEW PRICING
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-[#0a0a0a] px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">CloudCast products</h2>
            <p className="mt-3 text-sm text-mixer-muted">
              Each product has its own dashboard and pricing — or choose Universal for the full suite.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {CLOUDCAST_PRODUCTS.map((product) => {
              const Icon = PRODUCT_ICONS[product.id];
              return (
                <Link
                  key={product.id}
                  to={productLandingPath(product.id)}
                  className={`group rounded-xl border border-white/10 bg-mixer-panel p-8 transition-colors ${productAccentClass(product.accent, 'card')}`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-lg border ${productAccentClass(product.accent, 'icon')}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold group-hover:text-white">{product.name}</h3>
                      <p className="mt-1 text-xs uppercase tracking-wider text-mixer-muted">{product.tagline}</p>
                      <p className="mt-3 text-sm leading-relaxed text-mixer-muted">{product.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          <Link
            to="/pricing?product=universal"
            className="group mt-6 block rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-mixer-panel p-8 transition-colors hover:border-amber-500/40"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-400">
                <LayoutGrid className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">CloudCast Universal</h3>
                <p className="mt-1 text-xs uppercase tracking-wider text-amber-200/80">Six products · from $59/mo</p>
                <p className="mt-3 text-sm leading-relaxed text-mixer-muted">
                  Essential, Studio, or Master — every tier includes Video Mixer, Audio Mixer, Symphony, Replay, Regal Display, and Regal Prism.
                </p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      <section className="border-y border-white/5 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Symphony & Replay</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-mixer-muted">
              Compose original scores in Symphony, then drop highlight clips to air with Replay — two tools that
              extend every live production beyond the switcher.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {CLOUDCAST_PRODUCTS.filter((p) => p.id === 'symphony_studio' || p.id === 'instant_replay').map((product) => {
              const Icon = PRODUCT_ICONS[product.id];
              const pricing =
                product.id === 'symphony_studio'
                  ? 'Free · Pro $29/mo · Pro Master $79/mo'
                  : 'Included with Video Mixer — no extra charge';
              return (
                <Link
                  key={product.id}
                  to={product.pricingPath}
                  className={`group rounded-xl border bg-mixer-panel p-8 transition-colors ${
                    product.accent === 'purple'
                      ? 'border-violet-500/20 hover:border-violet-500/40'
                      : 'border-emerald-500/20 hover:border-emerald-500/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-lg border ${productAccentClass(product.accent, 'icon')}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{product.name}</h3>
                      <p className="text-xs uppercase tracking-wider text-mixer-muted">{product.tagline}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-mixer-muted">{product.description}</p>
                  <p className="mt-4 text-xs font-bold tracking-wider text-mixer-muted">{pricing}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-xs font-bold tracking-wider text-white group-hover:text-mixer-red">
                    {product.id === 'instant_replay' ? 'VIEW VIDEO MIXER PLANS' : 'VIEW PRICING'} <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-[#0a0a0a] px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="mb-8 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-mixer-muted">
            Trusted by broadcast firms
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {broadcastFirms.map((firm) => (
              <div
                key={firm.name}
                className="flex flex-col items-center justify-center rounded-lg border border-white/5 bg-mixer-panel px-3 py-5 text-center transition-colors hover:border-white/10"
              >
                <span className="text-[11px] font-bold leading-tight tracking-wide text-mixer-text">
                  {firm.name}
                </span>
                <span className="mt-1.5 text-[9px] uppercase tracking-wider text-mixer-muted">
                  {firm.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Built for broadcast firms</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-mixer-muted">
              From regional networks to outside broadcast crews, {SITE_LEGAL.brandLine} gives production
              teams a browser-native switcher without truck racks or flypack cases.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {firmUseCases.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-lg border border-white/5 bg-mixer-panel p-8">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded border border-mixer-red/30 bg-mixer-red/10">
                  <Icon className="h-5 w-5 text-mixer-red" />
                </div>
                <h3 className="mb-2 text-sm font-bold tracking-wide">{title}</h3>
                <p className="text-xs leading-relaxed text-mixer-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-[#0a0a0a] px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Built for live production</h2>
            <p className="mt-3 text-sm text-mixer-muted">Everything you need to run a multi-camera show from a single dashboard.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-lg border border-white/5 bg-mixer-panel p-6">
                <Icon className="mb-4 h-8 w-8 text-mixer-red" />
                <h3 className="mb-2 text-sm font-bold tracking-wide">{title}</h3>
                <p className="text-xs leading-relaxed text-mixer-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">About {SITE_LEGAL.brandLine}</h2>
            <p className="mt-4 text-sm leading-relaxed text-mixer-muted">
              CloudCast is Regal&apos;s cloud-native video production platform. It was designed to remove
              the complexity of traditional broadcast gear — no SDI cables, no hardware switchers, no
              dedicated encoder racks.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-mixer-muted">
              Instead, your team opens the CloudCast dashboard, shares a 6-character access code, and
              mobile cameras join instantly. The mixer handles preview/program routing, transitions,
              overlays, and audio — the same workflow professionals expect from hardware switchers,
              delivered through the browser.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-mixer-muted">
              Start on Regal Mesh with two cameras, step up to Regal Cloud HD on Pro, or run a full
              UHD production with Pro Master — ten channels including USB capture.
            </p>
          </div>
          <div className="relative aspect-video overflow-hidden rounded-lg border border-mixer-border bg-mixer-panel">
            <div className="absolute inset-0 flex items-center justify-center gap-4">
              <div className="flex h-24 w-32 flex-col items-center justify-center rounded border border-mixer-green/30 bg-black/50">
                <Camera className="h-6 w-6 text-mixer-green" />
                <span className="mt-1 text-[10px] font-bold text-mixer-green">PST</span>
              </div>
              <div className="flex h-24 w-32 flex-col items-center justify-center rounded border border-mixer-red/30 bg-black/50">
                <Radio className="h-6 w-6 text-mixer-red" />
                <span className="mt-1 text-[10px] font-bold text-mixer-red">PGM</span>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-4 py-2 text-center text-[10px] tracking-widest text-mixer-muted">
              CLOUDCAST MULTI-SOURCE VIDEO MIXER
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Solutions by industry</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-mixer-muted">
              CloudCast replaces hardware OB gear for churches, sports leagues, news desks, and corporate events.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SOLUTION_PAGES.map((solution) => (
              <Link
                key={solution.slug}
                to={solutionPath(solution.slug)}
                className="group rounded-xl border border-white/10 bg-mixer-panel p-6 transition-colors hover:border-mixer-red/30"
              >
                <h3 className="font-bold capitalize group-hover:text-mixer-red">{solution.slug.replace('-', ' ')}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mixer-muted">{solution.headline}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold tracking-wider text-mixer-muted group-hover:text-white">
                  LEARN MORE <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <HomeFaq />

      <section className="border-t border-white/5 bg-[#0a0a0a] px-6 py-16 text-center">
        <h2 className="text-xl font-bold">Ready to go live?</h2>
        <p className="mt-2 text-sm text-mixer-muted">
          Start free with Regal Mesh. Upgrade to Regal Cloud for HD and UHD streaming.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex items-center gap-2 rounded bg-mixer-red px-6 py-3 text-sm font-bold tracking-wider text-white hover:bg-mixer-red-dim"
        >
          CREATE ACCOUNT <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
