import type { MotionTemplateDefinition } from './motionGraphics';

/**
 * The extended template bank: 20 more 3D lower thirds and 20 more full-frame
 * motion templates for Regal Prism.
 *
 * Each entry carries its catalog definition (what the panel lists) plus a
 * compact visual preset consumed by the parameterised scene engines
 * (`scenes/lowerThirds`, `scenes/motionTemplates`). Keeping the design data
 * here — in plain TS — keeps the scene folders free of catalog churn and
 * makes the whole bank testable without a GPU.
 */

/* ------------------------------------------------------- visual vocabulary */

/** Geometry family for a 3D lower third. */
export const LOWER_THIRD_SHAPES = [
  'slab',
  'glass',
  'outline',
  'split',
  'shard',
  'line',
  'stripes',
  'velvet',
  'capsule',
  'holo',
  'grid',
  'editorial',
  'tag',
  'pillars',
  'card',
  'ribbon',
  'wave',
  'crest',
  'data',
  'prism',
] as const;

export type LowerThirdShape = (typeof LOWER_THIRD_SHAPES)[number];

/** How the plate enters / leaves frame. */
export const LOWER_THIRD_ENTRANCES = ['slide', 'split', 'wipe', 'drop', 'scale'] as const;

export type LowerThirdEntrance = (typeof LOWER_THIRD_ENTRANCES)[number];

export interface LowerThirdVisual {
  shape: LowerThirdShape;
  entrance: LowerThirdEntrance;
  /** Plate width in scene units. */
  width: number;
  /** Plate height in scene units. */
  height: number;
  /** Rest position of the plate centre. */
  x: number;
  y: number;
  /** Plate / paper / panel base colour. */
  plate: string;
  /** Ink colour for the headline. */
  ink: string;
  /** Secondary trim colour (rules, ticks, chips). */
  trim: string;
  /** Small chip label — "LIVE", a beat number, a market ticker… */
  chip?: string;
  /** Sub-line tracking multiplier (1 = default). */
  subKern?: number;
}

/** Full-frame composition family. */
export const MOTION_ORNAMENTS = [
  'mark',
  'rings',
  'streaks',
  'shards',
  'cards',
  'gridfloor',
  'horizon',
  'stars',
  'globe',
  'spotlight',
  'countdown',
  'shutter',
  'sweep',
  'converge',
  'rises',
] as const;

export type MotionOrnament = (typeof MOTION_ORNAMENTS)[number];

/** Camera move across the timeline. */
export const MOTION_CAMERAS = ['push', 'orbit', 'whip', 'crane', 'pullback', 'static'] as const;

export type MotionCamera = (typeof MOTION_CAMERAS)[number];

export interface MotionTemplateVisual {
  ornament: MotionOrnament;
  camera: MotionCamera;
  /** Impact flash + shock ring at the title punch. */
  flash?: boolean;
  /** Assemble the prism mark above the title. */
  mark?: boolean;
  /** Hairline rule under the sub-line. */
  rule?: boolean;
  /** Cone-burst sparkles at the punch. */
  particleBurst?: boolean;
  /** Volumetric shafts from above. */
  shafts?: boolean;
  /** Numeral / short label for countdown-style ornaments. */
  chip?: string;
}

/* ------------------------------------------------------ 20 3D LOWER THIRDS */

