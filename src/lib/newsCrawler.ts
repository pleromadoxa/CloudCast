/**
 * CloudCast News Crawler — broadcast-grade headline ingestion.
 *
 * Pulls RSS/Atom feeds from major wires (BBC, CNN, AP, Al Jazeera, Sky News,
 * Google News topics, ESPN, Yahoo Finance, tech desks) with layered fallbacks:
 *
 *   1. direct fetch (works when the wire sends CORS headers)
 *   2. public CORS relays (allorigins, corsproxy, isla)
 *   3. last-known-good cache (localStorage, TTL-based) so a crawl never
 *      leaves the operator with an empty rundown on air
 *
 * Framework-agnostic and unit tested — parsing and merging are pure.
 */

export type NewsCategory = 'world' | 'business' | 'tech' | 'entertainment' | 'sports' | 'health' | 'science';

export interface NewsSourceDef {
  id: string;
  label: string;
  url: string;
  category: NewsCategory;
  /** Shown in the crawl attribution ("BBC", "AP"…). */
  short: string;
}

export interface NewsHeadline {
  id: string;
  title: string;
  summary: string;
  link: string;
  sourceId: string;
  sourceLabel: string;
  category: NewsCategory;
  publishedAt: number;
}

/** Curated wire list — deliberately lean, high-signal feeds. */
export const NEWS_SOURCES: NewsSourceDef[] = [
  {
    id: 'bbc-world',
    label: 'BBC World',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    category: 'world',
    short: 'BBC',
  },
  {
    id: 'bbc-business',
    label: 'BBC Business',
    url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    category: 'business',
    short: 'BBC',
  },
  {
    id: 'cnn-top',
    label: 'CNN Top Stories',
    url: 'http://rss.cnn.com/rss/edition.rss',
    category: 'world',
    short: 'CNN',
  },
  {
    id: 'cnn-business',
    label: 'CNN Business',
    url: 'http://rss.cnn.com/rss/money_latest.rss',
    category: 'business',
    short: 'CNN',
  },
  {
    id: 'ap-world',
    label: 'AP World',
    url: 'https://feedx.net/rss/ap.xml',
    category: 'world',
    short: 'AP',
  },
  {
    id: 'aljazeera',
    label: 'Al Jazeera English',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    category: 'world',
    short: 'AL JAZEERA',
  },
  {
    id: 'sky-news',
    label: 'Sky News',
    url: 'https://feeds.skynews.com/feeds/rss/home.xml',
    category: 'world',
    short: 'SKY',
  },
  {
    id: 'google-world',
    label: 'Google News · World',
    url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en',
    category: 'world',
    short: 'GNEWS',
  },
  {
    id: 'google-business',
    label: 'Google News · Business',
    url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGxqY0pBU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en',
    category: 'business',
    short: 'GNEWS',
  },
  {
    id: 'google-tech',
    label: 'Google News · Tech',
    url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en',
    category: 'tech',
    short: 'GNEWS',
  },
  {
    id: 'google-ent',
    label: 'Google News · Entertainment',
    url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en',
    category: 'entertainment',
    short: 'GNEWS',
  },
  {
    id: 'espn',
    label: 'ESPN Top',
    url: 'https://www.espn.com/espn/rss/news',
    category: 'sports',
    short: 'ESPN',
  },
  {
    id: 'yahoo-finance',
    label: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/news/rssindex',
    category: 'business',
    short: 'YAHOO FINANCE',
  },
  {
    id: 'ars-technica',
    label: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    category: 'tech',
    short: 'ARS TECHNICA',
  },
  {
    id: 'the-verge',
    label: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    category: 'tech',
    short: 'THE VERGE',
  },
  {
    id: 'npr-health',
    label: 'NPR Health',
    url: 'https://feeds.npr.org/1007/rss.xml',
    category: 'health',
    short: 'NPR',
  },
];

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  world: 'WORLD',
  business: 'BUSINESS',
  tech: 'TECH',
  entertainment: 'CULTURE',
  sports: 'SPORT',
  health: 'HEALTH',
  science: 'SCIENCE',
};

