/**
 * Core contracts for the CloudCast Virtual Studio — the photorealistic
 * Aximetry-style production environment used by Replay, Prism, and the display
 * products.
 *
 * Everything in this file is framework-agnostic and side-effect free so it can
 * be unit tested without WebGL.
 */

export type StudioSceneCategory =
  | 'news'
  | 'sports'
  | 'home'
  | 'talk'
  | 'worship'
  | 'weather'
  | 'business'
  | 'exterior'
  | 'concert'
  | 'blank'
  | 'luxury'
  | 'podcast'
  | 'fitness'
  | 'realestate'
  | 'auction'
  | 'cinematic'
  | 'outdoor'
  | 'academic'
  | 'music';

export type StudioTier = 'free' | 'pro' | 'pro_master';

/**
 * How the production stage is composited:
 * - `virtual_studio`   — full closed 3D set replacing the green screen.
 * - `augmented_reality`— live camera feed with 3D graphics composited over it.
 * - `xr_extension`     — LED volume / set-extension with a wide establishing lens.
 *
 * Structurally identical to the classic `PrismProductionMode` so the studio can
 * hand its mode straight through, but declared here to keep this module
 * framework-agnostic and side-effect free (unit-testable without WebGL).
 */
export type StudioProductionMode = 'virtual_studio' | 'augmented_reality' | 'xr_extension';

/** Text/graphics rendered procedurally into a canvas texture (scorebugs, logos…). */
export interface StudioGraphicContent {
  style:
    | 'lower-third'
    | 'scorebug'
    | 'logo'
    | 'solid'
    | 'slate'
    /** Full-bleed breaking-news banner (BBC/CNN-style red strap + headline). */
    | 'breaking'
    /** Live scrolling news crawl along the bottom of the screen. */
    | 'crawler'
    /** Stacked TOP STORIES headline rundown. */
    | 'headline'
    /** Name/title strap (guest ident) with accent bar. */
    | 'strap'
    /** Photographic-style dusk city skyline — the view behind studio windows. */
    | 'skyline'
    /** Golden curved-glass architecture plate — hero content for video walls. */
    | 'architecture'
    /** Floodlit stadium bowl — sports-set hero content. */
    | 'stadium'
    /** Warm bokeh stage wash — talk/worship backdrop content. */
    | 'stage-glow';
  /** Primary line of text (headline, team names, show title…). */
  text?: string;
  /** Secondary line (sub-headline, score, strap…). */
  subtext?: string;
  /** Tail text — used by the scorebug for clocks/quarters. */
  detail?: string;
  background?: string;
  accent?: string;
  foreground?: string;
  /** News/graphics lines: crawl items, headline stack rows, strap details. */
  items?: string[];
  /** Name ident for straps (presenter, guest, correspondent). */
  name?: string;
  /** Role/title under the name (strap, breaking correspondent line). */
  role?: string;
  /** Attribution / channel bug text ("BBC NEWS", "REGAL NEWS", "LIVE"). */
  source?: string;
  /** Secondary footer line (location, show time, strap tail). */
  footer?: string;
  /** Opt-in per-frame redraw for live animation (crawl scroll, ticking clock). */
  animated?: boolean;
}

export type StudioScreenSource =
  | { kind: 'live-video'; video: HTMLVideoElement; label?: string }
  | {
      kind: 'video-url';
      url: string;
      loop?: boolean;
      label?: string;
      /** Workspace (Regal Cloud) media id — lets the URL be re-resolved later. */
      mediaId?: string;
      storagePath?: string;
    }
  | {
      kind: 'image-url';
      url: string;
      label?: string;
      /** Workspace (Regal Cloud) media id — lets the URL be re-resolved later. */
      mediaId?: string;
      storagePath?: string;
    }
  | { kind: 'canvas'; canvas: HTMLCanvasElement; label?: string }
  | { kind: 'graphic'; content: StudioGraphicContent; label?: string }
  | { kind: 'off'; label?: string };

export type StudioScreenSourceKind = StudioScreenSource['kind'];

/** Physical form of a screen — drives texture sizing and LED overlays. */
export type StudioScreenForm = 'video-wall' | 'television' | 'ribbon' | 'banner' | 'monitor' | 'window';

/** How an image/video source is fitted onto its screen mesh. */
export type StudioFit = 'cover' | 'contain';

