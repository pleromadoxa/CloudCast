import { useState } from 'react';
import {
  ExternalLink,
  Globe,
  MousePointer2,
  MousePointerClick,
  RefreshCw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useBrowserFeed } from '../../../context/BrowserFeedContext';
import { BrowserFeedPlayer } from '../../browser/BrowserFeedPlayer';
import { cn } from '../../../lib/utils';

interface BrowserPanelProps {
  compact?: boolean;
  onPreviewBrowser?: () => void;
  onTakeBrowser?: () => void;
}

export function BrowserPanel({
  compact = false,
  onPreviewBrowser,
  onTakeBrowser,
}: BrowserPanelProps) {
  const browser = useBrowserFeed();
  const [error, setError] = useState<string | null>(null);

  const submit = (raw?: string) => {
    const result = browser.navigate(raw);
    if (!result.ok) {
      setError(result.error ?? 'Could not open URL.');
      return;
    }
    setError(null);
    onPreviewBrowser?.();
  };

  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-2 p-2', compact && 'text-[11px]')}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-mixer-muted">
        <Globe className="h-3.5 w-3.5 text-sky-400" />
        Browser Shot
      </div>
      <p className="text-[10px] leading-snug text-mixer-muted">
        Open a webpage or YouTube link, interact on the shot (skip ads, close popups), then take to
        PGM. Mute follows the Browser channel on the audio bus.
      </p>

      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          value={browser.state.urlInput}
          onChange={(e) => {
            browser.setUrlInput(e.target.value);
            if (error) setError(null);
          }}
          placeholder="https://… or YouTube URL"
          className="min-w-0 flex-1 rounded border border-white/10 bg-black px-2 py-1.5 text-xs outline-none focus:border-sky-500/50"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button
          type="submit"
          className="rounded bg-sky-600/90 px-2.5 py-1.5 text-[10px] font-bold tracking-wider text-white hover:bg-sky-500"
        >
          GO
        </button>
      </form>

      {error && (
        <p className="rounded border border-mixer-red/30 bg-mixer-red/10 px-2 py-1 text-[10px] text-mixer-red">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => browser.reload()}
          disabled={!browser.state.embedUrl}
          className="mixer-btn inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold disabled:opacity-40"
          title="Reload page"
        >
          <RefreshCw className="h-3 w-3" /> Reload
        </button>
        <button
          type="button"
          onClick={() => browser.toggleMuted()}
          className={cn(
            'mixer-btn inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold',
            !browser.effectiveMuted && 'ring-1 ring-sky-400/50',
          )}
          title={browser.effectiveMuted ? 'Unmute' : 'Mute'}
        >
          {browser.effectiveMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
          {browser.effectiveMuted ? 'Muted' : 'Audio'}
        </button>
        <button
          type="button"
          onClick={() => browser.setInteractive(!browser.state.interactive)}
          className={cn(
            'mixer-btn inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold',
            browser.state.interactive && 'ring-1 ring-sky-400/50',
          )}
          title="Allow clicking inside the web page"
        >
          {browser.state.interactive ? (
            <MousePointerClick className="h-3 w-3" />
          ) : (
            <MousePointer2 className="h-3 w-3" />
          )}
          {browser.state.interactive ? 'Interact' : 'Locked'}
        </button>
        <button
          type="button"
          onClick={() => browser.clear()}
          disabled={!browser.state.embedUrl && !browser.state.urlInput}
          className="mixer-btn inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold disabled:opacity-40"
        >
          <X className="h-3 w-3" /> Clear
        </button>
        {browser.state.activeUrl && (
          <a
            href={browser.state.activeUrl}
            target="_blank"
            rel="noreferrer"
            className="mixer-btn inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold"
          >
            <ExternalLink className="h-3 w-3" /> Open
          </a>
        )}
      </div>

      <label className="flex items-center gap-2 text-[10px] text-mixer-muted">
        <input
          type="checkbox"
          checked={browser.state.interactiveOnPgm}
          onChange={(e) => browser.setInteractiveOnPgm(e.target.checked)}
          className="rounded border-white/20"
        />
        Allow interaction while on PGM (skip ads / close popups on air)
      </label>

      <div className="relative min-h-[140px] flex-1 overflow-hidden rounded border border-white/10 bg-black">
        <BrowserFeedPlayer feedRole="panel" showLabel className="absolute inset-0" />
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => {
            if (!browser.state.embedUrl) {
              submit();
              return;
            }
            onPreviewBrowser?.();
          }}
          className="mixer-btn flex-1 py-2 text-[10px] font-bold tracking-wider"
        >
          Preview (PST)
        </button>
        <button
          type="button"
          onClick={() => {
            if (!browser.state.embedUrl) {
              const result = browser.navigate();
              if (!result.ok) {
                setError(result.error ?? 'Could not open URL.');
                return;
              }
            }
            onTakeBrowser?.();
          }}
          className="flex-1 rounded bg-mixer-red/90 py-2 text-[10px] font-bold tracking-wider text-white hover:bg-mixer-red"
        >
          Take to PGM
        </button>
      </div>

      {browser.urlKind === 'youtube' && (
        <p className="text-[9px] text-mixer-muted">
          YouTube detected — mute/unmute uses the embed API. Click inside the shot to skip ads or
          open video settings.
        </p>
      )}
      {browser.urlKind === 'generic' && browser.state.embedUrl && (
        <p className="text-[9px] text-mixer-muted">
          Some sites block embedding. If the shot stays blank, open the page in a new tab or use a
          share/embed link. Mute is best-effort outside YouTube.
        </p>
      )}
    </div>
  );
}
