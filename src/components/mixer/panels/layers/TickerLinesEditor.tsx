import { useState } from 'react';
import { Plus, Radio, Trash2 } from 'lucide-react';
import type { LayerSettings } from '../../../../types/mixer';
import type { TickerLine, TickerLineBackground, TickerLineHeight } from '../../../../types/overlays';
import { MAX_TICKER_LINES, createTickerLine } from '../../../../types/overlays';
import {
  NEWS_SOURCES,
  crawlLineFromHeadlines,
  crawlNews,
} from '../../../../lib/newsCrawler';
import { cn } from '../../../../lib/utils';

interface TickerLinesEditorProps {
  layers: LayerSettings;
  onPatch: (partial: Partial<LayerSettings>) => void;
}

const BACKGROUNDS: TickerLineBackground[] = [
  'auto',
  'dark',
  'light',
  'red',
  'blue',
  'amber',
  'transparent',
];
const HEIGHTS: TickerLineHeight[] = ['sm', 'md', 'lg'];

export function TickerLinesEditor({ layers, onPatch }: TickerLinesEditorProps) {
  const crawler = layers.crawler;
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const patchLine = (index: number, patch: Partial<TickerLine>) =>
    onPatch({
      crawler: {
        ...crawler,
        lines: crawler.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
      },
    });

  /** Pulls a live rundown from the wires and fills the first enabled ticker line. */
  const loadLiveHeadlines = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const result = await crawlNews(NEWS_SOURCES.slice(0, 8), { limit: 24 });
      if (!result.headlines.length) {
        setStatus('No headlines returned — try again.');
        return;
      }
      const line = crawlLineFromHeadlines(result.headlines);
      const targetIndex = Math.max(
        0,
        crawler.lines.findIndex((l) => l.enabled),
      );
      if (crawler.lines.length === 0) {
        onPatch({ crawler: { ...crawler, lines: [createTickerLine(line)] } });
      } else {
        patchLine(targetIndex, { text: line });
      }
      setStatus(
        `${result.headlines.length} headlines loaded${result.fromCache ? ' (from cache)' : ''}.`,
      );
    } catch {
      setStatus('Headline crawl failed — check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="layer-editor-card flex flex-col gap-2">
      <div className="layer-editor-section">
        <div className="flex items-center justify-between">
          <p className="layer-editor-section-label">Ticker lines ({crawler.lines.length}/{MAX_TICKER_LINES})</p>
          <button
            type="button"
            className="mixer-btn px-2 py-0.5 text-[8px]"
            onClick={() => void loadLiveHeadlines()}
            disabled={loading}
          >
            <Radio className="inline h-3 w-3" /> {loading ? 'Crawling…' : 'Load live headlines'}
          </button>
        </div>
        {status && <p className="mt-0.5 text-[8px] text-mixer-green">{status}</p>}

        <div className="mt-1 flex flex-col gap-1">
          {crawler.lines.map((line, index) => (
            <div key={line.id || index} className="rounded border border-mixer-border bg-black/20 p-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={line.enabled}
                  title="Enable line"
                  onChange={(e) => patchLine(index, { enabled: e.target.checked })}
                />
                <input
                  className="layer-field-input flex-1 px-1 py-0.5 text-[8px]"
                  placeholder={`Ticker line ${index + 1}`}
                  value={line.text}
                  onChange={(e) => patchLine(index, { text: e.target.value })}
                />
                {crawler.lines.length > 1 && (
                  <button
                    type="button"
                    className="text-mixer-muted hover:text-red-400"
                    onClick={() =>
                      onPatch({ crawler: { ...crawler, lines: crawler.lines.filter((_, i) => i !== index) } })
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <select
                  className="layer-field-input w-16 px-1 py-0.5 text-[8px]"
                  value={line.height}
                  onChange={(e) => patchLine(index, { height: e.target.value as TickerLineHeight })}
                >
                  {HEIGHTS.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <select
                  className="layer-field-input w-20 px-1 py-0.5 text-[8px]"
                  value={line.background}
                  onChange={(e) => patchLine(index, { background: e.target.value as TickerLineBackground })}
                >
                  {BACKGROUNDS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-[8px] text-mixer-muted">
                  Speed
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={1}
                    className="w-12"
                    value={line.speed}
                    onChange={(e) => patchLine(index, { speed: Number(e.target.value) as 1 | 2 | 3 })}
                  />
                </label>
                <label className="flex items-center gap-1 text-[8px] text-mixer-muted">
                  Font
                  <input
                    type="range"
                    min={80}
                    max={180}
                    step={5}
                    className="w-12"
                    value={line.fontScale}
                    onChange={(e) => patchLine(index, { fontScale: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        {crawler.lines.length < MAX_TICKER_LINES && (
          <button
            type="button"
            className="mixer-btn mt-1 flex w-full items-center justify-center gap-1 py-1 text-[8px]"
            onClick={() =>
              onPatch({ crawler: { ...crawler, lines: [...crawler.lines, createTickerLine('')] } })
            }
          >
            <Plus className="h-3 w-3" /> Add ticker line
          </button>
        )}
      </div>

      <div className="layer-editor-section">
        <p className="layer-editor-section-label">Treatment</p>
        <label className="flex items-center gap-2 text-[9px]">
          <input
            type="checkbox"
            checked={crawler.breaking}
            onChange={(e) => onPatch({ crawler: { ...crawler, breaking: e.target.checked } })}
          />
          BREAKING flash mode
        </label>
        <div className="mt-1 flex flex-wrap gap-1">
          {(['news-red', 'sport-black', 'minimal'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPatch({ crawler: { ...crawler, style: s } })}
              className={cn('mixer-btn px-2 py-1 text-[8px]', crawler.style === s && 'mixer-btn-active')}
            >
              {s.replace('-', ' ')}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[8px] text-mixer-green">
          Style preset applies to lines set to &ldquo;auto&rdquo; background.
        </p>
      </div>
    </div>
  );
}