export const LOWER_THIRD_TEMPLATES: MotionTemplateDefinition[] = [
  {
    id: 'lt_prism_glass',
    name: 'Prism Glass',
    category: 'lower_third',
    duration: 6,
    blurb: 'Frosted glass slab with a light sweep and accent edge glow — clean modern news style.',
    headline: 'NADIA HARTMANN',
    subline: 'Senior International Correspondent',
    accent: '#38bdf8',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_gold_reserve',
    name: 'Gold Reserve',
    category: 'lower_third',
    duration: 6,
    blurb: 'Brushed gold plate with engraved rule and calm serif pacing — flagship interview look.',
    headline: 'SIR DAVID ANSAH',
    subline: 'Founding Director · Regal Institute',
    accent: '#f5c451',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_neon_edge',
    name: 'Neon Edge',
    category: 'lower_third',
    duration: 6,
    blurb: 'Dark plate framed by a glowing neon outline with corner brackets — late-night energy.',
    headline: 'KAI RIVERA',
    subline: 'Host · Prism After Dark',
    accent: '#34d399',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_broadcast_classic',
    name: 'Broadcast Classic',
    category: 'lower_third',
    duration: 6,
    blurb: 'White bar, dark ink, accent tick — the network-evening standard rebuilt in 3D.',
    headline: 'ELEANOR PRICE',
    subline: 'Network News · Washington',
    accent: '#e11d48',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_split_gate',
    name: 'Split Gate',
    category: 'lower_third',
    duration: 6,
    blurb: 'Twin plates fly in from both sides and lock together at centre — great for debates.',
    headline: 'MARCUS & LEILA',
    subline: 'The Exchange · Tonight',
    accent: '#a78bfa',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_angular_shard',
    name: 'Angular Shard',
    category: 'lower_third',
    duration: 6,
    blurb: 'Sheared shard plates with a diagonal accent cut — sport and motorsport attitude.',
    headline: 'TOMÁS VIEIRA',
    subline: 'Pit Lane · Race Weekend',
    accent: '#fb7185',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_minimal_line',
    name: 'Minimal Line',
    category: 'lower_third',
    duration: 6,
    blurb: 'No plate at all — extruded type on a hairline rule with an accent square. Documentary quiet.',
    headline: 'DR. INGRID SOLBERG',
    subline: 'Polar Research Unit',
    accent: '#e2e8f0',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_carbon_sport',
    name: 'Carbon Sport',
    category: 'lower_third',
    duration: 6,
    blurb: 'Carbon plate with angled speed stripes and a stat chip — match-day numbers ready.',
    headline: 'JORDAN NKEMELU',
    subline: 'Sports Desk · Matchday',
    accent: '#22d3ee',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_velvet_lounge',
    name: 'Velvet Lounge',
    category: 'lower_third',
    duration: 6,
    blurb: 'Velvet panel with real fabric sheen and gold trim — arts and culture evenings.',
    headline: 'AMARA DIALLO',
    subline: 'The Culture Hour',
    accent: '#f5c451',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_glass_capsule',
    name: 'Glass Capsule',
    category: 'lower_third',
    duration: 6,
    blurb: 'Rounded capsule pill with a ring accent and soft float — tech and product shows.',
    headline: 'YUKI TANAKA',
    subline: 'Product Lead · Prism Labs',
    accent: '#38bdf8',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_holo_deck',
    name: 'Holo Deck',
    category: 'lower_third',
    duration: 6,
    blurb: 'Translucent hologram panel with scan glow and additive frame — science fiction register.',
    headline: 'COMMANDER AYERS',
    subline: 'Mission Control · Live',
    accent: '#22d3ee',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_wire_grid',
    name: 'Wire Grid',
    category: 'lower_third',
    duration: 6,
    blurb: 'HUD grid plate with tick marks and corner brackets — elections and data nights.',
    headline: 'PROJECTION DESK',
    subline: 'Decision Night · Seat 214',
    accent: '#34d399',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_editorial',
    name: 'Editorial',
    category: 'lower_third',
    duration: 6,
    blurb: 'Paper-white bar with double rules and column ticks — broadsheet journalism in 3D.',
    headline: 'HELENA WHITFIELD',
    subline: 'Editor at Large',
    accent: '#b45309',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_ember_tag',
    name: 'Ember Tag',
    category: 'lower_third',
    duration: 6,
    blurb: 'Dark plate with a hot accent tag chip riding the top edge — breaking-news register.',
    headline: 'BREAKING · AMINATA SESAY',
    subline: 'West Africa Bureau',
    accent: '#fb7185',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_twin_pillar',
    name: 'Twin Pillar',
    category: 'lower_third',
    duration: 6,
    blurb: 'Two vertical pillars bridge a floating nameplate — architecture-show precision.',
    headline: 'ARCH. LUIS FERRERO',
    subline: 'Design Review · Milan',
    accent: '#f5c451',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_soft_card',
    name: 'Soft Card',
    category: 'lower_third',
    duration: 6,
    blurb: 'Light card with a soft shadow and accent underline — morning-show friendliness.',
    headline: 'SOFIA MARCHETTI',
    subline: 'Breakfast Live · Milan',
    accent: '#f472b6',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_ribbon_fold',
    name: 'Ribbon Fold',
    category: 'lower_third',
    duration: 6,
    blurb: 'Folded ribbon plates with a bright seam — award-show and gala presentation.',
    headline: 'THE REGAL GALA',
    subline: 'Lifetime Achievement',
    accent: '#f5c451',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_aurora_wave',
    name: 'Aurora Wave',
    category: 'lower_third',
    duration: 6,
    blurb: 'Wave-edged panel with an aurora glow bar — travel and nature programming.',
    headline: 'LENA OLESEN',
    subline: 'Wild North · Episode 4',
    accent: '#38bdf8',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_royal_crest',
    name: 'Royal Crest',
    category: 'lower_third',
    duration: 6,
    blurb: 'Prism medallion with a gold rim beside the nameplate — state and royal coverage.',
    headline: 'THE STATE BROADCAST',
    subline: 'Special Correspondent',
    accent: '#f5c451',
    loopable: false,
    fullFrame: false,
  },
  {
    id: 'lt_data_stream',
    name: 'Data Stream',
    category: 'lower_third',
    duration: 6,
    blurb: 'Ticker-style plate with data chips and a progress line — markets and elections.',
    headline: 'MARKET CLOSE',
    subline: 'Global Exchange Desk',
    accent: '#34d399',
    loopable: false,
    fullFrame: false,
  },
];

