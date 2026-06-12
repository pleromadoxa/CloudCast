import type { CrawlerSettings } from '../../types/overlays';
import { cn } from '../../lib/utils';

const STYLE_CLASS: Record<CrawlerSettings['style'], string> = {
  'news-red': 'bg-gradient-to-r from-red-700 to-red-900 text-white',
  'sport-black': 'bg-black text-amber-400 border-t-2 border-amber-500',
  minimal: 'bg-black/60 text-white/90 backdrop-blur-sm',
};

const SPEED_CLASS: Record<CrawlerSettings['speed'], string> = {
  1: 'animate-cloudcast-crawl-slow',
  2: 'animate-cloudcast-crawl',
  3: 'animate-cloudcast-crawl-fast',
};

interface NewsCrawlerProps {
  crawler: CrawlerSettings;
}

export function NewsCrawler({ crawler }: NewsCrawlerProps) {
  if (!crawler.text.trim()) return null;

  return (
    <div className={cn('absolute bottom-0 left-0 right-0 z-[18] overflow-hidden py-1', STYLE_CLASS[crawler.style])}>
      <div className={cn('whitespace-nowrap px-4 text-[11px] font-semibold uppercase tracking-wide', SPEED_CLASS[crawler.speed])}>
        {crawler.text} &nbsp;&nbsp;&nbsp; • &nbsp;&nbsp;&nbsp; {crawler.text}
      </div>
    </div>
  );
}
