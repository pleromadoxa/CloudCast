import { useEffect, useMemo, useState } from 'react';
import { Newspaper, Radio, RefreshCw, Sparkles, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  NEWS_CATEGORY_LABELS,
  NEWS_SOURCES,
  type NewsCategory,
} from '../../lib/newsCrawler';
import { useNewsCrawler } from '../../hooks/useNewsCrawler';
import type {
  StudioGraphicContent,
  StudioScreenSlot,
  StudioScreenSource,
} from '../../lib/virtualStudio/types';

const CRAWL_STYLES: {
  id: 'breaking' | 'crawler' | 'headline' | 'strap';
  label: string;
  base: Partial<StudioGraphicContent> & { style: StudioGraphicContent['style'] };
}[] = [
  {
    id: 'breaking',
    label: 'BREAKING',
    base: { style: 'breaking', accent: '#c8102e', background: '#070a12', animated: true },
  },
  {
    id: 'crawler',
    label: 'NEWS CRAWL',
    base: { style: 'crawler', accent: '#c8102e', background: '#0a1226', animated: true, source: 'REGAL NEWS', role: 'BREAKING' },
  },
  {
    id: 'headline',
    label: 'TOP STORIES',
    base: { style: 'headline', accent: '#c8102e', background: '#0c1526', text: 'TOP STORIES', source: 'REGAL NEWS' },
  },
  {
    id: 'strap',
    label: 'NAME STRAP',
    base: { style: 'strap', accent: '#e11d48', background: '#0b1020' },
  },
];

type CrawlStyleId = 'breaking' | 'crawler' | 'headline' | 'strap';

interface NewsGraphicsPanelProps {
  screens: StudioScreenSlot[];
  bindings: Record<string, StudioScreenSource>;
  onApplyGraphic: (slotId: string, content: StudioGraphicContent) => void;
  onClearGraphic: (slotId: string) => void;
}

/**
 * NEWS & GRAPHICS STUDIO — the rundown desk: live wire feeds on the left,
 * broadcast overlay composer on the right, one-click push to any studio
 * screen (LED wall, ribbons, banners, TVs).
 */