export const LOWER_THIRD_VISUALS: Record<string, LowerThirdVisual> = {
  lt_prism_glass: {
    shape: 'glass', entrance: 'slide', width: 6.4, height: 0.78, x: -1.15, y: -1.5,
    plate: '#0e1420', ink: '#eef4ff', trim: '#38bdf8',
  },
  lt_gold_reserve: {
    shape: 'slab', entrance: 'slide', width: 6.2, height: 0.72, x: -1.25, y: -1.5,
    plate: '#2a2113', ink: '#f7e9c6', trim: '#f5c451', chip: 'REGAL',
    subKern: 1.3,
  },
  lt_neon_edge: {
    shape: 'outline', entrance: 'scale', width: 6.1, height: 0.82, x: -1.2, y: -1.5,
    plate: '#080b12', ink: '#eafff4', trim: '#34d399',
  },
  lt_broadcast_classic: {
    shape: 'slab', entrance: 'wipe', width: 6.0, height: 0.7, x: -1.35, y: -1.52,
    plate: '#f3f4f6', ink: '#101418', trim: '#e11d48',
  },
  lt_split_gate: {
    shape: 'split', entrance: 'split', width: 6.4, height: 0.74, x: -0.9, y: -1.5,
    plate: '#120f22', ink: '#f2eefe', trim: '#a78bfa',
  },
  lt_angular_shard: {
    shape: 'shard', entrance: 'slide', width: 6.3, height: 0.78, x: -1.1, y: -1.48,
    plate: '#160a10', ink: '#ffeef2', trim: '#fb7185',
  },
  lt_minimal_line: {
    shape: 'line', entrance: 'wipe', width: 5.6, height: 0.62, x: -1.5, y: -1.5,
    plate: '#0b0d12', ink: '#f4f7fb', trim: '#e2e8f0', subKern: 1.4,
  },
  lt_carbon_sport: {
    shape: 'stripes', entrance: 'slide', width: 6.4, height: 0.8, x: -1.15, y: -1.48,
    plate: '#0a0d12', ink: '#eafcff', trim: '#22d3ee', chip: '24',
  },
  lt_velvet_lounge: {
    shape: 'velvet', entrance: 'drop', width: 6.2, height: 0.76, x: -1.2, y: -1.5,
    plate: '#2a0e1c', ink: '#fdeef2', trim: '#f5c451',
  },
  lt_glass_capsule: {
    shape: 'capsule', entrance: 'scale', width: 6.0, height: 0.66, x: -1.3, y: -1.52,
    plate: '#0d1522', ink: '#eaf4ff', trim: '#38bdf8',
  },
  lt_holo_deck: {
    shape: 'holo', entrance: 'scale', width: 6.2, height: 0.8, x: -1.2, y: -1.5,
    plate: '#06121c', ink: '#d9fbff', trim: '#22d3ee',
  },
  lt_wire_grid: {
    shape: 'grid', entrance: 'wipe', width: 6.3, height: 0.8, x: -1.15, y: -1.5,
    plate: '#07110c', ink: '#e7fff2', trim: '#34d399', chip: 'PROJ',
  },
  lt_editorial: {
    shape: 'editorial', entrance: 'slide', width: 6.1, height: 0.74, x: -1.3, y: -1.5,
    plate: '#f4f1ea', ink: '#1c1917', trim: '#b45309', subKern: 1.2,
  },
  lt_ember_tag: {
    shape: 'tag', entrance: 'slide', width: 6.2, height: 0.74, x: -1.2, y: -1.56,
    plate: '#140a0c', ink: '#ffe9ec', trim: '#fb7185', chip: 'BREAKING',
  },
  lt_twin_pillar: {
    shape: 'pillars', entrance: 'drop', width: 6.2, height: 0.78, x: -1.15, y: -1.5,
    plate: '#101318', ink: '#f2f5fa', trim: '#f5c451',
  },
  lt_soft_card: {
    shape: 'card', entrance: 'drop', width: 6.0, height: 0.78, x: -1.35, y: -1.5,
    plate: '#fbf8f4', ink: '#221c17', trim: '#f472b6',
  },
  lt_ribbon_fold: {
    shape: 'ribbon', entrance: 'slide', width: 6.3, height: 0.78, x: -1.1, y: -1.5,
    plate: '#1a1206', ink: '#fdf2d8', trim: '#f5c451',
  },
  lt_aurora_wave: {
    shape: 'wave', entrance: 'slide', width: 6.3, height: 0.78, x: -1.15, y: -1.5,
    plate: '#07131c', ink: '#e7f7ff', trim: '#38bdf8',
  },
  lt_royal_crest: {
    shape: 'crest', entrance: 'scale', width: 6.2, height: 0.78, x: -1.0, y: -1.5,
    plate: '#171007', ink: '#f9eecd', trim: '#f5c451',
  },
  lt_data_stream: {
    shape: 'data', entrance: 'wipe', width: 6.4, height: 0.8, x: -1.15, y: -1.5,
    plate: '#06110d', ink: '#e8fff4', trim: '#34d399', chip: 'LIVE',
  },
};

