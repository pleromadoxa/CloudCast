import type { CrawlerSettings, CrawlerStyle, TickerLine, TickerLineBackground } from '../../types/overlays';
import { cn } from '../../lib/utils';

const STYLE_CLASS: Record<CrawlerStyle, string> = {
  'news-red': 'bg-gradient-to-r from-red-700 to-red-900 text-white',
  'sport-black': 'bg-black text-amber-400 border-t-2 border-amber-500',
  minimal: 'bg-black/60 text-white/90 backdrop-blur-sm',
};

const SPEED_CLASS: Record<TickerLine['speed'], string> = {
  1: 'animate-cloudcast-crawl-slow',
  2: 'animate-cloudcast-crawl',
  3: 'animate-cloudcast-crawl-fast',
};

const LINE_HEIGHT: Record<TickerLine['height'], string> = {
  sm: 'py-0.5',
  md: 'py-1',
  lg: 'py-1.5',
};

const LINE_BACKGROUND: Record<TickerLineBackground, { shell: string; text: string }> = {
  auto: { shell: '', text: '' },
  dark: { shell: 'bg-slate-950/85 text-white', text: '' },
  light: { shell: 'bg-slate-100/95 text-slate-900', text: '' },
  red: { shell: 'bg-gradient-to-r from-red-700 to-red-900 text-white', text: '' },
  blue: { shell: 'bg-gradient-to-r from-blue-800 to-blue-950 text-white', text: '' },
  amber: { shell: 'bg-gradient-to-r from-amber-600 to-amber-800 text-slate-950', text: '' },
  transparent: { shell: 'bg-black/35 text-white backdrop-blur-sm', text: '' },
};

interface NewsCrawlerProps {
  crawler: CrawlerSettings;
}

function TickerRow({ line, crawler }: { line: TickerLine; crawler: CrawlerSettings }) {
  const preset = LINE_BACKGROUND[line.background];
  const auto = line.background === 'auto';
  return (
    <div
      className={cn(
        'relative flex items-center overflow-hidden',
        LINE_HEIGHT[line.height],
        auto ? STYLE_CLASS[crawler.style] : preset.shell,
      )}
    >
      {crawler.breaking && (
        <span className="animate-cloudcast-breaking-flash z-10 flex h-full shrink-0 items-center bg-red-600 px-2 text-[9px] font-black uppercase tracking-[0.24em] text-white">
          Breaking
        </span>
      )}
      <div
        className={cn('whitespace-nowrap px-4 font-semibold uppercase tracking-wide', SPEED_CLASS[line.speed])}
        style={{ fontSize: `${11 * (line.fontScale / 100)}px` }}
      >
        {line.text} &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; {line.text}
      </div>
    </div>
  );
}

/** Broadcast ticker stack — multiple independent lines with BREAKING flash mode. */
export function NewsCrawler({ crawler }: NewsCrawlerProps) {
  const activeLines = crawler.lines.filter((line) => line.enabled && line.text.trim());

  if (activeLines.length === 0) {
    if (!crawler.text.trim()) return null;
    // Legacy single-line crawl (pre multi-line settings).
    return (
      <div className={cn('absolute bottom-0 left-0 right-0 z-[18] overflow-hidden', STYLE_CLASS[crawler.style])}>
        <div className={cn('whitespace-nowrap px-4 py-1 text-[11px] font-semibold uppercase tracking-wide', SPEED_CLASS[crawler.speed])}>
          {crawler.text} &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; {crawler.text}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[18] overflow-hidden shadow-[0_-6px_18px_rgba(0,0,0,0.35)]">
      {activeLines.map((line, index) => (
        <TickerRow key={line.id || index} line={line} crawler={crawler} />
      ))}
    </div>
  );
}
