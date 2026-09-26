// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from 'vitest';
import {
  crawlLineFromHeadlines,
  curateHeadlines,
  dedupeHeadlines,
  feedFetchCandidates,
  headlineRows,
  isCacheFresh,
  NEWS_SOURCES,
  parseFeedDocument,
  readNewsCache,
  writeNewsCache,
  type NewsHeadline,
  type NewsSourceDef,
} from './newsCrawler';

const BBC_SOURCE: NewsSourceDef = {
  id: 'bbc-world',
  label: 'BBC World',
  url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  category: 'world',
  short: 'BBC',
};

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>BBC News</title>
    <item>
      <title><![CDATA[World leaders gather for emergency summit]]></title>
      <link>https://bbc.example/summit</link>
      <description><![CDATA[Delegates arrive for two days of talks.]]></description>
      <pubDate>Mon, 22 Sep 2026 09:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Markets rally as central banks signal pause</title>
      <link>https://bbc.example/markets</link>
      <description>Stocks climb worldwide.</description>
      <pubDate>Mon, 22 Sep 2026 10:30:00 GMT</pubDate>
    </item>
    <item>
      <title></title>
      <link>https://bbc.example/empty</link>
    </item>
  </channel>
</rss>`;

const ATOM_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>The Verge</title>
  <entry>
    <title>New AI standard unveiled</title>
    <link href="https://verge.example/ai" />
    <summary>Industry backs the framework.</summary>
    <published>2026-09-22T08:00:00Z</published>
  </entry>
</feed>`;

describe('parseFeedDocument', () => {
  it('parses RSS items with CDATA titles, links and dates', () => {
    const headlines = parseFeedDocument(RSS_FIXTURE, BBC_SOURCE);
    expect(headlines).toHaveLength(2); // empty-title item dropped
    expect(headlines[0].title).toBe('World leaders gather for emergency summit');
    expect(headlines[0].link).toBe('https://bbc.example/summit');
    expect(headlines[0].summary).toBe('Delegates arrive for two days of talks.');
    expect(headlines[0].sourceLabel).toBe('BBC');
    expect(headlines[0].category).toBe('world');
    expect(headlines[0].publishedAt).toBe(Date.parse('Mon, 22 Sep 2026 09:00:00 GMT'));
  });

  it('parses Atom entries with href links', () => {
    const verge: NewsSourceDef = { ...BBC_SOURCE, id: 'the-verge', category: 'tech', short: 'THE VERGE' };
    const headlines = parseFeedDocument(ATOM_FIXTURE, verge);
    expect(headlines).toHaveLength(1);
    expect(headlines[0].title).toBe('New AI standard unveiled');
    expect(headlines[0].link).toBe('https://verge.example/ai');
    expect(headlines[0].category).toBe('tech');
  });

  it('returns nothing for garbage input', () => {
    expect(parseFeedDocument('<not-valid', BBC_SOURCE)).toEqual([]);
    expect(parseFeedDocument('', BBC_SOURCE)).toEqual([]);
  });
});

describe('dedupeHeadlines', () => {
  const make = (title: string, publishedAt: number, sourceId = 'bbc-world'): NewsHeadline => ({
    id: `${sourceId}:${title}`,
    title,
    summary: '',
    link: '',
    sourceId,
    sourceLabel: 'BBC',
    category: 'world',
    publishedAt,
  });

  it('keeps the freshest copy across sources and normalizes punctuation', () => {
    const merged = dedupeHeadlines([
      make('Markets rally!!', 1000, 'cnn-top'),
      make('Markets rally', 2000, 'bbc-world'),
      make('Space telescope reveals galaxies', 1500),
    ]);
    expect(merged).toHaveLength(2);
    const markets = merged.find((h) => h.title.startsWith('Markets'));
    expect(markets?.publishedAt).toBe(2000);
  });

  it('sorts newest first', () => {
    const merged = dedupeHeadlines([make('Old story', 100), make('New story', 200)]);
    expect(merged.map((h) => h.title)).toEqual(['New story', 'Old story']);
  });
});