/* ------------------------------------------------- 20 FULL-FRAME TEMPLATES */

export const MOTION_TEMPLATE_BANK: MotionTemplateDefinition[] = [
  {
    id: 'mt_sovereign_rise',
    name: 'Sovereign Rise',
    category: 'opener',
    duration: 8,
    blurb: 'Light shafts ignite as the prism mark assembles and the title rises to a locked hold.',
    headline: 'REGAL PRISM',
    subline: 'A NEW SEASON BEGINS',
    accent: '#f5c451',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'aurora',
  },
  {
    id: 'mt_galaxy_news',
    name: 'Galaxy News Hour',
    category: 'opener',
    duration: 9,
    blurb: 'Star field under slow drift with orbiting rings — the flagship evening news open.',
    headline: 'THE EVENING REPORT',
    subline: 'LIVE · WORLDWIDE',
    accent: '#38bdf8',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'star_field',
  },
  {
    id: 'mt_data_desk',
    name: 'Data Desk',
    category: 'opener',
    duration: 8,
    blurb: 'Camera skims a luminous data grid while the title types into place.',
    headline: 'DATA DESK',
    subline: 'MARKETS · POLICY · TECHNOLOGY',
    accent: '#34d399',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'data_grid',
  },
  {
    id: 'mt_aurora_sky',
    name: 'Aurora Sky',
    category: 'opener',
    duration: 9,
    blurb: 'Slow push through aurora haze as the wordmark condenses out of the glow.',
    headline: 'WILD HORIZONS',
    subline: 'THE NATURE DOCUMENTARY',
    accent: '#38bdf8',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'aurora',
  },
  {
    id: 'mt_neon_pulse',
    name: 'Neon Pulse',
    category: 'opener',
    duration: 8,
    blurb: 'Rush down a neon ring tunnel — the title punches on at the whip-pan exit.',
    headline: 'PRISM NIGHTS',
    subline: 'FRIDAY · 22:00',
    accent: '#34d399',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'plasma_smoke',
  },
  {
    id: 'mt_world_stage',
    name: 'World Stage',
    category: 'opener',
    duration: 9,
    blurb: 'A wireframe globe turns under arc rings and city glints before the title lands.',
    headline: 'WORLD STAGE',
    subline: 'THE GLOBAL AFFAIRS DESK',
    accent: '#38bdf8',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'star_field',
  },
  {
    id: 'mt_prism_rings',
    name: 'Prism Rings',
    category: 'bumper',
    duration: 7,
    blurb: 'Three metal rings orbit a luminous core as the camera circles — elegant interstitial.',
    headline: 'STAY WITH US',
    subline: 'MORE AFTER THE BREAK',
    accent: '#f5c451',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'none',
  },
  {
    id: 'mt_light_speed',
    name: 'Light Speed',
    category: 'bumper',
    duration: 6,
    blurb: 'Streaking light lines tear past a whip camera, then snap into the title.',
    headline: 'NEXT UP',
    subline: 'THE LATE EDITION',
    accent: '#22d3ee',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'plasma_smoke',
  },
  {
    id: 'mt_crystal_shard',
    name: 'Crystal Shard',
    category: 'bumper',
    duration: 7,
    blurb: 'Faceted crystal shards tumble and catch studio light before the lockup.',
    headline: 'THE DESIGN HOUR',
    subline: 'MATERIAL · FORM · LIGHT',
    accent: '#a78bfa',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'nebula',
  },
  {
    id: 'mt_soft_showcase',
    name: 'Soft Showcase',
    category: 'bumper',
    duration: 7,
    blurb: 'Floating soft-lit cards drift past a slow crane — product and lifestyle bumpers.',
    headline: 'THE SHOWCASE',
    subline: 'CURATED THIS WEEK',
    accent: '#f472b6',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'none',
  },
  {
    id: 'mt_countdown',
    name: 'Countdown',
    category: 'bumper',
    duration: 8,
    blurb: 'A luminous numeral ring counts down inside tick marks — top-of-the-hour standby.',
    headline: 'ON AIR SHORTLY',
    subline: 'THE HOUR BEGINS',
    accent: '#fb7185',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'data_grid',
  },
  {
    id: 'mt_spotlight',
    name: 'Spotlight',
    category: 'bumper',
    duration: 7,
    blurb: 'Sweeping spotlight cones cross a dark stage floor as the title steps into the light.',
    headline: 'CENTRE STAGE',
    subline: 'LIVE THEATRE',
    accent: '#f5c451',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'none',
  },
  {
    id: 'mt_gold_impact',
    name: 'Gold Impact',
    category: 'sting',
    duration: 3.5,
    blurb: 'Slam-zoom, white-hot flash, title punches on — sub-four-second impact sting.',
    headline: 'MOMENT OF TRUTH',
    subline: 'THE FINAL',
    accent: '#f5c451',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'none',
  },
  {
    id: 'mt_chrome_swipe',
    name: 'Chrome Swipe',
    category: 'sting',
    duration: 3.5,
    blurb: 'A specular wipe rakes the frame and the title snaps in behind it.',
    headline: 'EXCLUSIVE',
    subline: 'FIRST ON REGAL PRISM',
    accent: '#cfd8e3',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'none',
  },
  {
    id: 'mt_shockwave',
    name: 'Shockwave',
    category: 'sting',
    duration: 3.5,
    blurb: 'Stacked shock rings detonate outward while the title punches through the haze.',
    headline: 'BREAKING NOW',
    subline: 'DEVELOPING STORY',
    accent: '#fb7185',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'plasma_smoke',
  },
  {
    id: 'mt_shutter',
    name: 'Shutter',
    category: 'sting',
    duration: 3.5,
    blurb: 'Twin chrome plates snap shut and flash open onto the title — crisp cut-away.',
    headline: 'WE’RE BACK',
    subline: 'REGAL PRISM',
    accent: '#cfd8e3',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'none',
  },
  {
    id: 'mt_signature_outro',
    name: 'Signature Outro',
    category: 'outro',
    duration: 9,
    blurb: 'The mark settles under a slow orbit while the wordmark and tagline hold to black.',
    headline: 'REGAL PRISM',
    subline: 'PICTURES IN MOTION',
    accent: '#f5c451',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'deep_field',
  },
  {
    id: 'mt_credit_roll',
    name: 'Credit Roll',
    category: 'outro',
    duration: 10,
    blurb: 'End card with drawing rule lines and a slow drift — credits and thanks sequence.',
    headline: 'THANK YOU FOR WATCHING',
    subline: 'A REGAL PRISM PRODUCTION',
    accent: '#cfd8e3',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'none',
  },
  {
    id: 'mt_horizon_outro',
    name: 'Horizon Outro',
    category: 'outro',
    duration: 9,
    blurb: 'A luminous horizon sinks to embers as the wordmark silhouettes against the glow.',
    headline: 'UNTIL NEXT TIME',
    subline: 'REGAL PRISM · GLOBAL',
    accent: '#fb7185',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'nebula',
  },
  {
    id: 'mt_starlight_outro',
    name: 'Starlight Outro',
    category: 'outro',
    duration: 9,
    blurb: 'The mark floats in a star field while the camera eases back to a final hold.',
    headline: 'GOOD NIGHT',
    subline: 'SEE YOU TOMORROW',
    accent: '#a78bfa',
    loopable: true,
    fullFrame: true,
    defaultBackground: 'star_field',
  },
];