export function NewsGraphicsPanel({ screens, bindings, onApplyGraphic, onClearGraphic }: NewsGraphicsPanelProps) {
  const { headlines, loading, fromCache, lastUpdated, error, refresh, prefs, setSourceIds, setCategories, setIntervalMinutes } =
    useNewsCrawler();

  const [styleId, setStyleId] = useState<CrawlStyleId>('breaking');
  const [headline, setHeadline] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [sourceBug, setSourceBug] = useState('REGAL NEWS');
  const [customItems, setCustomItems] = useState<string[]>([]);
  const [useLiveNews, setUseLiveNews] = useState(true);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [targetSlotId, setTargetSlotId] = useState<string>(screens[0]?.id ?? '');
  const [accent, setAccent] = useState('#c8102e');
  const [pushedLabel, setPushedLabel] = useState<string | null>(null);

  const styleBase = CRAWL_STYLES.find((s) => s.id === styleId)?.base ?? CRAWL_STYLES[0].base;

  const liveTitles = useMemo(() => headlines.map((h) => h.title).slice(0, 8), [headlines]);

  const buildContent = (overrideItems?: string[]): StudioGraphicContent => {
    const items = overrideItems ?? (useLiveNews && liveTitles.length ? liveTitles : customItems);
    return {
      style: styleBase.style,
      text:
        headline ||
        (styleId === 'crawler' ? 'WORLD NEWS ROUNDUP' : styleId === 'headline' ? 'TOP STORIES' : 'BREAKING STORY'),
      name: name || undefined,
      role: role || undefined,
      source: sourceBug || undefined,
      items: items.length ? items : undefined,
      accent,
      background: styleBase.background,
      foreground: '#ffffff',
      animated: Boolean(styleBase.animated),
    };
  };

  const [onAirSlotId, setOnAirSlotId] = useState<string | null>(null);

  const pushTo = (slotId: string, overrideItems?: string[]) => {
    if (!slotId) return;
    onApplyGraphic(slotId, buildContent(overrideItems));
    setOnAirSlotId(slotId);
    setPushedLabel(screens.find((s) => s.id === slotId)?.label ?? slotId);
  };

  // Auto-refresh: when the wire updates, re-render the on-air crawl/rundown
  // with the fresh headlines so the ticker never goes stale on air.
  const liveKey = liveTitles.join('\u0000');
  useEffect(() => {
    if (!autoUpdate || !onAirSlotId || !useLiveNews) return;
    if (styleId !== 'crawler' && styleId !== 'headline') return;
    if (!liveTitles.length) return;
    onApplyGraphic(onAirSlotId, buildContent());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey]);

  const toggleSource = (id: string) => {
    const next = prefs.sourceIds.includes(id)
      ? prefs.sourceIds.filter((s) => s !== id)
      : [...prefs.sourceIds, id];
    if (next.length) setSourceIds(next);
  };

  const toggleCategory = (category: NewsCategory) => {
    const next = prefs.categories.includes(category)
      ? prefs.categories.filter((c) => c !== category)
      : [...prefs.categories, category];
    if (next.length) setCategories(next);
  };

  return (
    <section className="rounded border border-white/10 bg-black/40 p-2">
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-amber-400/90">
        <Newspaper className="h-3 w-3" /> NEWS &amp; GRAPHICS STUDIO
      </p>

      {/* ---- wire desk ---- */}
      <div className="rounded border border-white/10 bg-black/30 p-1.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[9px] font-bold tracking-wider text-mixer-muted">WIRE FEEDS</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-mixer-muted hover:border-amber-500/40 hover:text-amber-300"
          >
            <RefreshCw className={cn('h-2.5 w-2.5', loading && 'animate-spin')} /> REFRESH
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {NEWS_SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSource(s.id)}
              className={cn(
                'rounded border px-1 py-0.5 text-[8px] font-bold tracking-wider',
                prefs.sourceIds.includes(s.id)
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
                  : 'border-white/10 text-mixer-muted hover:text-white',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {(Object.keys(NEWS_CATEGORY_LABELS) as NewsCategory[]).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => toggleCategory(category)}
              className={cn(
                'rounded-full border px-1.5 py-0.5 text-[8px] font-bold tracking-wider',
                prefs.categories.includes(category)
                  ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                  : 'border-white/10 text-mixer-muted hover:text-white',
              )}
            >
              {NEWS_CATEGORY_LABELS[category]}
            </button>
          ))}
          <select
            value={prefs.intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            className="ml-auto rounded border border-white/10 bg-black px-1 py-0.5 text-[8px] text-mixer-muted"
          >
            <option value={1}>every 1m</option>
            <option value={2}>every 2m</option>
            <option value={5}>every 5m</option>
            <option value={10}>every 10m</option>
            <option value={15}>every 15m</option>
          </select>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[8px] text-mixer-muted">
          <span className="flex items-center gap-1">
            <span className={cn('h-1.5 w-1.5 rounded-full', loading ? 'bg-amber-400' : fromCache ? 'bg-orange-400' : 'bg-emerald-400')} />
            {loading ? 'Crawling wires…' : fromCache ? 'Cached rundown' : 'Wire live'}
          </span>
          {lastUpdated && <span>updated {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          <span>{headlines.length} stories</span>
        </div>
        {error && <p className="mt-1 text-[8px] text-mixer-red">{error}</p>}

        {/* rundown queue */}
        <div className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto">
          {headlines.slice(0, 10).map((h, i) => (
            <div key={h.id} className="flex items-start gap-1 rounded px-1 py-0.5 hover:bg-white/5">
              <span className="mt-0.5 shrink-0 rounded bg-white/10 px-1 text-[7px] font-bold text-mixer-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 text-[9px] leading-snug">{h.title}</span>
              <span className="shrink-0 rounded bg-white/10 px-1 text-[7px] font-bold text-mixer-muted">{h.sourceLabel}</span>
              <button
                type="button"
                title="Add to custom rundown"
                onClick={() => setCustomItems((prev) => [...prev, h.title])}
                className="shrink-0 rounded border border-white/10 px-1 text-[7px] text-mixer-muted hover:border-amber-500/40 hover:text-amber-300"
              >
                +
              </button>
            </div>
          ))}
          {!headlines.length && !loading && (
            <p className="px-1 text-[9px] text-mixer-muted">No stories yet — hit REFRESH to crawl the wires.</p>
          )}
        </div>
      </div>

      {/* ---- overlay composer ---- */}
      <div className="mt-2 rounded border border-white/10 bg-black/30 p-1.5">
        <div className="mb-1 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-400" />
          <span className="text-[9px] font-bold tracking-wider text-mixer-muted">BROADCAST OVERLAY</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {CRAWL_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyleId(s.id)}
              className={cn(
                'rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-wider',
                styleId === s.id
                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                  : 'border-white/10 text-mixer-muted hover:text-white',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder={styleId === 'headline' ? 'Rundown header' : 'Headline'}
          className="mt-1.5 w-full rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
        />
        <div className="mt-1 flex items-center gap-1">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name / strap label"
            className="min-w-0 flex-1 rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
          />
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Role / tag"
            className="min-w-0 flex-1 rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
          />
        </div>
        <div className="mt-1 flex items-center gap-1">
          <input
            type="text"
            value={sourceBug}
            onChange={(e) => setSourceBug(e.target.value)}
            placeholder="Channel bug"
            className="min-w-0 flex-1 rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
          />
          <label className="flex shrink-0 items-center gap-1 text-[8px] font-bold tracking-wider text-mixer-muted">
            ACCENT
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-5 w-7 cursor-pointer rounded border border-white/10 bg-black"
            />
          </label>
        </div>

        {(styleId === 'crawler' || styleId === 'headline') && (
          <>
            <label className="mt-1.5 flex items-center gap-1.5 text-[9px] text-mixer-muted">
              <input type="checkbox" checked={useLiveNews} onChange={(e) => setUseLiveNews(e.target.checked)} />
              Use live wire headlines ({liveTitles.length} ready)
            </label>
            {!useLiveNews && (
              <textarea
                value={customItems.join('\n')}
                onChange={(e) =>
                  setCustomItems(
                    e.target.value
                      .split('\n')
                      .map((l) => l.trim())
                      .filter(Boolean),
                  )
                }
                rows={3}
                placeholder="Rundown lines — one per line"
                className="mt-1 w-full resize-y rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
              />
            )}
            {useLiveNews && customItems.length > 0 && (
              <p className="mt-1 text-[8px] text-mixer-muted">
                {customItems.length} custom line{customItems.length === 1 ? '' : 's'} held for manual mode.
              </p>
            )}
          </>
        )}

        {/* push controls */}
        <div className="mt-1.5 flex items-center gap-1">
          <select
            value={targetSlotId}
            onChange={(e) => setTargetSlotId(e.target.value)}
            className="min-w-0 flex-1 rounded border border-white/10 bg-black px-1.5 py-1 text-[10px] outline-none focus:border-amber-500/40"
          >
            {screens.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => pushTo(targetSlotId)}
            disabled={!targetSlotId}
            className="flex shrink-0 items-center gap-1 rounded bg-amber-500 px-2 py-1 text-[9px] font-bold tracking-wider text-black hover:bg-amber-400 disabled:opacity-50"
          >
            <Zap className="h-3 w-3" /> PUSH ON AIR
          </button>
          <button
            type="button"
            title="Clear the graphic from this screen"
            onClick={() => {
              if (targetSlotId) {
                onClearGraphic(targetSlotId);
                setPushedLabel(null);
              }
            }}
            className="shrink-0 rounded border border-white/10 px-1.5 py-1 text-[9px] text-mixer-muted hover:border-mixer-red/50 hover:text-mixer-red"
          >
            CLEAR
          </button>
        </div>
        <label className="mt-1.5 flex items-center gap-1.5 text-[9px] text-mixer-muted">
          <input
            type="checkbox"
            checked={autoUpdate}
            onChange={(e) => setAutoUpdate(e.target.checked)}
          />
          Auto-refresh the on-air graphic when the wire updates
        </label>
        {pushedLabel && (
          <p className="mt-1 flex items-center gap-1 text-[8px] text-emerald-300">
            <Radio className="h-2.5 w-2.5" /> On air on “{pushedLabel}”
            {bindings[targetSlotId]?.kind === 'graphic' ? ' ✓' : ''}
          </p>
        )}
        <p className="mt-1 text-[8px] leading-snug text-mixer-muted">
          Overlays render live onto the studio screens in 3D — breaking banners, crawling tickers,
          stacked rundowns and name straps at broadcast quality.
        </p>
      </div>
    </section>
  );
}