// --------------------------------------------------------------------------
// Feed fetching with layered fallbacks
// --------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 8000;

function withTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** Ordered attempt URLs for a feed: direct first, then public CORS relays. */
export function feedFetchCandidates(url: string): string[] {
  return [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  ];
}

async function fetchFeedText(url: string): Promise<string | null> {
  for (const candidate of feedFetchCandidates(url)) {
    try {
      const res = await withTimeout(candidate);
      if (!res.ok) continue;
      const text = await res.text();
      // Relays sometimes return HTML error pages instead of the feed.
      if (text.length > 64 && !text.trimStart().startsWith('<!DOCTYPE html')) return text;
    } catch {
      /* try next relay */
    }
  }
  return null;
}

// --------------------------------------------------------------------------
// Parsing (RSS 2.0 + Atom) — pure, unit tested
// --------------------------------------------------------------------------

function textOf(parent: Element, tag: string): string {
  const wanted = tag.toLowerCase();
  for (const child of Array.from(parent.children)) {
    const name = child.localName?.toLowerCase() ?? '';
    if (name === wanted) return (child.textContent ?? '').trim();
  }
  return '';
}

function stripCdata(raw: string): string {
  return raw
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .trim();
}

function normalizeTitle(raw: string): string {
  return stripCdata(raw).replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes feed XML before parsing: CDATA sections (used heavily by BBC,
 * CNN and most RSS wires) are converted to escaped text so strict XML parsers
 * (and DOM implementations without CDATA support) still read the content.
 */
export function preprocessFeedXml(xml: string): string {
  return xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_match, inner: string) =>
    inner.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  );
}

/** Parses an RSS/Atom document into normalized headlines. */
export function parseFeedDocument(xml: string, source: NewsSourceDef, now = Date.now()): NewsHeadline[] {
  if (!xml || !xml.trim()) return [];
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(preprocessFeedXml(xml), 'application/xml');
  } catch {
    return [];
  }
  if (!doc || doc.querySelector('parsererror')) return [];

  const items: NewsHeadline[] = [];
  const nodes = Array.from(doc.querySelectorAll('item, entry'));
  for (const node of nodes) {
    const rawTitle = textOf(node, 'title');
    const title = normalizeTitle(rawTitle);
    if (!title) continue;

    const link =
      textOf(node, 'link') ||
      node.querySelector('link')?.getAttribute('href') ||
      '';
    const summary = normalizeTitle(textOf(node, 'description') || textOf(node, 'summary')).slice(0, 240);
    const dateRaw = textOf(node, 'pubDate') || textOf(node, 'published') || textOf(node, 'updated');
    const parsedDate = dateRaw ? Date.parse(dateRaw) : Number.NaN;

    items.push({
      id: `${source.id}:${title.toLowerCase().replace(/\W+/g, '').slice(0, 64)}`,
      title,
      summary,
      link: link.trim(),
      sourceId: source.id,
      sourceLabel: source.short,
      category: source.category,
      publishedAt: Number.isFinite(parsedDate) ? parsedDate : now,
    });
  }
  return items;
}

/** Deduplicates by normalized title, keeping the freshest copy. */
export function dedupeHeadlines(headlines: NewsHeadline[]): NewsHeadline[] {
  const byTitle = new Map<string, NewsHeadline>();
  for (const h of headlines) {
    const key = h.title.toLowerCase().replace(/\W+/g, '');
    const existing = byTitle.get(key);
    if (!existing || h.publishedAt > existing.publishedAt) byTitle.set(key, h);
  }
  return Array.from(byTitle.values()).sort((a, b) => b.publishedAt - a.publishedAt);
}

