import type { StudioSceneDefinition, StudioScreenSlot, StudioTier, StudioTalentPlacement } from './types';
import { seatedTalentPlacement } from './types';

/**
 * Registry of complete, ready-to-air virtual production scenes.
 *
 * Every entry is a *finished* environment: geometry, light rig, PBR material
 * palette, camera framing and the screen slots an operator can rebind to live
 * feeds, images or graphics. Nothing needs to be assembled by the end user —
 * pick a scene, bind feeds, go live.
 */

function slot(
  id: string,
  label: string,
  form: StudioScreenSlot['form'],
  required = false,
  defaultSource?: StudioScreenSlot['defaultSource'],
): StudioScreenSlot {
  return { id, label, form, required, defaultSource };
}

const ticker = (text: string, subtext: string, accent = '#e11d48'): StudioScreenSlot['defaultSource'] => ({
  kind: 'graphic',
  content: { style: 'lower-third', text, subtext, accent, background: '#070b16' },
});

const logo = (text: string, accent = '#38bdf8'): StudioScreenSlot['defaultSource'] => ({
  kind: 'graphic',
  content: { style: 'logo', text, accent, background: '#05070d' },
});

const slate = (text: string, subtext?: string): StudioScreenSlot['defaultSource'] => ({
  kind: 'graphic',
  content: { style: 'slate', text, subtext, background: '#0a0f1c' },
});

/** Photographic hero plate (skyline / architecture / stadium / stage-glow). */
const view = (
  style: 'skyline' | 'architecture' | 'stadium' | 'stage-glow',
  accent?: string,
): StudioScreenSlot['defaultSource'] => ({
  kind: 'graphic',
  content: { style, ...(accent ? { accent } : {}) },
});

/** Live news-channel plate: channel bug, headline and a scrolling crawl. */
const news = (
  text: string,
  source: string,
  accent = '#e11d48',
  items: string[] = ['MARKETS RALLY AS ENERGY SECTOR SURGES', 'PARLIAMENT DEBATES NEW INFRASTRUCTURE BILL', 'WEATHER SYSTEM MOVES EAST OVERNIGHT'],
): StudioScreenSlot['defaultSource'] => ({
  kind: 'graphic',
  content: { style: 'crawler', text, source, accent, animated: true, items },
});

/** Breaking-news plate: crimson tag, headline and live strap. */
const breaking = (
  text: string,
  subtext: string,
  name = 'LIVE COVERAGE',
  accent = '#e11d48',
): StudioScreenSlot['defaultSource'] => ({
  kind: 'graphic',
  content: { style: 'breaking', text, subtext, name, accent },
});

/** Stacked TOP STORIES rundown plate. */
const rundown = (
  text: string,
  items: string[],
  accent = '#e11d48',
): StudioScreenSlot['defaultSource'] => ({
  kind: 'graphic',
  content: { style: 'headline', text, items, accent },
});

function talentAt(
  position: [number, number, number],
  width = 2.4,
  pose: 'standing' | 'seated' = 'standing',
): StudioTalentPlacement {
  const base: StudioTalentPlacement = { position, width, pose };
  // Desk and sofa shows default to the seated framing — the anchor and the
  // guests really do sit on the set furniture, so the plate is framed like a
  // seated shot and rests at the seat line.
  return pose === 'seated' ? seatedTalentPlacement(base) : base;
}

