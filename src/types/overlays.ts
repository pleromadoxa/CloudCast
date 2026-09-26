export type OverlayPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

export type LowerThirdTemplateId =
  | 'broadcast-red'
  | 'news-blue'
  | 'alert-orange'
  | 'midnight-desk'
  | 'white-house'
  | 'global-wire'
  | 'field-report'
  | 'anchor-desk'
  | 'sport-gold'
  | 'stadium-green'
  | 'racing-checker'
  | 'esports-neon'
  | 'corporate-navy'
  | 'slate-brief'
  | 'executive-gold'
  | 'startup-clean'
  | 'live-gradient'
  | 'twitch-purple'
  | 'youtube-red'
  | 'podcast-warm'
  | 'minimal-white'
  | 'glass-frost'
  | 'retro-crt'
  | 'cinema-dark';

export type LowerThirdCategory = 'news' | 'sports' | 'corporate' | 'live' | 'creative';

export type LowerThirdLayout =
  | 'accent-top'
  | 'side-stripe'
  | 'sport-split'
  | 'glass-minimal'
  | 'corporate-stripe'
  | 'pill-live'
  | 'solid-bar'
  | 'double-rule'
  | 'angled-ribbon'
  | 'neon-glow'
  | 'split-duo'
  | 'outline-box';

export type LowerThirdFontSize = 'sm' | 'md' | 'lg';

export type LowerThirdPosition = 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface LowerThirdCustomization {
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  subtextColor: string;
  uppercase: boolean;
  fontSize: LowerThirdFontSize;
  position: LowerThirdPosition;
  /** Horizontal center on canvas (0–100). Derived from position when unset. */
  xPercent?: number;
  opacity: number;
  borderRadius: 'none' | 'sm' | 'md' | 'full';
  showLiveBadge: boolean;
  /** Operator-uploaded logo shown on the lower-third plate (data URL). */
  logoDataUrl?: string | null;
  /** Logo height as a percent of the plate text height (40–200). */
  logoScale?: number;
}

export type CrawlerStyle = 'news-red' | 'sport-black' | 'minimal';

/** Per-ticker-line background treatment. 'auto' follows the crawler style preset. */
export type TickerLineBackground =
  | 'auto'
  | 'dark'
  | 'light'
  | 'red'
  | 'blue'
  | 'amber'
  | 'transparent';

export type TickerLineHeight = 'sm' | 'md' | 'lg';

/** One independent scrolling ticker line in the upgraded crawler stack. */
export interface TickerLine {
  id: string;
  text: string;
  enabled: boolean;
  /** Scroll speed — 1 slow, 2 normal, 3 fast. */
  speed: 1 | 2 | 3;
  height: TickerLineHeight;
  background: TickerLineBackground;
  /** Font scale percent (80–180). */
  fontScale: number;
}

export interface CrawlerSettings {
  text: string;
  speed: 1 | 2 | 3;
  style: CrawlerStyle;
  /** Independent ticker lines (front to back). `text` is the legacy single line. */
  lines: TickerLine[];
  /** BREAKING flash treatment on the ticker stack. */
  breaking: boolean;
}

export const MAX_TICKER_LINES = 4;

export function createTickerLine(text = ''): TickerLine {
  return {
    id: crypto.randomUUID(),
    text,
    enabled: true,
    speed: 2,
    height: 'md',
    background: 'auto',
    fontScale: 100,
  };
}

export type TransitionGraphicType = 'breaking' | 'coming-up' | 'sports' | 'weather';

export const STINGER_TYPE_DEFAULTS: Record<
  TransitionGraphicType,
  { title: string; headline: string }
> = {
  breaking: { title: 'BREAKING NEWS', headline: 'LIVE COVERAGE' },
  'coming-up': { title: 'COMING UP', headline: 'STAY TUNED' },
  sports: { title: 'SPORTS', headline: 'GAME DAY' },
  weather: { title: 'WEATHER', headline: 'FORECAST' },
};

