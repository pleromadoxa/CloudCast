import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NEWS_SOURCES,
  crawlNews,
  isCacheFresh,
  readNewsCache,
  type CrawlResult,
  type NewsCategory,
  type NewsHeadline,
} from '../lib/newsCrawler';

const PREFS_KEY = 'cloudcast:news-prefs:v1';

export interface NewsCrawlerPrefs {
  sourceIds: string[];
  categories: NewsCategory[];
  intervalMinutes: number;
}

const DEFAULT_PREFS: NewsCrawlerPrefs = {
  sourceIds: ['bbc-world', 'cnn-top', 'ap-world', 'google-business', 'google-tech', 'espn'],
  categories: ['world', 'business', 'tech', 'sports'],
  intervalMinutes: 5,
};

function readPrefs(): NewsCrawlerPrefs {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PREFS_KEY) : null;
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<NewsCrawlerPrefs>;
    return {
      sourceIds: Array.isArray(parsed.sourceIds) && parsed.sourceIds.length ? parsed.sourceIds : DEFAULT_PREFS.sourceIds,
      categories: Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : DEFAULT_PREFS.categories,
      intervalMinutes: Number(parsed.intervalMinutes) > 0 ? Number(parsed.intervalMinutes) : DEFAULT_PREFS.intervalMinutes,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(prefs: NewsCrawlerPrefs): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* best effort */
  }
}

export interface UseNewsCrawlerResult {
  headlines: NewsHeadline[];
  loading: boolean;
  fromCache: boolean;
  lastUpdated: number | null;
  error: string | null;
  refresh: () => Promise<void>;
  prefs: NewsCrawlerPrefs;
  setSourceIds: (ids: string[]) => void;
  setCategories: (categories: NewsCategory[]) => void;
  setIntervalMinutes: (minutes: number) => void;
}

/**
 * Live news rundown for the broadcast graphics stack: auto-refreshing
 * headline queue with persisted feed preferences and cache fallback.
 */
export function useNewsCrawler(enabled = true): UseNewsCrawlerResult {
  const [prefs, setPrefs] = useState<NewsCrawlerPrefs>(readPrefs);
  const [headlines, setHeadlines] = useState<NewsHeadline[]>(() => {
    const cached = readNewsCache();
    return cached && isCacheFresh(cached) ? cached : [];
  });
  const [loading, setLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setLoading(true);
    setError(null);
    try {
      const sources = NEWS_SOURCES.filter((s) => prefs.sourceIds.includes(s.id));
      const result: CrawlResult = await crawlNews(sources, {
        categories: prefs.categories,
        limit: 60,
      });
      if (result.headlines.length) {
        setHeadlines(result.headlines);
        setFromCache(result.fromCache);
        setLastUpdated(Date.now());
      } else {
        setError('No headlines returned. Retrying on the next refresh.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'News crawl failed.');
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, [prefs]);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial crawl + polling refresh are the point of this hook
    void refresh();
    const timer = setInterval(() => void refresh(), Math.max(1, prefs.intervalMinutes) * 60_000);
    return () => clearInterval(timer);
  }, [enabled, prefs.intervalMinutes, prefs.sourceIds, prefs.categories, refresh]);

  const update = useCallback((patch: Partial<NewsCrawlerPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      writePrefs(next);
      return next;
    });
  }, []);

  return {
    headlines,
    loading,
    fromCache,
    lastUpdated,
    error,
    refresh,
    prefs,
    setSourceIds: (ids) => update({ sourceIds: ids }),
    setCategories: (categories) => update({ categories }),
    setIntervalMinutes: (minutes) => update({ intervalMinutes: minutes }),
  };
}