/** A bindable screen inside a scene (LED wall, TV, ribbon, banner…). */
export interface StudioScreenSlot {
  /** Stable id used to address the slot from `sources`. */
  id: string;
  /** Human-readable name shown in the operator UI. */
  label: string;
  /** What the screen is physically — drives the default framing/overlay. */
  form: StudioScreenForm;
  /** Source used when the operator has not bound anything yet. */
  defaultSource?: StudioScreenSource;
  /** Slots a scene cannot render without are marked required. */
  required?: boolean;
}

export interface StudioCameraPreset {
  yaw: number;
  pitch: number;
  zoom: number;
  /** Lens field-of-view in degrees — 24° tele through 55° wide. */
  fov?: number;
  /**
   * Free-camera look-at point in world space. Panning (drag/WASD) moves this,
   * carrying the camera rig with it — Aximetry-style free movement anywhere
   * in the set. Defaults to the scene's framing anchor.
   */
  target?: [number, number, number];
}

/** Where the keyed/raw talent plane sits inside a scene. */
export interface StudioTalentPlacement {
  position: [number, number, number];
  /** Plane width in world units — height follows the 16:9 talent framing. */
  width?: number;
  /** Face the camera by default; sets can rotate talent for 2-shots. */
  yaw?: number;
  /** Tilt the plate forward/back — any angle presentation (radians). */
  pitch?: number;
  /** Roll the plate (radians) for dutch-angle compositions. */
  roll?: number;
  /**
   * Whether the talent is standing or seated on set furniture. A seated
   * framing is tighter and rests its frame bottom at lap height so the keyed
   * talent lands on a chair's seat exactly like a real sitter.
   */
  pose?: 'standing' | 'seated';
}

/** Frame-bottom height (m) of a seated shot — roughly lap/seat level. */
export const SEATED_FRAME_BOTTOM = 0.35;
/** Frame-bottom height (m) of the default standing shot. */
export const STANDING_FRAME_BOTTOM = 0.15;
/** A seated shot is framed tighter than a standing one. */
export const SEATED_WIDTH_SCALE = 0.82;

/**
 * Convert a placement to a seated framing: tighter width, frame bottom at
 * lap height so the talent visually sits on any chair placed there. Position
 * X/Z and all angles are preserved.
 */
export function seatedTalentPlacement(base: StudioTalentPlacement): StudioTalentPlacement {
  const width = (base.width ?? 2.4) * SEATED_WIDTH_SCALE;
  const height = width * (9 / 16);
  return {
    ...base,
    width,
    position: [base.position[0], SEATED_FRAME_BOTTOM + height / 2, base.position[2]],
    pose: 'seated',
  };
}

/** Convert a placement back to the standing framing (inverse of seated). */
export function standingTalentPlacement(base: StudioTalentPlacement): StudioTalentPlacement {
  const width = (base.width ?? 2.4) / SEATED_WIDTH_SCALE;
  const height = width * (9 / 16);
  return {
    ...base,
    width,
    position: [base.position[0], STANDING_FRAME_BOTTOM + height / 2, base.position[2]],
    pose: 'standing',
  };
}

export interface StudioSceneDefinition {
  id: string;
  name: string;
  description: string;
  category: StudioSceneCategory;
  tier: StudioTier;
  /** Accent colour used for set dressing, glows and UI chips. */
  accent: string;
  /** Neutral exposure bias in stops — scenes with bright LEDs run slightly under. */
  exposureBias: number;
  camera: StudioCameraPreset;
  /** Where talent is composited inside the set. */
  talent?: StudioTalentPlacement;
  /** Screens this scene exposes to the operator. */
  screens: StudioScreenSlot[];
  /** Slot receiving the replaceable backdrop, when the scene supports one. */
  backdropSlotId?: string;
  tags: string[];
}

/** Per-scene runtime settings owned by the operator. */
export interface StudioSceneSettings {
  /** Full-scene replacement background (image, live feed, or slate). */
  backdrop?: StudioScreenSource;
  /** Per-slot screen bindings, keyed by `StudioScreenSlot.id`. */
  sources: Record<string, StudioScreenSource>;
  /** Extra light rig intensity multiplier (0.6 – 1.6). */
  lighting?: number;
  /** Scroll speed for ribbon/ticker banners in px/s (0 disables). */
  tickerSpeed?: number;
}

