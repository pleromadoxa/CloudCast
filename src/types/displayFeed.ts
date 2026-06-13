/** Regal Display — presentation & scripture content for the Display Feed video source. */

export type DisplaySlideType =
  | 'blank'
  | 'scripture'
  | 'announcement'
  | 'lyrics'
  | 'media'
  | 'custom';

/** Slide layout — banner-bottom keeps top clear for mixer key overlays. */
export type DisplaySlideLayout = 'full' | 'banner-bottom' | 'banner-top' | 'lower-third';

export type DisplayBackgroundKind = 'preset' | 'color' | 'image' | 'gradient';

export type DisplayTextSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type DisplayTextAlign = 'left' | 'center' | 'right';

export interface DisplayBackground {
  kind: DisplayBackgroundKind;
  /** Preset id from displayBackgrounds.ts */
  presetId?: string;
  color?: string;
  /** Data URL or remote URL */
  imageUrl?: string;
  /** 0–100 overlay darkness on image backgrounds */
  overlayOpacity?: number;
}

export interface DisplayTextField {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  size: DisplayTextSize;
  align: DisplayTextAlign;
  /** Optional accent color */
  color?: string;
}

export interface DisplayScripture {
  reference: string;
  text: string;
  translation?: string;
}

/** Saved scripture for quick re-use during service. */
export interface ScripturePreset {
  id: string;
  reference: string;
  text: string;
  translation: string;
  translationId?: string;
  savedAt: string;
}

/** User-created slide template (persisted in local storage). */
export interface DisplayCustomTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'worship' | 'announcement' | 'media' | 'blank' | 'banner' | 'custom';
  type: DisplaySlideType;
  layout?: DisplaySlideLayout;
  bannerHeight?: number;
  background?: DisplayBackground;
  foregroundImageUrl?: string;
  foregroundPosition?: DisplaySlide['foregroundPosition'];
  foregroundSize?: DisplaySlide['foregroundSize'];
  fields: Omit<DisplayTextField, 'id'>[];
  createdAt: string;
}

export interface DisplayMediaItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video';
  addedAt: string;
}

export interface DisplaySlide {
  id: string;
  title: string;
  type: DisplaySlideType;
  layout?: DisplaySlideLayout;
  /** Banner height as % of screen (default 30) */
  bannerHeight?: number;
  background: DisplayBackground;
  fields: DisplayTextField[];
  scripture?: DisplayScripture;
  /** Foreground image (logo, photo, etc.) */
  foregroundImageUrl?: string;
  foregroundPosition?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  foregroundSize?: 'small' | 'medium' | 'large';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DisplayFeedState {
  /** Slide staged in operator preview */
  previewSlideId: string | null;
  /** Slide on the live Display Feed output */
  liveSlideId: string | null;
  slides: DisplaySlide[];
  /** Service order — slide ids */
  playlist: string[];
  playlistIndex: number;
  mediaLibrary: DisplayMediaItem[];
  transition: 'cut' | 'fade';
  /** Show operator notes overlay in preview only */
  showNotes: boolean;
  /** Blank / hold screen when live slide is cleared */
  holdBackground: DisplayBackground;
  /** Saved scriptures for quick lookup */
  scripturePresets: ScripturePreset[];
  /** User-created templates */
  customTemplates: DisplayCustomTemplate[];
  /** Key mode — top area green/transparent for mixer chroma overlay */
  keyMode: boolean;
  /** Default Bible translation for lookup */
  defaultBibleTranslation?: string;
  /** Show clock overlay on congregation output */
  showCongregationClock?: boolean;
}

export type DisplayPanel = 'slides' | 'scripture' | 'backgrounds' | 'media' | 'playlist' | 'fields' | 'templates' | 'lyrics';

export const REGAL_DISPLAY_DEVICE_ID = 'regal-display-feed';

export const DEFAULT_DISPLAY_FIELDS: Omit<DisplayTextField, 'id'>[] = [
  { label: 'Title', value: '', visible: true, size: 'xl', align: 'center' },
  { label: 'Subtitle', value: '', visible: true, size: 'lg', align: 'center' },
  { label: 'Body', value: '', visible: true, size: 'md', align: 'center' },
  { label: 'Footer', value: '', visible: false, size: 'sm', align: 'center' },
];

export function createDefaultBackground(): DisplayBackground {
  return { kind: 'preset', presetId: 'worship-deep-blue', overlayOpacity: 40 };
}

export function createEmptySlide(partial?: Partial<DisplaySlide>): DisplaySlide {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: 'New Slide',
    type: 'custom',
    background: createDefaultBackground(),
    fields: DEFAULT_DISPLAY_FIELDS.map((f, i) => ({ ...f, id: `field-${i}` })),
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function createScriptureSlide(reference: string, text: string, translation?: string): DisplaySlide {
  return createEmptySlide({
    title: reference,
    type: 'scripture',
    fields: [
      { id: 'field-0', label: 'Reference', value: reference, visible: true, size: 'lg', align: 'center' },
      { id: 'field-1', label: 'Scripture', value: text, visible: true, size: 'xl', align: 'center' },
      { id: 'field-2', label: 'Translation', value: translation ?? 'NIV', visible: true, size: 'sm', align: 'center', color: '#94a3b8' },
      { id: 'field-3', label: 'Footer', value: '', visible: false, size: 'sm', align: 'center' },
    ],
    scripture: { reference, text, translation },
  });
}

export function createDefaultDisplayFeedState(): DisplayFeedState {
  const welcome = createEmptySlide({
    title: 'Welcome',
    type: 'announcement',
    fields: [
      { id: 'field-0', label: 'Title', value: 'Welcome', visible: true, size: '2xl', align: 'center' },
      { id: 'field-1', label: 'Subtitle', value: 'We\'re glad you\'re here', visible: true, size: 'lg', align: 'center' },
      { id: 'field-2', label: 'Body', value: '', visible: false, size: 'md', align: 'center' },
      { id: 'field-3', label: 'Footer', value: '', visible: false, size: 'sm', align: 'center' },
    ],
  });
  return {
    previewSlideId: welcome.id,
    liveSlideId: null,
    slides: [welcome],
    playlist: [welcome.id],
    playlistIndex: 0,
    mediaLibrary: [],
    transition: 'fade',
    showNotes: false,
    holdBackground: createDefaultBackground(),
    scripturePresets: [],
    customTemplates: [],
    keyMode: false,
    defaultBibleTranslation: 'web',
    showCongregationClock: false,
  };
}
