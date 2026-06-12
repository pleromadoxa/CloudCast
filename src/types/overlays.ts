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
}

export type CrawlerStyle = 'news-red' | 'sport-black' | 'minimal';

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
};

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