/**
 * How the camera moves between recalled shots, and how productions switch:
 * • cut — instant (broadcast hard cut)
 * • dissolve — slow, straight ease with a soft cross-dissolve plate
 * • jib — classic crane sweep with a lifted arc through the move
 * • whip — fast dart with a slight zoom punch (whip-pan energy)
 * • crane — tall arc crane move with lens breathing
 * • zoom — dolly punch: the lens pushes in mid-move then settles
 */
export type StudioTransitionStyle = 'cut' | 'dissolve' | 'jib' | 'whip' | 'crane' | 'zoom';

export interface StudioTransitionSettings {
  style: StudioTransitionStyle;
  /** Seconds the camera travels between recalled shots (0.2 – 4). */
  duration: number;
}

export const DEFAULT_STUDIO_TRANSITION: StudioTransitionSettings = { style: 'jib', duration: 1.2 };

/** Per-effect overrides on top of the quality preset (undefined = follow preset). */
export interface StudioEffectOverrides {
  bloom?: boolean;
  /** Bloom strength 0.15 – 1.2. */
  bloomIntensity?: number;
  depthOfField?: boolean;
  vignette?: boolean;
  ao?: boolean;
  smaa?: boolean;
}

/** An element the operator placed into the set (drag & drop set dressing). */
export interface StudioPlacedElement {
  id: string;
  elementId: string;
  /** Floor position [x, z] — elements always stay grounded. */
  position: [number, number];
  /** Yaw in radians. */
  rotation: number;
  /**
   * Uniform size (legacy) or per-axis stretch [x, y, z]. 1 = catalog default.
   */
  scale: number | [number, number, number];
  /** Height above the floor in metres (wall art, floating screens, shelves). */
  elevation?: number;
  /** Bound source for screen elements. */
  source?: StudioScreenSource;
}

/** One held camera shot inside the AutoCam rundown. */
export interface StudioRundownStep {
  label: string;
  pose: StudioCameraPreset;
  /** Seconds to hold this shot before gliding to the next. */
  duration: number;
}

/**
 * Where the on-stage talent plate gets its picture: the live capture feed
 * (USB webcam, HDMI capture card or paired Prism Eye), a video file played
 * full-frame as the plate, or nothing at all.
 */
export type StudioTalentSourceKind = 'camera' | 'video' | 'off';

export interface StudioTalentSource {
  kind: StudioTalentSourceKind;
  /** Video file url (workspace or session blob) for `video` sources. */
  url?: string;
  label?: string;
  /** Workspace media refs so expired urls can be re-resolved on open. */
  mediaId?: string;
  storagePath?: string;
}

/** Persisted operator state for the photoreal render engine. */
export interface PhotorealStudioState {
  /** Registry scene id currently loaded on stage. */
  sceneId: string;
  /** Slot id → bound source (camera, media, graphic, URL…). */
  bindings: Record<string, StudioScreenSource>;
  /** Full-scene replacement plate. */
  backdrop?: StudioScreenSource;
  quality: 'auto' | 'low' | 'balanced' | 'high' | 'ultra';
  lighting: number;
  tickerSpeed: number;
  /** Saved camera shot memories (recall / capture from the camera desk). */
  shots?: (StudioCameraPreset | null)[];
  /** Colour temperature 0 (cool) – 1 (warm) across the light rig. */
  temperature?: number;
  /** Extra exposure multiplier on top of the scene bias (0.6 – 1.6). */
  exposure?: number;
  /** Override the scene accent colour (backlight, glows, LED practicals). */
  accent?: string;
  /** Effect overrides on top of the quality preset. */
  effects?: StudioEffectOverrides;
  /** Placed set dressing — plants, furniture, screens… anywhere in the set. */
  elements?: StudioPlacedElement[];
  /** Operator override for the talent plate placement (position/angle/size). */
  talentPlacement?: StudioTalentPlacement;
  /** What feeds the talent plate — live capture, a video file, or off. */
  talentSource?: StudioTalentSource;
  /** Camera/production transition style & travel time. */
  transition?: StudioTransitionSettings;
  /** AutoCam rundown — a looping sequence of held camera shots. */
  rundown?: StudioRundownStep[];
  /** Snap element drags to a 0.25 m floor grid. */
  snapToGrid?: boolean;
}

export function defaultPhotorealState(sceneId = 'newsroom'): PhotorealStudioState {
  return {
    sceneId,
    bindings: {},
    quality: 'auto',
    lighting: 1,
    tickerSpeed: 120,
  };
}