export const STUDIO_SCENES: StudioSceneDefinition[] = [
  {
    id: 'newsroom',
    name: 'Newsroom Studio',
    description:
      'Anchor desk in front of an LED video wall, side monitors, and a live ticker — a full nightly-news environment with replaceable backdrop.',
    category: 'news',
    tier: 'free',
    accent: '#e11d48',
    exposureBias: -0.15,
    camera: { yaw: 0, pitch: 0.14, zoom: 1 },
    talent: talentAt([0, 0.9, 0.45], 2.4, 'seated'),
    backdropSlotId: 'backdrop',
    screens: [
      slot('video_wall', 'LED Video Wall', 'video-wall', true, news('CLOUDCAST NEWSROOM', 'CC NEWS', '#e11d48')),
      slot('desk_monitor', 'Desk Monitor', 'monitor', false, logo('CC', '#e11d48')),
      slot('side_screen', 'Side Screen', 'monitor', false, slate('ON AIR', 'STUDIO 1')),
      slot('ticker', 'Headline Ticker', 'ribbon', false, ticker('BREAKING NEWS', 'Stay with us for live coverage')),
      slot('backdrop', 'Set Backdrop', 'window', false, view('skyline')),
    ],
    tags: ['news', 'broadcast', 'studio', 'led'],
  },
  {
    id: 'sports_arena',
    name: 'Sports Arena Desk',
    description:
      'Analysis desk inside a stadium bowl with a wrap-around LED ribbon board, jumbotron wall, and sponsor banners.',
    category: 'sports',
    tier: 'pro',
    accent: '#f97316',
    exposureBias: -0.1,
    camera: { yaw: -0.08, pitch: 0.16, zoom: 0.95 },
    talent: talentAt([0, 0.9, 0.6], 2.4, 'seated'),
    backdropSlotId: 'backdrop',
    screens: [
      slot('jumbotron', 'Jumbotron Wall', 'video-wall', true, view('stadium')),
      slot('ribbon', 'Ribbon Board', 'ribbon', false, ticker('HOME 24 · AWAY 21', '3RD QTR · 04:12', '#f97316')),
      slot('desk_monitor', 'Desk Monitor', 'monitor', false, logo('HD', '#f97316')),
      slot('sponsor_banner', 'Sponsor Banner', 'banner', false, logo('SPN', '#f97316')),
      slot('backdrop', 'Arena Backdrop', 'window', false, view('stadium')),
    ],
    tags: ['sports', 'stadium', 'analysis', 'led'],
  },
  {
    id: 'living_room',
    name: 'Living Room',
    description:
      'Warm furnished living room with hardwood floors, sofa, coffee table, wall TV and a window you can replace with any view or live feed.',
    category: 'home',
    tier: 'free',
    accent: '#f59e0b',
    exposureBias: 0.05,
    camera: { yaw: 0.1, pitch: 0.13, zoom: 1.05 },
    talent: talentAt([0.6, 0.9, 1.9], 2.1),
    backdropSlotId: 'window',
    screens: [
      slot('tv', 'Living Room TV', 'television', true, slate('CLOUDCAST', 'Smart TV · CH 1')),
      slot('window', 'Window View', 'window', false, view('skyline')),
      slot('shelf_frame', 'Shelf Frame', 'banner', false, logo('HOME', '#f59e0b')),
    ],
    tags: ['home', 'lifestyle', 'living-room', 'cozy'],
  },
  {
    id: 'talk_show',
    name: 'Talk Show Stage',
    description:
      'Theatrical interview set with guest sofas, coffee table, backlight wall and a pair of presentation screens.',
    category: 'talk',
    tier: 'pro',
    accent: '#8b5cf6',
    exposureBias: -0.05,
    camera: { yaw: 0.04, pitch: 0.12, zoom: 1 },
    talent: talentAt([0, 0.9, 1.6], 2.4, 'seated'),
    backdropSlotId: 'backdrop',
    screens: [
      slot('main_screen', 'Presentation Screen', 'video-wall', true, view('architecture')),
      slot('side_screen', 'Side Screen', 'monitor', false, slate('LIVE', 'AUDIENCE CAM')),
      slot('ticker', 'Show Ticker', 'ribbon', false, ticker('TONIGHT’S GUESTS', 'New episodes every week', '#8b5cf6')),
      slot('backdrop', 'Set Backdrop', 'window', false, view('skyline')),
    ],
    tags: ['talk', 'interview', 'show'],
  },
  {
    id: 'worship_stage',
    name: 'Worship Stage',
    description:
      'Warm stage with lectern, pews, wash lighting and a projection wall for lyrics, video and congregation feeds.',
    category: 'worship',
    tier: 'pro',
    accent: '#f59e0b',
    exposureBias: -0.05,
    camera: { yaw: 0, pitch: 0.15, zoom: 0.95 },
    talent: talentAt([0.4, 1.06, -0.4]),
    backdropSlotId: 'backdrop',
    screens: [
      slot('projection_wall', 'Projection Wall', 'video-wall', true, slate('WELCOME', 'Join us in worship today')),
      slot('lyric_banner', 'Lyric Banner', 'ribbon', false, ticker('AMAZING GRACE', 'How sweet the sound', '#f59e0b')),
      slot('side_screen', 'Side Screen', 'monitor', false, logo('WC', '#f59e0b')),
      slot('backdrop', 'Stage Backdrop', 'window', false, view('stage-glow', '#f59e0b')),
    ],
    tags: ['church', 'worship', 'stage', 'projection'],
  },
  {
    id: 'weather_center',
    name: 'Weather Center',
    description:
      'Forecast studio with a chroma-lit presenter zone, a full radar/satellite monitor bank, a big live map LED wall and a scrolling forecast ticker.',
    category: 'weather',
    tier: 'pro',
    accent: '#06b6d4',
    exposureBias: -0.12,
    camera: { yaw: -0.12, pitch: 0.13, zoom: 1 },
    talent: talentAt([2.2, 0.9, -2.1], 2.2),
    backdropSlotId: 'backdrop',
    screens: [
      slot('map_wall', 'Live Map Wall', 'video-wall', true, slate('LIVE RADAR', 'Storm tracking · Regional view')),
      slot('forecast_ticker', 'Forecast Ticker', 'ribbon', false, ticker('7-DAY FORECAST', 'High 24° · Low 17° · Rain 40%', '#06b6d4')),
      slot('radar_left', 'Radar Screen', 'monitor', false, slate('DOPPLER', 'Velocity scan')),
      slot('radar_right', 'Satellite Screen', 'monitor', false, slate('SATELLITE', 'Cloud top temperatures')),
      slot('desk_monitor', 'Presenter Monitor', 'monitor', false, logo('WX', '#06b6d4')),
      slot('backdrop', 'Set Backdrop', 'window', false, view('skyline')),
    ],
    tags: ['weather', 'forecast', 'radar', 'news', 'chroma'],
  },
  {
    id: 'kitchen_set',
    name: 'Modern Kitchen',
    description:
      'Chef-ready kitchen with marble island, bar seating, smart displays and a window view — perfect for cooking shows and morning segments.',
    category: 'home',
    tier: 'pro',
    accent: '#f59e0b',
    exposureBias: 0.02,
    camera: { yaw: 0.12, pitch: 0.14, zoom: 1 },
    talent: talentAt([0, 0.9, 1.1]),
    backdropSlotId: 'window',
    screens: [
      slot('tv', 'Kitchen TV', 'television', true, slate('CLOUDCAST KITCHEN', 'Live cooking segment')),
      slot('window', 'Window View', 'window', false, view('skyline')),
      slot('fridge_display', 'Fridge Display', 'monitor', false, logo('KC', '#f59e0b')),
    ],
    tags: ['kitchen', 'cooking', 'home', 'food'],
  },
  {
    id: 'bedroom_suite',
    name: 'Bedroom Suite',
    description:
      'Calm designer bedroom with an upholstered bed, warm practicals, wall TV and a morning-light window — ideal for lifestyle and wellness shows.',
    category: 'home',
    tier: 'pro',
    accent: '#f472b6',
    exposureBias: 0.05,
    camera: { yaw: -0.1, pitch: 0.12, zoom: 1.05 },
    talent: talentAt([1.1, 0.9, 1.9], 2.1),
    backdropSlotId: 'window',
    screens: [
      slot('tv', 'Bedroom TV', 'television', true, slate('GOOD MORNING', 'Lifestyle · Live')),
      slot('window', 'Window View', 'window', false, view('skyline')),
      slot('art_frame', 'Digital Art Frame', 'banner', false, logo('SLEEP', '#f472b6')),
    ],
    tags: ['bedroom', 'home', 'lifestyle', 'wellness'],
  },
  {
    id: 'conference_room',
    name: 'Conference Room',
    description:
      'Glass-wall boardroom with a long table, executive chairs, a full presentation LED wall and an agenda ticker — built for briefings and panels.',
    category: 'business',
    tier: 'pro',
    accent: '#38bdf8',
    exposureBias: -0.05,
    camera: { yaw: 0, pitch: 0.11, zoom: 1 },
    talent: talentAt([0, 0.9, 1.6]),
    backdropSlotId: 'window',
    screens: [
      slot('main_screen', 'Presentation Wall', 'video-wall', true, slate('QUARTERLY BRIEFING', 'Strategy · Operations')),
      slot('side_screen', 'Side Monitor', 'monitor', false, slate('AGENDA', '4 items · 45 min')),
      slot('agenda_ticker', 'Agenda Ticker', 'ribbon', false, ticker('TODAY · 14:00', 'Product review — Q3 results', '#38bdf8')),
      slot('window', 'Glass Wall View', 'window', false, view('skyline')),
    ],
    tags: ['business', 'conference', 'briefing', 'panel'],
  },
  {
    id: 'house_exterior',
    name: 'Residential Exterior',
    description:
      'Modern home exterior with patio, greenery and an open sky you can replace — great for property shows, weather hits and location segments.',
    category: 'exterior',
    tier: 'pro_master',
    accent: '#34d399',
    exposureBias: 0.1,
    camera: { yaw: 0, pitch: 0.16, zoom: 0.9 },
    talent: talentAt([0, 0.9, 2.2]),
    backdropSlotId: 'sky',
    screens: [
      slot('porch_tv', 'Patio TV', 'television', true, slate('ON LOCATION', 'Live from the patio')),
      slot('sky', 'Sky / Backdrop', 'window'),
      slot('banner', 'Standing Banner', 'banner', false, logo('RE', '#34d399')),
    ],
    tags: ['exterior', 'home', 'location', 'property'],
  },
  {
    id: 'green_room',
    name: 'Broadcast Green Room',
    description:
      'Backstage lounge with vanity mirror lights, a sofa cluster, the live show feed on the wall TV and ON AIR signage — the pre-show environment.',
    category: 'talk',
    tier: 'pro',
    accent: '#a78bfa',
    exposureBias: -0.03,
    camera: { yaw: 0.08, pitch: 0.13, zoom: 1.05 },
    talent: talentAt([-0.4, 0.9, 1.8], 2.1),
    backdropSlotId: 'backdrop',
    screens: [
      slot('show_feed', 'Show Feed TV', 'television', true, ticker('UP NEXT', 'Your segment starts in 04:32', '#a78bfa')),
      slot('on_air_sign', 'On-Air Sign', 'banner', false, logo('ON AIR', '#e11d48')),
      slot('backdrop', 'Hallway View', 'window', false, view('skyline')),
    ],
    tags: ['backstage', 'green-room', 'lounge', 'talk'],
  },
  {
    id: 'xr_concert',
    name: 'XR Concert Stage',
    description:
      'Arena-scale XR stage with curved LED walls, wing walls, overhead truss, floor glow lines and ribbon titles — for music, worship and awards shows.',
    category: 'concert',
    tier: 'pro_master',
    accent: '#22d3ee',
    exposureBias: -0.12,
    camera: { yaw: -0.1, pitch: 0.12, zoom: 0.9 },
    talent: talentAt([0, 1.05, 0.8]),
    backdropSlotId: 'backdrop',
    screens: [
      slot('main_wall', 'Main LED Wall', 'video-wall', true, view('stage-glow', '#22d3ee')),
      slot('left_wall', 'Wing Wall L', 'video-wall', false, logo('XR', '#22d3ee')),
      slot('right_wall', 'Wing Wall R', 'video-wall', false, logo('XR', '#22d3ee')),
      slot('ribbon', 'Stage Ribbon', 'ribbon', false, ticker('NOW PLAYING', 'Set list · Tour 2026', '#22d3ee')),
      slot('backdrop', 'Arena Backdrop', 'window', false, view('stadium')),
    ],
    tags: ['concert', 'music', 'xr', 'stage', 'awards'],
  },
  {
    id: 'cyclorama',
    name: 'Infinity Cyclorama',
    description:
      'Blank white infinity studio — replace the entire environment with a single image or live feed and composite talent in front of it.',
    category: 'blank',
    tier: 'free',
    accent: '#38bdf8',
    exposureBias: 0,
    camera: { yaw: 0, pitch: 0.1, zoom: 1 },
    talent: talentAt([0, 0.9, 0.9]),
    backdropSlotId: 'backdrop',
    screens: [
      slot('backdrop', 'Full Backdrop', 'window', true),
      slot('banner', 'Standing Banner', 'banner', false, logo('CC', '#38bdf8')),
    ],
    tags: ['blank', 'cyclorama', 'compositing', 'replace'],
  },
  {
    id: 'global_news_arena',
    name: 'Global News Arena',
    description:
      'Flagship multi-level news arena: tiered LED-edged risers, vortex media floor, red LED rails across concrete walls, monitor banks, interview lounge and twin truss rigs.',
    category: 'news',
    tier: 'pro_master',
    accent: '#e11d48',
    exposureBias: -0.16,
    camera: { yaw: -0.06, pitch: 0.15, zoom: 0.92 },
    talent: talentAt([0, 0.9, 1.1]),
    backdropSlotId: 'backdrop',
    screens: [
      slot('video_wall', 'Arena LED Wall', 'video-wall', true, breaking('GLOBAL SUMMIT EMERGENCY SESSION', 'World leaders gather as markets react to the overnight announcement', 'LIVE COVERAGE', '#e11d48')),
      slot('ticker', 'Arena Ticker', 'ribbon', false, ticker('BREAKING NEWS', 'Markets react to overnight summit', '#e11d48')),
      slot('side_screen', 'Side Monitor', 'monitor', false, slate('ON AIR', 'ARENA 1')),
      slot('desk_monitor', 'Desk Monitor', 'monitor', false, logo('GN', '#e11d48')),
      slot('backdrop', 'Set Backdrop', 'window', false, view('skyline')),
    ],
    tags: ['news', 'arena', 'flagship', 'led', 'multi-level'],
  },
  {
    id: 'classic_blue_news',
    name: 'Classic Blue News',
    description:
      'The iconic blue newsroom: curved world-map wall with lat/long grid, halo ceiling with recessed downlights, glowing white anchor desk and blue floor light lines.',
    category: 'news',
    tier: 'pro',
    accent: '#3b82f6',
    exposureBias: -0.08,
    camera: { yaw: 0, pitch: 0.12, zoom: 1.02 },
    talent: talentAt([0, 0.9, 0.85]),
    backdropSlotId: 'backdrop',
    screens: [
      slot('ticker', 'Headline Ticker', 'ribbon', true, ticker('WORLD NEWS', 'The stories shaping your day', '#3b82f6')),
      slot('desk_monitor', 'Desk Monitor', 'monitor', false, logo('WN', '#3b82f6')),
      slot('backdrop', 'Map Wall Replacement', 'window', false, view('skyline')),
    ],
    tags: ['news', 'classic', 'blue', 'world-map', 'broadcast'],
  },
  {
    id: 'amber_talk_studio',
    name: 'Amber Talk Studio',
    description:
      'Bright contemporary talk set: orange geometric frame walls, blue ceiling cove, black spot grid, white desk with amber inset, orange sofa lounge and curved LED floor line.',
    category: 'talk',
    tier: 'pro_master',
    accent: '#f97316',
    exposureBias: 0.04,
    camera: { yaw: 0.05, pitch: 0.13, zoom: 0.98 },
    talent: talentAt([0, 0.9, 1.15]),
    backdropSlotId: 'backdrop',
    screens: [
      slot('main_screen', 'Feature Wall', 'video-wall', true, rundown('TONIGHT ON AMBER', ['Award-winning interviews', 'Live music performances', 'Behind the scenes exclusives', 'Audience games & giveaways'], '#f97316')),
      slot('ticker', 'Show Ticker', 'ribbon', false, ticker('COMING UP', 'Interviews · Performances · More', '#f97316')),
      slot('side_screen', 'Wall Display', 'monitor', false, slate('BACKSTAGE', 'Cam 2')),
      slot('desk_monitor', 'Desk Monitor', 'monitor', false, logo('AS', '#f97316')),
      slot('backdrop', 'Set Backdrop', 'window', false, view('skyline')),
    ],
    tags: ['talk', 'interview', 'amber', 'modern', 'sofa'],
  },
  {
    id: 'crimson_ring_studio',
    name: 'Crimson Ring Studio',
    description:
      'Dark cinematic news studio under a glowing ceiling ring: triple screens, black gloss floors, red LED rails and a ringed anchor desk on a circular dais.',
    category: 'news',
    tier: 'pro',
    accent: '#ef4444',
    exposureBias: -0.18,
    camera: { yaw: 0, pitch: 0.13, zoom: 1 },
    talent: talentAt([0, 0.9, 1.15]),
    backdropSlotId: 'backdrop',
    screens: [
      slot('main_screen', 'Central Screen', 'video-wall', true, news('CRIMSON NEWS', 'CRIMSON', '#ef4444')),
      slot('ticker', 'Desk Ticker', 'ribbon', false, ticker('LATEST', 'Updates from every timezone', '#ef4444')),
      slot('side_screen', 'Side Screen', 'monitor', false, slate('CITY LIVE', 'Traffic · Weather')),
      slot('desk_monitor', 'Desk Monitor', 'monitor', false, logo('CN', '#ef4444')),
      slot('backdrop', 'Set Backdrop', 'window', false, view('skyline')),
    ],
    tags: ['news', 'dark', 'ring', 'cinematic', 'red'],
  },
  {
    id: 'violet_hud_news',
    name: 'Violet HUD News',
    description:
      'Futuristic violet news set: curved world-map wall, red HUD targeting graphics, hanging spot trio with haze beams and a glowing ringed desk on a purple stage.',
    category: 'news',
    tier: 'pro_master',
    accent: '#a78bfa',
    exposureBias: -0.12,
    camera: { yaw: 0, pitch: 0.12, zoom: 1 },
    talent: talentAt([0, 0.9, 1.05]),
    backdropSlotId: 'backdrop',
    screens: [
      slot('ticker', 'HUD Ticker', 'ribbon', true, ticker('TECH DESK', 'Signal locked · Feed live', '#a78bfa')),
      slot('desk_monitor', 'Desk Monitor', 'monitor', false, logo('VH', '#a78bfa')),
      slot('backdrop', 'Map Wall Replacement', 'window', false, view('skyline')),
    ],
    tags: ['news', 'hud', 'violet', 'futuristic', 'tech'],
  },
];

