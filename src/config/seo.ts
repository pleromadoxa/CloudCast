import { CLOUDCAST_PRODUCTS, UNIVERSAL_TIERS } from './products';
import { LEGAL_NAV, SITE_LEGAL } from './siteLegal';
import { PRODUCT_SLUG_BY_ID, PRODUCT_SEO_KEYWORDS } from './productLanding';
import { SOLUTION_PAGES, solutionPath } from './solutions';

/** Production site URL — override via VITE_APP_URL at build time. */
export const SITE_URL = (
  import.meta.env.VITE_APP_URL ?? 'https://cloudcast.live'
).replace(/\/$/, '');

export const SITE_NAME = SITE_LEGAL.productName;
export const SITE_BRAND = SITE_LEGAL.brandLine;
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

/** Square CloudCast mark for browser tabs, PWA icons, and home-screen shortcuts. */
export const FAVICON_PATH = '/favicon.png';

/** Brand logo for Open Graph / schema (real CloudCast logo, not legacy placeholder). */
export const BRAND_LOGO_URL = `${SITE_URL}/email/cloudcast-logo.png`;

/** Core keywords derived from product features and use cases. */
export const SITE_KEYWORDS = [
  'CloudCast',
  'Quantum Regal',
  'browser video mixer',
  'cloud broadcast switcher',
  'live streaming production',
  'PST PGM switcher',
  'multi-camera live production',
  'RTMP streaming',
  'Regal Mesh',
  'Regal Cloud',
  'broadcast audio console',
  'virtual production',
  'chroma key',
  'instant replay',
  'worship presentation software',
  'online DAW',
  'church live stream',
  'OB production',
  'YouTube live mixer',
  'Twitch streaming switcher',
] as const;

export type RobotsDirective = 'index, follow' | 'noindex, follow' | 'noindex, nofollow';

export interface PageSEOConfig {
  /** Document title — appended with site brand when `titleOnly` is false. */
  title: string;
  description: string;
  /** Path without origin, e.g. `/pricing`. Used for canonical and OG url. */
  path: string;
  keywords?: string[];
  robots?: RobotsDirective;
  ogType?: 'website' | 'article' | 'product';
  ogImage?: string;
  /** When true, `title` is used as-is without brand suffix. */
  titleOnly?: boolean;
  /** JSON-LD objects to inject (merged with site-wide schemas when provided). */
  jsonLd?: Record<string, unknown>[];
  /** Breadcrumb trail for BreadcrumbList schema. */
  breadcrumbs?: { name: string; path: string }[];
}

function fullTitle(title: string, titleOnly?: boolean): string {
  if (titleOnly) return title;
  return `${title} | ${SITE_BRAND}`;
}

export function resolvePageTitle(config: Pick<PageSEOConfig, 'title' | 'titleOnly'>): string {
  return fullTitle(config.title, config.titleOnly);
}