/** Filters by category set and caps the rundown length. */
export function curateHeadlines(
  headlines: NewsHeadline[],
  opts: { categories?: NewsCategory[]; limit?: number } = {},
): NewsHeadline[] {
  const { categories, limit = 40 } = opts;
  const filtered = categories?.length
    ? headlines.filter((h) => categories.includes(h.category))
    : headlines;
  return filtered.slice(0, limit);
}

// --------------------------------------------------------------------------
// Cache — last-known-good rundown (survives feed outages + offline)
// --------------------------------------------------------------------------

const CACHE_KEY = 'cloudcast:news-cache:v1';
const CACHE_TTL_MS = 30 * 60 * 1000;

interface NewsCacheShape {
  savedAt: number;
  headlines: NewsHeadline[];
}

function storage(): Storage | null {
  try {
    const store = globalThis.localStorage as Storage | undefined;
    // Some runtimes expose a stub localStorage without a working API —
    // treat anything without getItem/setItem as "no storage".
    return store && typeof store.getItem === 'function' && typeof store.setItem === 'function'
      ? store
      : null;
  } catch {
    return null;
  }
}

export function readNewsCache(): NewsHeadline[] | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NewsCacheShape;
    if (!parsed?.headlines?.length) return null;
    return parsed.headlines;
  } catch {
    return null;
  }
}

export function writeNewsCache(headlines: NewsHeadline[]): void {
  const store = storage();
  if (!store || !headlines.length) return;
  try {
    store.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), headlines: headlines.slice(0, 120) } satisfies NewsCacheShape));
  } catch {
    /* quota — cache is best-effort */
  }
}

export function isCacheFresh(headlines: NewsHeadline[] | null): boolean {
  if (!headlines?.length) return false;
  const store = storage();
  if (!store) return false;
  try {
    const raw = store.getItem(CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as NewsCacheShape;
    return Date.now() - parsed.savedAt < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

// --------------------------------------------------------------------------
// Orchestration
// --------------------------------------------------------------------------

export interface CrawlResult {
  headlines: NewsHeadline[];
  /** Sources that produced at least one item in this run. */
  fetchedSources: string[];
  /** True when results came from the cache rather than the network. */
  fromCache: boolean;
}

/** Crawls the given sources and returns a curated, deduped rundown. */
export async function crawlNews(
  sources: NewsSourceDef[],
  opts: { categories?: NewsCategory[]; limit?: number; now?: number } = {},
): Promise<CrawlResult> {
  const now = opts.now ?? Date.now();
  const settled = await Promise.allSettled(
    sources.map(async (source) => {
      const text = await fetchFeedText(source.url);
      return text ? parseFeedDocument(text, source, now) : [];
    }),
  );

  const collected: NewsHeadline[] = [];
  const fetchedSources: string[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value.length) {
      collected.push(...result.value);
      fetchedSources.push(result.value[0].sourceId);
    }
  }

  if (collected.length) {
    const curated = curateHeadlines(dedupeHeadlines(collected), opts);
    writeNewsCache(curated);
    return { headlines: curated, fetchedSources, fromCache: false };
  }

  // Total outage → serve last-known-good so the ticker keeps moving.
  const cached = readNewsCache();
  return {
    headlines: cached ? curateHeadlines(cached, opts) : [],
    fetchedSources: [],
    fromCache: true,
  };
}

/**
 * Builds the crawl line shown in the ticker: "BBC — headline  •  CNN — headline".
 * Items are repeated so the strip never runs short for long crawls.
 */
export function crawlLineFromHeadlines(headlines: NewsHeadline[], separator = '   •   '): string {
  if (!headlines.length) return 'Waiting for the news wire…';
  return headlines.map((h) => `${h.sourceLabel} — ${h.title}`).join(separator);
}

/** Flattens headlines to display rows (category tag + title). */
export function headlineRows(headlines: NewsHeadline[], limit = 6): Array<{ tag: string; title: string }> {
  return headlines.slice(0, limit).map((h) => ({
    tag: NEWS_CATEGORY_LABELS[h.category],
    title: h.title,
  }));
}