const SCENE_INDEX = new Map(STUDIO_SCENES.map((scene) => [scene.id, scene]));

export function getStudioScene(id: string): StudioSceneDefinition | undefined {
  return SCENE_INDEX.get(id);
}

export function getStudioSceneSlot(
  sceneId: string,
  slotId: string,
): StudioScreenSlot | undefined {
  return getStudioScene(sceneId)?.screens.find((s) => s.id === slotId);
}

const TIER_ORDER: Record<StudioTier | 'universal', number> = {
  free: 0,
  pro: 1,
  pro_master: 2,
  universal: 2,
};

/** Scenes unlocked by a plan id (`free`, `pro`, `pro_master`, `universal`). */
export function studioScenesForPlan(planId: string, max?: number): StudioSceneDefinition[] {
  const userTier = TIER_ORDER[planId as keyof typeof TIER_ORDER] ?? 0;
  const unlocked = STUDIO_SCENES.filter((scene) => TIER_ORDER[scene.tier] <= userTier);
  return typeof max === 'number' && max >= 0 ? unlocked.slice(0, max) : unlocked;
}

export function scenesForCategory(category: string): StudioSceneDefinition[] {
  return STUDIO_SCENES.filter((scene) => scene.category === category);
}

/**
 * Structural integrity check for the registry — run by tests so a malformed
 * scene can never ship (duplicate ids break persistence and feed binding).
 */