export function resolveCanonicalUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalized === '/' ? '' : normalized}`;
}

/** Public indexable routes for sitemap generation. */
export const SITEMAP_ROUTES: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/products', changefreq: 'weekly', priority: '0.9' },
  { path: '/products/guide', changefreq: 'monthly', priority: '0.9' },
  ...CLOUDCAST_PRODUCTS.map((p) => ({
    path: `/products/${PRODUCT_SLUG_BY_ID[p.id]}`,
    changefreq: 'weekly' as const,
    priority: '0.85' as const,
  })),
  ...SOLUTION_PAGES.map((s) => ({
    path: solutionPath(s.slug),
    changefreq: 'monthly' as const,
    priority: '0.8' as const,
  })),
  { path: '/pricing', changefreq: 'weekly', priority: '0.9' },
  { path: '/login', changefreq: 'monthly', priority: '0.5' },
  ...LEGAL_NAV.map(({ to }) => ({
    path: to,
    changefreq: 'yearly' as const,
    priority: '0.3' as const,
  })),
];

const DEFAULT_HOME_DESCRIPTION =
  'CloudCast is a browser-based broadcast suite: multi-channel video mixer, 16-channel audio console, virtual production, instant replay, worship display, and online DAW. Stream to YouTube, Twitch, and RTMP with Regal Mesh or Regal Cloud HD+.';

const PAGE_SEO_BY_PATH: Record<string, PageSEOConfig> = {
  '/': {
    title: 'Professional Broadcast Tools in the Cloud',
    description: DEFAULT_HOME_DESCRIPTION,
    path: '/',
    keywords: [...SITE_KEYWORDS],
    jsonLd: [
      buildWebSiteSchema(),
      buildSoftwareApplicationSuiteSchema(),
    ],
  },
  '/products': {
    title: 'Broadcast Products — Video, Audio, Virtual Production & More',
    description:
      'Explore six CloudCast products: Video Mixer, Audio Mixer, Symphony DAW, Instant Replay, Regal Display for worship, and Regal Prism virtual production. Subscribe individually or get the Universal bundle.',
    path: '/products',
    keywords: [
      'CloudCast products',
      'video mixer software',
      'broadcast audio mixer',
      'virtual production studio',
      'worship presentation',
      'browser DAW',
      ...SITE_KEYWORDS.slice(0, 8),
    ],
    breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Products', path: '/products' }],
    jsonLd: [buildProductListSchema()],
  },
  '/products/guide': {
    title: 'Product Guide — How CloudCast Replaces Hardware OB Gear',
    description:
      'In-depth guide to CloudCast Video Mixer, Audio Mixer, Symphony, Replay, Regal Display, and Regal Prism. Learn workflows, cost comparisons, and step-by-step production scenarios for churches, sports, news, and live events.',
    path: '/products/guide',
    keywords: [
      'CloudCast guide',
      'broadcast production guide',
      'replace hardware switcher',
      'cloud OB production',
      'live event streaming workflow',
      ...SITE_KEYWORDS.slice(0, 6),
    ],
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Products', path: '/products' },
      { name: 'Guide', path: '/products/guide' },
    ],
    ogType: 'article',
  },
  '/pricing': {
    title: 'Pricing — Free, Pro, Pro Master & Universal Plans',
    description:
      'CloudCast pricing from $0/month. Pro at $29/mo, Pro Master at $79/mo per product. Universal bundle from $59/mo includes all six products with Regal Cloud HD streaming, cloud recording, and audio-video bridge.',
    path: '/pricing',
    keywords: [
      'CloudCast pricing',
      'video mixer pricing',
      'broadcast software subscription',
      'Universal bundle',
      'free live streaming mixer',
      ...SITE_KEYWORDS.slice(0, 5),
    ],
    breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }],
    jsonLd: [buildPricingOfferSchema()],
  },
  '/login': {
    title: 'Sign In',
    description:
      'Sign in or create your CloudCast account to access the Video Mixer, Audio Console, Symphony DAW, Replay, Regal Display, and Regal Prism dashboards.',
    path: '/login',
    robots: 'index, follow',
  },
  '/hub': {
    title: 'Product Hub',
    description: 'Launch your CloudCast production dashboards — Video Mixer, Audio, Symphony, Replay, Display, and Prism.',
    path: '/hub',
    robots: 'noindex, follow',
  },
  '/profile': {
    title: 'Account & Billing',
    description: 'Manage your CloudCast subscription, cloud storage, recordings, and billing.',
    path: '/profile',
    robots: 'noindex, follow',
  },
  '/admin': {
    title: 'Admin',
    description: 'CloudCast platform administration.',
    path: '/admin',
    robots: 'noindex, nofollow',
  },
  '/dashboard': {
    title: 'Video Mixer',
    description: 'CloudCast Video Mixer — PST/PGM broadcast switcher dashboard.',
    path: '/dashboard',
    robots: 'noindex, follow',
  },
  '/dashboard/output': {
    title: 'Program Output',
    description: 'Live Video Mixer program output — full PGM feed for projectors and remote displays.',
    path: '/dashboard/output',
    robots: 'noindex, nofollow',
  },
  '/audio': {
    title: 'Audio Mixer',
    description: 'CloudCast Audio Mixer — 16-channel broadcast audio console.',
    path: '/audio',
    robots: 'noindex, follow',
  },
  '/replay': {
    title: 'Instant Replay',
    description: 'CloudCast Replay — rolling buffer instant replay for live events.',
    path: '/replay',
    robots: 'noindex, follow',
  },
  '/display': {
    title: 'Regal Display',
    description: 'Regal Display — worship slides, scripture, and presentation engine.',
    path: '/display',
    robots: 'noindex, follow',
  },
  '/display/view': {
    title: 'Display Feed',
    description: 'Live congregation display feed for Regal Display.',
    path: '/display/view',
    robots: 'noindex, nofollow',
  },
  '/symphony': {
    title: 'Symphony Studio',
    description: 'CloudCast Symphony — browser-based DAW for music production.',
    path: '/symphony',
    robots: 'noindex, follow',
  },
  '/prism': {
    title: 'Regal Prism',
    description: 'Regal Prism — browser virtual production and augmented reality studio.',
    path: '/prism',
    robots: 'noindex, follow',
  },
  '/prism/eye': {
    title: 'Regal Prism Eye',
    description: 'Regal Prism Eye — phone gyro tracking for virtual production. No login required.',
    path: '/prism/eye',
    robots: 'noindex, nofollow',
  },
};

/** Legal page SEO — keyed by path. */
for (const { to, label } of LEGAL_NAV) {
  PAGE_SEO_BY_PATH[to] = {
    title: label,
    description: `${label} for ${SITE_BRAND}. ${SITE_LEGAL.companyName} legal documentation effective ${SITE_LEGAL.effectiveDate}.`,
    path: to,
    robots: 'index, follow',
    ogType: 'article',
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: label, path: to },
    ],
  };
}

/** Product landing page SEO — keyed by path. */
for (const product of CLOUDCAST_PRODUCTS) {
  const path = `/products/${PRODUCT_SLUG_BY_ID[product.id]}`;
  PAGE_SEO_BY_PATH[path] = {
    title: `${product.name} — ${product.tagline}`,
    description: `${product.description} Start free with Regal Mesh or upgrade to Pro for Regal Cloud HD+ streaming.`,
    path,
    keywords: PRODUCT_SEO_KEYWORDS[product.id],
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Products', path: '/products' },
      { name: product.name, path },
    ],
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: product.name,
        description: product.description,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web Browser',
        url: resolveCanonicalUrl(path),
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description: 'Free tier available',
        },
      },
    ],
  };
}

/** Solution page SEO — keyed by path. */
for (const solution of SOLUTION_PAGES) {
  const path = solutionPath(solution.slug);
  PAGE_SEO_BY_PATH[path] = {
    title: solution.title,
    description: solution.description,
    path,
    keywords: solution.keywords,
    breadcrumbs: [
      { name: 'Home', path: '/' },
      { name: 'Solutions', path: solutionPath('churches') },
      { name: solution.title, path },
    ],
  };
}

/** Resolve SEO config for a pathname (ignores query strings). */
export function getSEOForPath(pathname: string): PageSEOConfig {
  const path = pathname.split('?')[0] || '/';
  return PAGE_SEO_BY_PATH[path] ?? {
    title: SITE_LEGAL.tagline,
    description: DEFAULT_HOME_DESCRIPTION,
    path,
    keywords: [...SITE_KEYWORDS],
  };
}

/** Merge overrides onto a base config (used by individual pages). */
export function mergeSEO(base: PageSEOConfig, overrides: Partial<PageSEOConfig>): PageSEOConfig {
  return {
    ...base,
    ...overrides,
    keywords: overrides.keywords ?? base.keywords,
    jsonLd: overrides.jsonLd ?? base.jsonLd,
    breadcrumbs: overrides.breadcrumbs ?? base.breadcrumbs,
  };
}

// ─── JSON-LD schema builders ───────────────────────────────────────────────

export function buildOrganizationSchema(): Record<string, unknown> {
  const { address } = SITE_LEGAL;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_LEGAL.companyName,
    alternateName: SITE_LEGAL.companyShortName,
    url: SITE_URL,
    logo: BRAND_LOGO_URL,
    description: DEFAULT_HOME_DESCRIPTION,
    email: SITE_LEGAL.supportEmail,
    address: {
      '@type': 'PostalAddress',
      streetAddress: address.line2,
      addressLocality: address.city,
      addressRegion: address.region,
      postalCode: address.postal,
      addressCountry: address.country,
    },
    sameAs: [],
  };
}

function buildWebSiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_BRAND,
    url: SITE_URL,
    description: DEFAULT_HOME_DESCRIPTION,
    publisher: {
      '@type': 'Organization',
      name: SITE_LEGAL.companyName,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/products?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

function buildSoftwareApplicationSuiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_BRAND,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web Browser',
    url: SITE_URL,
    description: DEFAULT_HOME_DESCRIPTION,
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '0',
      highPrice: '149',
      priceCurrency: 'USD',
      offerCount: String(UNIVERSAL_TIERS.length + 1),
    },
    featureList: CLOUDCAST_PRODUCTS.map((p) => p.name).join(', '),
    provider: {
      '@type': 'Organization',
      name: SITE_LEGAL.companyName,
    },
  };
}

function buildProductListSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'CloudCast Products',
    description: 'Six browser-based broadcast production tools by Quantum Regal.',
    numberOfItems: CLOUDCAST_PRODUCTS.length,
    itemListElement: CLOUDCAST_PRODUCTS.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'SoftwareApplication',
        name: product.name,
        description: product.description,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web Browser',
        url: resolveCanonicalUrl(`/products/${PRODUCT_SLUG_BY_ID[product.id]}`),
      },
    })),
  };
}

function buildPricingOfferSchema(): Record<string, unknown> {
  const offers = [
    { name: 'Free', price: '0', description: 'Regal Mesh, 2 video inputs' },
    { name: 'Pro', price: '29', description: 'Regal Cloud HD, 5 inputs, cloud recording' },
    { name: 'Pro Master', price: '79', description: 'UHD, 11 inputs, priority support' },
    ...UNIVERSAL_TIERS.map((tier) => ({
      name: tier.name,
      price: String(tier.priceCents / 100),
      description: tier.tagline,
    })),
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: SITE_BRAND,
    description: 'CloudCast broadcast production suite subscription plans.',
    brand: {
      '@type': 'Brand',
      name: SITE_LEGAL.companyShortName,
    },
    offers: offers.map((offer) => ({
      '@type': 'Offer',
      name: offer.name,
      price: offer.price,
      priceCurrency: 'USD',
      description: offer.description,
      url: resolveCanonicalUrl('/pricing'),
      availability: 'https://schema.org/InStock',
    })),
  };
}

export function buildBreadcrumbSchema(
  breadcrumbs: { name: string; path: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: resolveCanonicalUrl(crumb.path),
    })),
  };
}

/** All JSON-LD blocks for a page config. */
export function collectJsonLd(config: PageSEOConfig): Record<string, unknown>[] {
  const schemas: Record<string, unknown>[] = [buildOrganizationSchema()];

  if (config.breadcrumbs?.length) {
    schemas.push(buildBreadcrumbSchema(config.breadcrumbs));
  }

  if (config.jsonLd?.length) {
    schemas.push(...config.jsonLd);
  }

  return schemas;
}