export interface ImageOverlay {
  id: string;
  name: string;
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  scale: number;
  opacity: number;
  position: OverlayPosition;
  xPercent?: number;
  yPercent?: number;
  visible: boolean;
  liveOnPgm: boolean;
  /** Cover the full frame (program fill) instead of positioned overlay. */
  fillScreen?: boolean;
}

export interface VideoMediaOverlay {
  id: string;
  name: string;
  /** Playback URL (cloud presigned or blob). */
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  scale: number;
  opacity: number;
  position: OverlayPosition;
  xPercent?: number;
  yPercent?: number;
  visible: boolean;
  liveOnPgm: boolean;
  /** Cover the full frame (program fill) instead of positioned overlay. */
  fillScreen: boolean;
  loop: boolean;
  muted: boolean;
}

export interface MediaLibraryItem {
  id: string;
  name: string;
  kind: 'image' | 'video';
  /** Runtime playback URL — presigned cloud or local blob. */
  playUrl: string;
  /** Optional inline thumbnail (small images only; not persisted for video). */
  thumbUrl?: string;
  /** @deprecated Use playUrl — kept for preset migration. */
  dataUrl?: string;
  storagePath?: string;
  sizeBytes?: number;
  naturalWidth: number;
  naturalHeight: number;
  mimeType: string;
  createdAt: number;
}

export function resolveMediaPlayUrl(item: Pick<MediaLibraryItem, 'playUrl' | 'thumbUrl' | 'dataUrl'>): string {
  return item.playUrl || item.thumbUrl || item.dataUrl || '';
}

export interface ProgramLogoSettings {
  mode: 'text' | 'image';
  text: string;
  imageDataUrl: string | null;
  naturalWidth: number;
  naturalHeight: number;
  scale: number;
  opacity: number;
  position: OverlayPosition;
  xPercent?: number;
  yPercent?: number;
  showBackground: boolean;
}

export interface CrawlerSettings {
  text: string;
  speed: 1 | 2 | 3;
  style: CrawlerStyle;
}

export interface BreakingNewsSettings {
  headline: string;
}

export interface LiveButtonSettings {
  label: string;
  position: OverlayPosition;
  xPercent?: number;
  yPercent?: number;
  opacity: number;
  accentColor: string;
  backgroundColor: string;
  pulse: boolean;
}

export interface TransitionGraphicSettings {
  type: TransitionGraphicType;
  /** Small badge above the main line — e.g. BREAKING NEWS. */
  title: string;
  headline: string;
  firing: boolean;
}

export interface LowerThirdTemplate {
  id: LowerThirdTemplateId;
  label: string;
  description: string;
  category: LowerThirdCategory;
  layout: LowerThirdLayout;
  customization: LowerThirdCustomization;
}

/** User-saved customized lower third ready for production LIVE/OFF. */
export interface SavedLowerThirdPreset {
  id: string;
  name: string;
  templateId: LowerThirdTemplateId;
  customization: LowerThirdCustomization;
  headline: string;
  subline: string;
  updatedAt: number;
}

export const DEFAULT_LOWER_THIRD_CUSTOMIZATION: LowerThirdCustomization = {
  accentColor: '#dc2626',
  backgroundColor: 'rgba(0,0,0,0.85)',
  textColor: '#ffffff',
  subtextColor: 'rgba(255,255,255,0.75)',
  uppercase: true,
  fontSize: 'md',
  position: 'bottom-left',
  opacity: 100,
  borderRadius: 'none',
  showLiveBadge: false,
  logoDataUrl: null,
  logoScale: 100,
};

export const DEFAULT_PROGRAM_LOGO: ProgramLogoSettings = {
  mode: 'text',
  text: 'CLOUDCAST',
  imageDataUrl: null,
  naturalWidth: 0,
  naturalHeight: 0,
  scale: 40,
  opacity: 100,
  position: 'top-left',
  showBackground: true,
};