export function validateStudioScenes(scenes: StudioSceneDefinition[] = STUDIO_SCENES): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const scene of scenes) {
    if (seen.has(scene.id)) errors.push(`duplicate scene id: ${scene.id}`);
    seen.add(scene.id);
    if (!scene.name.trim()) errors.push(`scene ${scene.id} has an empty name`);
    if (!scene.screens.length) errors.push(`scene ${scene.id} declares no screens`);
    const slotIds = new Set<string>();
    for (const screen of scene.screens) {
      if (slotIds.has(screen.id)) errors.push(`scene ${scene.id} duplicate slot id: ${screen.id}`);
      slotIds.add(screen.id);
    }
    if (scene.backdropSlotId && !slotIds.has(scene.backdropSlotId)) {
      errors.push(`scene ${scene.id} backdropSlotId "${scene.backdropSlotId}" is not a declared slot`);
    }
    const required = scene.screens.filter((s) => s.required);
    if (required.length !== 1) {
      errors.push(`scene ${scene.id} must mark exactly one required screen (found ${required.length})`);
    }
    if (scene.camera.zoom <= 0) errors.push(`scene ${scene.id} camera zoom must be > 0`);
    if (scene.exposureBias < -2 || scene.exposureBias > 2) {
      errors.push(`scene ${scene.id} exposureBias out of range`);
    }
  }
  return errors;
}