export const MOTION_VISUALS: Record<string, MotionTemplateVisual> = {
  mt_sovereign_rise: { ornament: 'rises', camera: 'push', flash: true, mark: true, rule: true, shafts: true, particleBurst: true },
  mt_galaxy_news: { ornament: 'stars', camera: 'orbit', mark: true, rule: true, particleBurst: true },
  mt_data_desk: { ornament: 'gridfloor', camera: 'crane', rule: true },
  mt_aurora_sky: { ornament: 'horizon', camera: 'push', rule: true },
  mt_neon_pulse: { ornament: 'rings', camera: 'whip', flash: true, particleBurst: true },
  mt_world_stage: { ornament: 'globe', camera: 'orbit', rule: true },
  mt_prism_rings: { ornament: 'rings', camera: 'orbit', mark: true },
  mt_light_speed: { ornament: 'streaks', camera: 'whip', flash: true },
  mt_crystal_shard: { ornament: 'shards', camera: 'crane', particleBurst: true },
  mt_soft_showcase: { ornament: 'cards', camera: 'crane', rule: true },
  mt_countdown: { ornament: 'countdown', camera: 'static', chip: '5', rule: true },
  mt_spotlight: { ornament: 'spotlight', camera: 'push', shafts: true, rule: true },
  mt_gold_impact: { ornament: 'converge', camera: 'push', flash: true, particleBurst: true },
  mt_chrome_swipe: { ornament: 'sweep', camera: 'static', flash: true },
  mt_shockwave: { ornament: 'converge', camera: 'push', flash: true, particleBurst: true },
  mt_shutter: { ornament: 'shutter', camera: 'static', flash: true },
  mt_signature_outro: { ornament: 'mark', camera: 'orbit', mark: true, rule: true },
  mt_credit_roll: { ornament: 'cards', camera: 'pullback', rule: true },
  mt_horizon_outro: { ornament: 'horizon', camera: 'pullback', rule: true },
  mt_starlight_outro: { ornament: 'stars', camera: 'pullback', mark: true, particleBurst: true },
};

/** Every template in the bank, in catalog order (lower thirds first). */
export const MOTION_TEMPLATE_BANK_ALL: MotionTemplateDefinition[] = [
  ...LOWER_THIRD_TEMPLATES,
  ...MOTION_TEMPLATE_BANK,
];