export const DEFAULT_CRAWLER: CrawlerSettings = {
  text: 'Breaking news updates rolling throughout the hour...',
  speed: 2,
  style: 'news-red',
  lines: [
    {
      id: 'ticker-line-1',
      text: 'Breaking news updates rolling throughout the hour...',
      enabled: true,
      speed: 2,
      height: 'md',
      background: 'auto',
      fontScale: 100,
    },
  ],
  breaking: false,
};

export const DEFAULT_TICKER_LINE: TickerLine = {
  id: 'ticker-line-new',
  text: '',
  enabled: true,
  speed: 2,
  height: 'md',
  background: 'auto',
  fontScale: 100,
};

/** Normalizes crawler settings — caps ticker lines and fills per-line fields. */
export function resolveCrawlerSettings(partial?: Partial<CrawlerSettings>): CrawlerSettings {
  const merged = { ...DEFAULT_CRAWLER, ...partial };
  const text = typeof merged.text === 'string' ? merged.text : DEFAULT_CRAWLER.text;
  // Legacy data (no lines array) seeds one line from the single-line `text` field.
  const rawLines = Array.isArray(partial?.lines) ? partial.lines : [];
  const source = rawLines.length ? rawLines : [{ ...DEFAULT_TICKER_LINE, id: 'ticker-line-1', text }];
  const lines: TickerLine[] = source.slice(0, MAX_TICKER_LINES).map((line, index) => ({
    id: line.id || `ticker-line-${index + 1}`,
    text: typeof line.text === 'string' ? line.text : '',
    enabled: line.enabled ?? true,
    speed: line.speed === 1 || line.speed === 3 ? line.speed : 2,
    height: line.height === 'sm' || line.height === 'lg' ? line.height : 'md',
    background: line.background ?? 'auto',
    fontScale: clampNumber(line.fontScale ?? 100, 80, 180),
  }));
  return {
    text: typeof merged.text === 'string' ? merged.text : DEFAULT_CRAWLER.text,
    speed: merged.speed === 1 || merged.speed === 3 ? merged.speed : 2,
    style: merged.style === 'sport-black' || merged.style === 'minimal' ? merged.style : 'news-red',
    lines,
    breaking: merged.breaking ?? false,
  };
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export const DEFAULT_BREAKING: BreakingNewsSettings = {
  headline: 'BREAKING NEWS',
};

export const DEFAULT_LIVE_BUTTON: LiveButtonSettings = {
  label: 'LIVE',
  position: 'top-right',
  opacity: 100,
  accentColor: '#ef4444',
  backgroundColor: 'rgba(0,0,0,0.8)',
  pulse: true,
};

export const DEFAULT_TRANSITION: TransitionGraphicSettings = {
  type: 'breaking',
  title: STINGER_TYPE_DEFAULTS.breaking.title,
  headline: STINGER_TYPE_DEFAULTS.breaking.headline,
  firing: false,
};

export function resolveTransitionGraphic(
  partial?: Partial<TransitionGraphicSettings>,
): TransitionGraphicSettings {
  const type = partial?.type ?? DEFAULT_TRANSITION.type;
  const defs = STINGER_TYPE_DEFAULTS[type];
  return {
    ...DEFAULT_TRANSITION,
    ...partial,
    type,
    title: partial?.title?.trim() || defs.title,
    headline: partial?.headline?.trim() || defs.headline,
    firing: partial?.firing ?? false,
  };
}

// ==========================================================================
// Live Production Graphics Pack — weather, ad-zone, scoreboard, countdown,
// sponsor bug. All fields are JSON-serializable (images are data URLs).
// ==========================================================================

// --------------------------------------------------------------------------
// Weather panel
// --------------------------------------------------------------------------

export type WeatherIconId =
  | 'sun'
  | 'cloud'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'wind'
  | 'fog';

export type WeatherPanelStyle = 'slate' | 'glass' | 'minimal' | 'ticker-pill';

export type TemperatureUnit = 'C' | 'F';

export interface WeatherForecastDay {
  day: string;
  icon: WeatherIconId;
  hi: number;
  lo: number;
}

export interface WeatherSettings {
  location: string;
  condition: string;
  temperature: number;
  unit: TemperatureUnit;
  icon: WeatherIconId;
  /** 4-day forecast strip (capped at 7 entries for storage). */
  forecast: WeatherForecastDay[];
  accentColor: string;
  style: WeatherPanelStyle;
  position: OverlayPosition;
  xPercent?: number;
  yPercent?: number;
  opacity: number;
  /** Live local clock in the panel header. */
  showClock: boolean;
}

export const MAX_WEATHER_FORECAST_DAYS = 7;

const WEATHER_ICONS: WeatherIconId[] = ['sun', 'cloud', 'rain', 'snow', 'storm', 'wind', 'fog'];

function resolveWeatherIcon(value: unknown): WeatherIconId {
  return WEATHER_ICONS.includes(value as WeatherIconId) ? (value as WeatherIconId) : 'sun';
}

function resolveWeatherDay(
  day: Partial<WeatherForecastDay>,
  index: number,
  fallbackIcon: WeatherIconId,
): WeatherForecastDay {
  const hi = Math.round(Number(day.hi));
  const lo = Math.round(Number(day.lo));
  return {
    day: typeof day.day === 'string' && day.day.trim() ? day.day.trim().slice(0, 12) : `Day ${index + 1}`,
    icon: day.icon ? resolveWeatherIcon(day.icon) : fallbackIcon,
    hi: clampNumber(hi || 0, -99, 99),
    lo: clampNumber(lo || 0, -99, 99),
  };
}

export const DEFAULT_WEATHER: WeatherSettings = {
  location: 'NEW YORK',
  condition: 'Partly Cloudy',
  temperature: 22,
  unit: 'C',
  icon: 'cloud',
  forecast: [
    { day: 'MON', icon: 'sun', hi: 26, lo: 18 },
    { day: 'TUE', icon: 'cloud', hi: 23, lo: 16 },
    { day: 'WED', icon: 'rain', hi: 19, lo: 13 },
    { day: 'THU', icon: 'storm', hi: 21, lo: 14 },
  ],
  accentColor: '#38bdf8',
  style: 'glass',
  position: 'top-right',
  opacity: 100,
  showClock: true,
};

export function resolveWeatherSettings(partial?: Partial<WeatherSettings>): WeatherSettings {
  const merged = { ...DEFAULT_WEATHER, ...partial };
  const icon = resolveWeatherIcon(merged.icon);
  const temperature = Math.round(Number(merged.temperature));
  const forecast = (Array.isArray(merged.forecast) ? merged.forecast : [])
    .slice(0, MAX_WEATHER_FORECAST_DAYS)
    .map((day, index) => resolveWeatherDay(day, index, icon));
  return {
    location: typeof merged.location === 'string' ? merged.location.slice(0, 48) : DEFAULT_WEATHER.location,
    condition: typeof merged.condition === 'string' ? merged.condition.slice(0, 48) : DEFAULT_WEATHER.condition,
    temperature: clampNumber(temperature || 0, -99, 99),
    unit: merged.unit === 'F' ? 'F' : 'C',
    icon,
    forecast,
    accentColor: merged.accentColor || DEFAULT_WEATHER.accentColor,
    style:
      merged.style === 'slate' || merged.style === 'minimal' || merged.style === 'ticker-pill'
        ? merged.style
        : 'glass',
    position: merged.position ?? DEFAULT_WEATHER.position,
    xPercent: merged.xPercent,
    yPercent: merged.yPercent,
    opacity: clampNumber(Number(merged.opacity ?? 100), 10, 100),
    showClock: merged.showClock ?? true,
  };
}

// --------------------------------------------------------------------------
// Ad / sponsor zone (image · live video PiP · rotating carousel)
// --------------------------------------------------------------------------

export type AdZoneSourceKind = 'image' | 'live-video' | 'carousel';

export type AdLiveVideoSource = 'none' | 'camera' | 'browser' | `media:${string}`;

export interface AdCarouselEntry {
  id: string;
  imageDataUrl: string;
  caption?: string;
  /** Seconds this creative stays on screen when auto-rotating. */
  durationSeconds: number;
}

export interface AdZoneSettings {
  adName: string;
  sourceKind: AdZoneSourceKind;
  imageDataUrl: string | null;
  liveVideoSource: AdLiveVideoSource;
  carousel: AdCarouselEntry[];
  /** Sponsor caption bar under the creative. */
  showCaptionBar: boolean;
  sponsorLabel: string;
  /** "AD" disclosure badge (broadcast compliance). */
  showAdBadge: boolean;
  position: OverlayPosition;
  xPercent?: number;
  yPercent?: number;
  /** Zone width as a percent of frame width (12–60). */
  widthPercent: number;
  opacity: number;
  /** Auto-rotate interval in seconds — used per carousel entry unless overridden. */
  rotateIntervalSeconds: number;
}

export const MAX_AD_CAROUSEL_ENTRIES = 6;

function resolveAdCarouselEntry(entry: Partial<AdCarouselEntry>, index: number): AdCarouselEntry {
  return {
    id: entry.id || `ad-creative-${index + 1}`,
    imageDataUrl: typeof entry.imageDataUrl === 'string' ? entry.imageDataUrl : '',
    caption: typeof entry.caption === 'string' ? entry.caption.slice(0, 64) : '',
    durationSeconds: clampNumber(Math.round(Number(entry.durationSeconds)) || 6, 2, 120),
  };
}

export const DEFAULT_AD_ZONE: AdZoneSettings = {
  adName: 'Sponsor Message',
  sourceKind: 'image',
  imageDataUrl: null,
  liveVideoSource: 'none',
  carousel: [],
  showCaptionBar: true,
  sponsorLabel: 'PRESENTED BY',
  showAdBadge: true,
  position: 'bottom-right',
  widthPercent: 28,
  opacity: 100,
  rotateIntervalSeconds: 6,
};

export function resolveAdZoneSettings(partial?: Partial<AdZoneSettings>): AdZoneSettings {
  const merged = { ...DEFAULT_AD_ZONE, ...partial };
  const carousel = (Array.isArray(merged.carousel) ? merged.carousel : [])
    .slice(0, MAX_AD_CAROUSEL_ENTRIES)
    .map(resolveAdCarouselEntry);
  const sourceKind: AdZoneSourceKind =
    merged.sourceKind === 'live-video' || merged.sourceKind === 'carousel'
      ? merged.sourceKind
      : 'image';
  const liveSource = merged.liveVideoSource ?? 'none';
  return {
    adName: typeof merged.adName === 'string' ? merged.adName.slice(0, 48) : DEFAULT_AD_ZONE.adName,
    sourceKind,
    imageDataUrl: typeof merged.imageDataUrl === 'string' ? merged.imageDataUrl : null,
    liveVideoSource:
      liveSource === 'camera' || liveSource === 'browser' || liveSource.startsWith('media:')
        ? liveSource
        : 'none',
    carousel,
    showCaptionBar: merged.showCaptionBar ?? true,
    sponsorLabel: typeof merged.sponsorLabel === 'string' ? merged.sponsorLabel.slice(0, 40) : DEFAULT_AD_ZONE.sponsorLabel,
    showAdBadge: merged.showAdBadge ?? true,
    position: merged.position ?? DEFAULT_AD_ZONE.position,
    xPercent: merged.xPercent,
    yPercent: merged.yPercent,
    widthPercent: clampNumber(Number(merged.widthPercent ?? 28), 12, 60),
    opacity: clampNumber(Number(merged.opacity ?? 100), 10, 100),
    rotateIntervalSeconds: clampNumber(Number(merged.rotateIntervalSeconds ?? 6), 2, 60),
  };
}

// --------------------------------------------------------------------------
// Scoreboard (sports score bug)
// --------------------------------------------------------------------------

export type ScoreboardStyle = 'bar' | 'bug' | 'fullwidth' | 'minimal';

export type ScoreboardPossession = 'home' | 'away' | 'none';

export interface ScoreboardTeam {
  name: string;
  /** Team crest/logo data URL — replaceable from the Layers panel. */
  logoDataUrl: string | null;
  score: number;
}

export interface ScoreboardSettings {
  home: ScoreboardTeam;
  away: ScoreboardTeam;
  /** Period / quarter / inning label — e.g. "Q3", "2ND", "TOP 9". */
  periodLabel: string;
  /** Game clock in whole seconds (mm:ss). */
  clockSeconds: number;
  /** Live counting on air. */
  clockRunning: boolean;
  possession: ScoreboardPossession;
  accentColor: string;
  style: ScoreboardStyle;
  position: OverlayPosition;
  xPercent?: number;
  yPercent?: number;
  opacity: number;
}

function resolveScoreboardTeam(team: Partial<ScoreboardTeam>, fallbackName: string): ScoreboardTeam {
  const name = typeof team.name === 'string' ? team.name.trim().slice(0, 24) : '';
  return {
    name: name || fallbackName,
    logoDataUrl: typeof team.logoDataUrl === 'string' ? team.logoDataUrl : null,
    score: clampNumber(Math.round(Number(team.score ?? 0)), 0, 999),
  };
}

export const DEFAULT_SCOREBOARD: ScoreboardSettings = {
  home: { name: 'HOME', logoDataUrl: null, score: 0 },
  away: { name: 'AWAY', logoDataUrl: null, score: 0 },
  periodLabel: 'Q1',
  clockSeconds: 720,
  clockRunning: false,
  possession: 'none',
  accentColor: '#f59e0b',
  style: 'bug',
  position: 'top-left',
  opacity: 100,
};

export function resolveScoreboardSettings(
  partial?: Partial<ScoreboardSettings>,
): ScoreboardSettings {
  const merged = { ...DEFAULT_SCOREBOARD, ...partial };
  return {
    home: resolveScoreboardTeam(merged.home ?? {}, 'HOME'),
    away: resolveScoreboardTeam(merged.away ?? {}, 'AWAY'),
    periodLabel: typeof merged.periodLabel === 'string' ? merged.periodLabel.slice(0, 8) : 'Q1',
    clockSeconds: clampNumber(Math.round(Number(merged.clockSeconds ?? 0)), 0, 99 * 60 + 59),
    clockRunning: merged.clockRunning ?? false,
    possession:
      merged.possession === 'home' || merged.possession === 'away' ? merged.possession : 'none',
    accentColor: merged.accentColor || DEFAULT_SCOREBOARD.accentColor,
    style:
      merged.style === 'bar' || merged.style === 'fullwidth' || merged.style === 'minimal'
        ? merged.style
        : 'bug',
    position: merged.position ?? DEFAULT_SCOREBOARD.position,
    xPercent: merged.xPercent,
    yPercent: merged.yPercent,
    opacity: clampNumber(Number(merged.opacity ?? 100), 10, 100),
  };
}

// --------------------------------------------------------------------------
// Countdown / on-air clock
// --------------------------------------------------------------------------

export type CountdownMode = 'countdown' | 'count-up' | 'time-of-day';

export interface CountdownSettings {
  mode: CountdownMode;
  /** Target length in seconds for countdown / count-up modes. */
  targetSeconds: number;
  /** Small title above the digits. */
  title: string;
  /** Caption below the digits. */
  label: string;
  /** Hide the graphic when a countdown reaches zero. */
  autoHideAtZero: boolean;
  /** Circular progress ring around the digits. */
  showRing: boolean;
  accentColor: string;
  position: OverlayPosition;
  xPercent?: number;
  yPercent?: number;
  opacity: number;
}

export const DEFAULT_COUNTDOWN: CountdownSettings = {
  mode: 'countdown',
  targetSeconds: 300,
  title: 'ON AIR IN',
  label: 'Stay tuned for live coverage',
  autoHideAtZero: true,
  showRing: true,
  accentColor: '#ef4444',
  position: 'center',
  opacity: 100,
};

export function resolveCountdownSettings(
  partial?: Partial<CountdownSettings>,
): CountdownSettings {
  const merged = { ...DEFAULT_COUNTDOWN, ...partial };
  return {
    mode:
      merged.mode === 'count-up' || merged.mode === 'time-of-day' ? merged.mode : 'countdown',
    targetSeconds: clampNumber(Math.round(Number(merged.targetSeconds ?? 0)), 0, 24 * 3600),
    title: typeof merged.title === 'string' ? merged.title.slice(0, 40) : DEFAULT_COUNTDOWN.title,
    label: typeof merged.label === 'string' ? merged.label.slice(0, 64) : DEFAULT_COUNTDOWN.label,
    autoHideAtZero: merged.autoHideAtZero ?? true,
    showRing: merged.showRing ?? true,
    accentColor: merged.accentColor || DEFAULT_COUNTDOWN.accentColor,
    position: merged.position ?? DEFAULT_COUNTDOWN.position,
    xPercent: merged.xPercent,
    yPercent: merged.yPercent,
    opacity: clampNumber(Number(merged.opacity ?? 100), 10, 100),
  };
}

// --------------------------------------------------------------------------
// Sponsor bug (rotating corner logo)
// --------------------------------------------------------------------------

export interface SponsorBugEntry {
  id: string;
  /** Logo data URL — replaceable from the Layers panel. */
  logoDataUrl: string;
  label?: string;
  /** Seconds this sponsor stays on screen per rotation. */
  seconds: number;
}

export interface SponsorBugSettings {
  entries: SponsorBugEntry[];
  /** Bug width as a percent of frame width (6–30). */
  size: number;
  opacity: number;
  position: OverlayPosition;
  xPercent?: number;
  yPercent?: number;
}

export const MAX_SPONSOR_BUG_ENTRIES = 8;

function resolveSponsorBugEntry(entry: Partial<SponsorBugEntry>, index: number): SponsorBugEntry {
  return {
    id: entry.id || `sponsor-${index + 1}`,
    logoDataUrl: typeof entry.logoDataUrl === 'string' ? entry.logoDataUrl : '',
    label: typeof entry.label === 'string' ? entry.label.slice(0, 32) : '',
    seconds: clampNumber(Math.round(Number(entry.seconds)) || 8, 2, 60),
  };
}

export const DEFAULT_SPONSOR_BUG: SponsorBugSettings = {
  entries: [],
  size: 12,
  opacity: 90,
  position: 'top-right',
};

export function resolveSponsorBugSettings(
  partial?: Partial<SponsorBugSettings>,
): SponsorBugSettings {
  const merged = { ...DEFAULT_SPONSOR_BUG, ...partial };
  return {
    entries: (Array.isArray(merged.entries) ? merged.entries : [])
      .slice(0, MAX_SPONSOR_BUG_ENTRIES)
      .map(resolveSponsorBugEntry),
    size: clampNumber(Number(merged.size ?? 12), 6, 30),
    opacity: clampNumber(Number(merged.opacity ?? 90), 10, 100),
    position: merged.position ?? DEFAULT_SPONSOR_BUG.position,
    xPercent: merged.xPercent,
    yPercent: merged.yPercent,
  };
}
