/** Virtual video input — interactive Browser Shot (web / YouTube). */
export const REGAL_BROWSER_DEVICE_ID = 'regal-browser-feed';

export type BrowserFeedRole = 'pst' | 'pgm' | 'strip' | 'panel';

export interface BrowserFeedState {
  /** Raw address bar value (may omit protocol). */
  urlInput: string;
  /** Normalized navigate URL, or empty when idle. */
  activeUrl: string;
  /** Embed-ready URL (YouTube → /embed/). */
  embedUrl: string;
  muted: boolean;
  /** Allow pointer events on the browser surface (skip ads, close popups). */
  interactive: boolean;
  /** Allow interaction while the shot is on PGM (on-air). */
  interactiveOnPgm: boolean;
  /** Bumps to force iframe reload. */
  reloadToken: number;
}

export const DEFAULT_BROWSER_FEED_STATE: BrowserFeedState = {
  urlInput: '',
  activeUrl: '',
  embedUrl: '',
  muted: false,
  interactive: true,
  interactiveOnPgm: true,
  reloadToken: 0,
};

export const BROWSER_FEED_STORAGE_KEY = 'cloudcast.browserFeed.v1';