describe('curateHeadlines', () => {
  const make = (title: string, category: NewsHeadline['category']): NewsHeadline => ({
    id: title,
    title,
    summary: '',
    link: '',
    sourceId: 'x',
    sourceLabel: 'X',
    category,
    publishedAt: 1,
  });

  it('filters by category and enforces the limit', () => {
    const rows = curateHeadlines(
      [
        make('World story', 'world'),
        make('Tech story', 'tech'),
        make('Gossip', 'entertainment'),
        make('Another world story', 'world'),
      ],
      { categories: ['world', 'tech'], limit: 2 },
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.category === 'world' || r.category === 'tech')).toBe(true);
  });

  it('passes everything through with no filters', () => {
    const rows = curateHeadlines([make('A', 'world'), make('B', 'sports')]);
    expect(rows).toHaveLength(2);
  });
});

describe('crawl presentation helpers', () => {
  const head: NewsHeadline = {
    id: '1',
    title: 'Summit opens',
    summary: '',
    link: '',
    sourceId: 'bbc-world',
    sourceLabel: 'BBC',
    category: 'world',
    publishedAt: 1,
  };

  it('builds an attributed crawl line', () => {
    expect(crawlLineFromHeadlines([head])).toBe('BBC — Summit opens');
    expect(crawlLineFromHeadlines([head, head], ' / ')).toBe('BBC — Summit opens / BBC — Summit opens');
    expect(crawlLineFromHeadlines([])).toContain('Waiting');
  });

  it('maps headline rows to category tags', () => {
    const rows = headlineRows([{ ...head, category: 'sports' }]);
    expect(rows[0]).toEqual({ tag: 'SPORT', title: 'Summit opens' });
  });

  it('tries direct fetch before the CORS relays', () => {
    const candidates = feedFetchCandidates('https://feeds.example/rss.xml');
    expect(candidates[0]).toBe('https://feeds.example/rss.xml');
    expect(candidates[1]).toContain('allorigins');
    expect(candidates[2]).toContain('corsproxy');
  });
});

describe('news cache', () => {
  // Node exposes a stub localStorage without a working API — swap in a small
  // in-memory Storage so the cache logic gets real coverage.
  beforeAll(() => {
    const usable = (() => {
      try {
        return typeof globalThis.localStorage?.setItem === 'function';
      } catch {
        return false;
      }
    })();
    if (usable) return;
    const map = new Map<string, string>();
    const shim = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      removeItem: (key: string) => {
        map.delete(key);
      },
      clear: () => map.clear(),
      key: (i: number) => Array.from(map.keys())[i] ?? null,
      get length() {
        return map.size;
      },
    } as Storage;
    Object.defineProperty(globalThis, 'localStorage', { value: shim, configurable: true });
  });

  it('round-trips headlines and reports freshness', () => {
    const head: NewsHeadline = {
      id: 'cache-1',
      title: 'Cached story',
      summary: '',
      link: '',
      sourceId: 'bbc-world',
      sourceLabel: 'BBC',
      category: 'world',
      publishedAt: 1,
    };
    writeNewsCache([head]);
    const cached = readNewsCache();
    expect(cached?.[0]?.title).toBe('Cached story');
    expect(isCacheFresh(cached)).toBe(true);
    expect(isCacheFresh(null)).toBe(false);
  });
});

describe('NEWS_SOURCES catalog', () => {
  it('covers every category with unique ids and https/http URLs', () => {
    const ids = new Set(NEWS_SOURCES.map((s) => s.id));
    expect(ids.size).toBe(NEWS_SOURCES.length);
    const categories = new Set(NEWS_SOURCES.map((s) => s.category));
    expect(categories.has('world')).toBe(true);
    expect(categories.has('business')).toBe(true);
    expect(categories.has('tech')).toBe(true);
    expect(categories.has('sports')).toBe(true);
    for (const source of NEWS_SOURCES) {
      expect(source.url).toMatch(/^https?:\/\//);
    }
  });
});
