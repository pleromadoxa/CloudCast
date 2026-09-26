/**
 * Catalog of placeable photoreal set elements — plants, seating, tables,
 * screens, lighting and decor the operator can drop anywhere into a virtual
 * production set. Pure data (no WebGL) so placement logic is unit-testable.
 */

export type StudioElementCategory =
  | 'seating'
  | 'tables'
  | 'plants'
  | 'screens'
  | 'lighting'
  | 'decor'
  | 'stage';

export type StudioElementTier = 'free' | 'pro' | 'pro_master';

export interface StudioElementDef {
  id: string;
  name: string;
  category: StudioElementCategory;
  tier: StudioElementTier;
  /** Default uniform scale (1 = physical build size). */
  scale: number;
  /** Floor elevation of the model origin in metres (0 = on the floor). */
  elevation: number;
  /** Approximate footprint radius in metres — used for placement bounds. */
  footprint: number;
  /** Element hosts a live screen and can be bound to a source. */
  screen?: boolean;
  /** Photoreal scanned glTF model under `public/models/` (Poly Haven, CC0). */
  model?: { folder: string; height: number; rotationY?: number };
  tags: string[];
}

export const STUDIO_ELEMENT_CATEGORIES: { id: StudioElementCategory; label: string }[] = [
  { id: 'seating', label: 'Seating' },
  { id: 'tables', label: 'Tables' },
  { id: 'plants', label: 'Plants' },
  { id: 'screens', label: 'Screens & LED' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'decor', label: 'Decor' },
  { id: 'stage', label: 'Stage' },
];

function el(
  id: string,
  name: string,
  category: StudioElementCategory,
  tier: StudioElementTier,
  scale: number,
  footprint: number,
  tags: string[],
  elevation = 0,
  screen = false,
): StudioElementDef {
  return { id, name, category, tier, scale, elevation, footprint, tags, ...(screen ? { screen: true } : {}) };
}

/** Photoreal scanned glTF element (Poly Haven CC0 under `public/models/`). */
function mdl(
  id: string,
  name: string,
  category: StudioElementCategory,
  folder: string,
  height: number,
  footprint: number,
  tags: string[],
  elevation = 0,
  rotationY = 0,
): StudioElementDef {
  return { ...el(id, name, category, 'pro', 1, footprint, tags, elevation), model: { folder, height, rotationY } };
}

export const STUDIO_ELEMENTS: StudioElementDef[] = [
  // ---------------------------------------------------------------- seating
  el('sofa_three_seat', 'Sofa · 3-Seat', 'seating', 'free', 1, 1.5, ['sofa', 'couch', 'living-room']),
  el('sofa_two_seat', 'Sofa · 2-Seat', 'seating', 'free', 0.82, 1.2, ['sofa', 'couch', 'living-room']),
  el('sofa_sectional', 'Sofa · Sectional', 'seating', 'pro', 1.15, 1.9, ['sofa', 'couch', 'living-room']),
  el('armchair', 'Armchair', 'seating', 'free', 1, 0.8, ['chair', 'living-room']),
  el('lounge_chair', 'Lounge Chair', 'seating', 'pro', 1, 0.85, ['chair', 'lounge']),
  el('dining_chair', 'Dining Chair', 'seating', 'free', 1, 0.5, ['chair', 'dining']),
  el('bar_stool', 'Bar Stool', 'seating', 'free', 1, 0.4, ['stool', 'counter']),
  el('office_chair', 'Office Chair', 'seating', 'pro', 1, 0.55, ['chair', 'office']),
  el('bench', 'Studio Bench', 'seating', 'pro', 1, 1.1, ['bench', 'stage']),
  el('ottoman', 'Ottoman', 'seating', 'free', 1, 0.55, ['ottoman', 'living-room']),
  el('accent_chair_pair', 'Accent Chair Pair', 'seating', 'pro', 1, 1.3, ['chair', 'interview']),
  el('barrel_chair', 'Barrel Lounge Chair', 'seating', 'free', 1, 0.75, ['chair', 'lounge', 'tub']),
  el('scoop_lounge_chair', 'Scoop Lounge Chair', 'seating', 'free', 1, 0.8, ['chair', 'lounge', 'tub']),
  el('leather_dining_chair', 'Leather Dining Armchair', 'seating', 'free', 1, 0.55, ['chair', 'dining', 'leather']),

  // ----------------------------------------------------------------- tables
  el('coffee_table', 'Coffee Table', 'tables', 'free', 1, 0.8, ['table', 'living-room']),
  el('side_table', 'Side Table', 'tables', 'free', 1, 0.4, ['table', 'living-room']),
  el('dining_table', 'Dining Table', 'tables', 'free', 1, 1.4, ['table', 'dining']),
  el('desk', 'Executive Desk', 'tables', 'pro', 1, 1.3, ['desk', 'office']),
  el('console_table', 'Console Table', 'tables', 'pro', 1, 1.1, ['table', 'decor']),
  el('bar_counter', 'Bar Counter', 'tables', 'pro', 1, 1.6, ['counter', 'bar']),

  // ----------------------------------------------------------------- plants
  el('monstera', 'Monstera Plant', 'plants', 'free', 1, 0.6, ['plant', 'green']),
  el('palm_plant', 'Areca Palm', 'plants', 'free', 1, 0.75, ['plant', 'green']),
  el('ficus_tree', 'Ficus Tree', 'plants', 'free', 1, 0.7, ['plant', 'tree']),
  el('fern_pot', 'Boston Fern', 'plants', 'free', 1, 0.5, ['plant', 'green']),
  el('succulent_pot', 'Succulent Pot', 'plants', 'free', 1, 0.3, ['plant', 'small']),
  el('hedge_planter', 'Hedge Planter', 'plants', 'pro', 1, 1.2, ['plant', 'divider']),
  el('flower_vase', 'Flower Vase', 'plants', 'free', 1, 0.3, ['flowers', 'decor'], 0),

  // ---------------------------------------------------------------- screens
  el('tv_stand', 'Television · Stand', 'screens', 'free', 1, 1.1, ['tv', 'screen'], 0.72, true),
  el('tv_wall_mount', 'Television · Wall', 'screens', 'free', 1, 1.1, ['tv', 'screen'], 1.45, true),
  el('led_wall', 'LED Video Wall', 'screens', 'pro', 1, 2.2, ['led', 'screen'], 1.5, true),
  el('led_wall_dual', 'LED Wall · Dual', 'screens', 'pro_master', 1, 3, ['led', 'screen'], 1.5, true),
  el('monitor_desk', 'Desk Monitor', 'screens', 'free', 1, 0.55, ['monitor', 'screen'], 1.12, true),
  el('standing_banner', 'Standing Banner', 'screens', 'free', 1, 0.6, ['banner', 'signage'], 0, true),
  el('ribbon_banner', 'Ribbon Banner', 'screens', 'pro', 1, 1.6, ['banner', 'ticker'], 2.1, true),

  // --------------------------------------------------------------- lighting
  el('floor_lamp', 'Floor Lamp', 'lighting', 'free', 1, 0.5, ['lamp', 'practical']),
  el('pendant_lamp', 'Pendant Lamp', 'lighting', 'pro', 1, 0.45, ['lamp', 'hanging'], 2.1),
  el('uplight_can', 'Uplight Can', 'lighting', 'free', 1, 0.3, ['light', 'uplight']),
  el('studio_softbox', 'Studio Softbox', 'lighting', 'pro', 1, 0.7, ['light', 'studio']),

  // ------------------------------------------------------------------ decor
  el('area_rug', 'Area Rug', 'decor', 'free', 1, 1.8, ['rug', 'floor']),
  el('bookshelf', 'Bookshelf', 'decor', 'free', 1, 0.9, ['shelf', 'books']),
  el('artwork_frame', 'Artwork Frame', 'decor', 'free', 1, 0.7, ['art', 'wall'], 1.6),
  el('floor_mirror', 'Floor Mirror', 'decor', 'pro', 1, 0.8, ['mirror', 'decor']),
  el('sideboard', 'Sideboard', 'decor', 'pro', 1, 1.2, ['cabinet', 'storage']),
  el('coffee_table_books', 'Coffee Table Books', 'decor', 'free', 1, 0.35, ['books', 'decor'], 0.45),
  el('wall_clock', 'Wall Clock', 'decor', 'free', 1, 0.35, ['clock', 'wall'], 2.1),
  el('room_divider', 'Room Divider', 'decor', 'pro', 1, 1.3, ['divider', 'panel']),

  // ------------------------------------------------------------------ stage
  el('lectern', 'Lectern / Podium', 'stage', 'free', 1, 0.7, ['podium', 'speech']),
  el('stage_deck', 'Stage Deck', 'stage', 'pro', 1, 1.6, ['stage', 'platform']),
  el('anchor_desk', 'Anchor Desk', 'stage', 'free', 1, 1.8, ['desk', 'news']),
  el('sports_desk', 'Sports Desk', 'stage', 'pro', 1, 1.8, ['desk', 'sports']),
  el('presentation_screen', 'Presentation Screen', 'stage', 'pro', 1, 1.8, ['screen', 'presentation'], 1.2, true),
  el('led_floor_disc', 'LED Floor Disc', 'stage', 'pro', 1, 2.6, ['led', 'floor', 'media']),
  el('tiered_platform', 'Tiered Platform', 'stage', 'pro', 1, 4.2, ['stage', 'riser', 'steps']),

  // ------------------------------------------------------- signature sets
  el('glass_pendants', 'Glass Pendant Cluster', 'lighting', 'pro', 1, 1.5, ['lamp', 'kitchen', 'hanging'], 2.2),
  el('kitchen_island', 'Kitchen Island', 'decor', 'pro', 1, 1.7, ['kitchen', 'island', 'cooking']),
  el('kitchen_cabinets', 'Kitchen Cabinet Run', 'decor', 'pro', 1, 2.3, ['kitchen', 'cabinets', 'storage']),
  el('oven_stack', 'Built-in Oven Stack', 'decor', 'pro', 1, 0.55, ['kitchen', 'oven', 'cooking']),
  el('open_shelving', 'Open Wood Shelving', 'decor', 'pro', 1, 1.2, ['shelf', 'kitchen', 'decor']),
  el('curtain_panel', 'Curtain Panel', 'decor', 'pro', 1, 0.8, ['curtain', 'window', 'drape']),
  el('bed', 'Upholstered Bed', 'decor', 'pro', 1, 1.7, ['bed', 'bedroom', 'furniture']),

  // ---------------------------------------------- photoreal scanned models
  // CC0 models from Poly Haven, fetched by `node tools/fetch-ph-models.mjs`.
  mdl('ph_mid_century_lounge', 'Photoreal Mid-Century Lounge Chair', 'seating', 'mid_century_lounge_chair', 0.78, 0.7, ['chair', 'lounge', 'photoreal']),
  mdl('ph_modern_armchair', 'Photoreal Modern Armchair', 'seating', 'modern_arm_chair_01', 0.82, 0.75, ['chair', 'armchair', 'photoreal']),
  mdl('ph_classic_armchair', 'Photoreal Classic Armchair', 'seating', 'ArmChair_01', 0.92, 0.8, ['chair', 'armchair', 'photoreal']),
  mdl('ph_studio_sofa', 'Photoreal Studio Sofa', 'seating', 'Sofa_01', 0.82, 1.4, ['sofa', 'couch', 'photoreal']),
  mdl('ph_dining_chair', 'Photoreal Dining Chair', 'seating', 'dining_chair_02', 0.84, 0.5, ['chair', 'dining', 'photoreal']),
  mdl('ph_bar_chair', 'Photoreal Bar Chair', 'seating', 'bar_chair_round_01', 1.05, 0.45, ['chair', 'bar', 'photoreal']),
  mdl('ph_ottoman', 'Photoreal Ottoman', 'seating', 'Ottoman_01', 0.44, 0.55, ['ottoman', 'lounge', 'photoreal']),
  mdl('ph_wooden_stool', 'Photoreal Wooden Stool', 'seating', 'wooden_stool_01', 0.45, 0.35, ['stool', 'wood', 'photoreal']),
  mdl('ph_coffee_table_round', 'Photoreal Coffee Table · Round', 'tables', 'modern_coffee_table_01', 0.42, 0.75, ['table', 'coffee', 'photoreal']),
  mdl('ph_coffee_table_modern', 'Photoreal Coffee Table · Modern', 'tables', 'modern_coffee_table_02', 0.4, 0.85, ['table', 'coffee', 'photoreal']),
  mdl('ph_wooden_table', 'Photoreal Wooden Table', 'tables', 'WoodenTable_01', 0.75, 1.1, ['table', 'wood', 'photoreal']),
  mdl('ph_dining_table', 'Photoreal Dining Table', 'tables', 'dining_table', 0.76, 1.35, ['table', 'dining', 'photoreal']),
  mdl('ph_potted_broadleaf', 'Photoreal Potted Plant · Broadleaf', 'plants', 'potted_plant_01', 1.05, 0.55, ['plant', 'green', 'photoreal']),
  mdl('ph_potted_compact', 'Photoreal Potted Plant · Compact', 'plants', 'potted_plant_02', 0.9, 0.5, ['plant', 'green', 'photoreal']),
  mdl('ph_fern', 'Photoreal Fern', 'plants', 'fern_02', 0.75, 0.55, ['plant', 'fern', 'photoreal']),
  mdl('ph_pachira_tree', 'Photoreal Pachira Tree', 'plants', 'pachira_aquatica_01', 1.6, 0.8, ['plant', 'tree', 'photoreal']),
  mdl('ph_television', 'Photoreal Television', 'screens', 'Television_01', 0.78, 0.85, ['tv', 'screen', 'photoreal']),
  mdl('ph_throw_pillows', 'Photoreal Throw Pillows', 'decor', 'throw_pillows_01', 0.28, 0.5, ['pillow', 'decor', 'photoreal']),
  mdl('ph_book_set', 'Photoreal Encyclopedia Set', 'decor', 'book_encyclopedia_set_01', 0.3, 0.35, ['books', 'decor', 'photoreal']),
  mdl('ph_ornate_mirror', 'Photoreal Ornate Mirror', 'decor', 'ornate_mirror_01', 1.35, 0.7, ['mirror', 'wall', 'photoreal'], 0.4),
  mdl('ph_marble_bust', 'Photoreal Marble Bust', 'decor', 'marble_bust_01', 0.6, 0.4, ['sculpture', 'decor', 'photoreal']),
  mdl('ph_shelf_unit', 'Photoreal Shelf Unit', 'decor', 'Shelf_01', 1.9, 1.0, ['shelf', 'storage', 'photoreal']),
  mdl('ph_desk_lamp', 'Photoreal Desk Lamp', 'lighting', 'desk_lamp_arm_01', 0.55, 0.4, ['lamp', 'desk', 'photoreal']),
  mdl('ph_ceiling_lamp', 'Photoreal Ceiling Lamp', 'lighting', 'modern_ceiling_lamp_01', 0.45, 0.5, ['lamp', 'ceiling', 'photoreal'], 2.2),
  mdl('ph_chandelier', 'Photoreal Chandelier', 'lighting', 'Chandelier_01', 0.9, 0.8, ['lamp', 'chandelier', 'photoreal'], 2.3),

  // ---- second wave: studio props, office gear, decor, plants, lighting ----
  mdl('ph_rocking_chair', 'Photoreal Rocking Chair', 'seating', 'Rockingchair_01', 0.95, 0.6, ['chair', 'rocking', 'photoreal']),
  mdl('ph_school_chair', 'Photoreal School Chair', 'seating', 'SchoolChair_01', 0.82, 0.45, ['chair', 'classroom', 'photoreal']),
  mdl('ph_painted_bench', 'Photoreal Painted Bench', 'seating', 'painted_wooden_bench', 0.85, 0.9, ['bench', 'wood', 'photoreal']),
  mdl('ph_metal_stool', 'Photoreal Metal Stool', 'seating', 'metal_stool_01', 0.72, 0.3, ['stool', 'metal', 'photoreal']),
  mdl('ph_chinese_sofa', 'Photoreal Chinese Sofa', 'seating', 'chinese_sofa', 0.82, 1.3, ['sofa', 'wood', 'photoreal']),
  mdl('ph_school_desk', 'Photoreal School Desk', 'tables', 'SchoolDesk_01', 0.74, 0.7, ['desk', 'classroom', 'photoreal']),
  mdl('ph_classic_console', 'Photoreal Classic Console Table', 'tables', 'ClassicConsole_01', 0.85, 0.9, ['table', 'console', 'photoreal']),
  mdl('ph_classic_nightstand', 'Photoreal Classic Nightstand', 'tables', 'ClassicNightstand_01', 0.68, 0.4, ['table', 'bedroom', 'photoreal']),
  mdl('ph_metal_office_desk', 'Photoreal Metal Office Desk', 'tables', 'metal_office_desk', 0.76, 1.1, ['desk', 'office', 'photoreal']),
  mdl('ph_wooden_table_small', 'Photoreal Wooden Table · Small', 'tables', 'WoodenTable_02', 0.75, 0.9, ['table', 'wood', 'photoreal']),
  mdl('ph_coffee_table_rustic', 'Photoreal Industrial Coffee Table', 'tables', 'industrial_coffee_table', 0.45, 0.65, ['table', 'coffee', 'photoreal']),
  mdl('ph_coffee_table_round_2', 'Photoreal Coffee Table · Wood Round', 'tables', 'coffee_table_round_01', 0.45, 0.6, ['table', 'coffee', 'photoreal']),
  mdl('ph_drawer_cabinet', 'Photoreal Drawer Cabinet', 'decor', 'drawer_cabinet', 1.1, 0.7, ['cabinet', 'storage', 'photoreal']),
  mdl('ph_wooden_cabinet', 'Photoreal Wooden Cabinet', 'decor', 'modern_wooden_cabinet', 1.15, 0.9, ['cabinet', 'storage', 'photoreal']),
  mdl('ph_ceramic_vase', 'Photoreal Ceramic Vase', 'decor', 'ceramic_vase_02', 0.32, 0.2, ['vase', 'decor', 'photoreal']),
  mdl('ph_brass_vase', 'Photoreal Brass Vase', 'decor', 'brass_vase_01', 0.3, 0.2, ['vase', 'brass', 'photoreal']),
  mdl('ph_picture_frame', 'Photoreal Picture Frame', 'decor', 'fancy_picture_frame_01', 0.55, 0.4, ['art', 'frame', 'photoreal']),
  mdl('ph_standing_frame', 'Photoreal Standing Frame', 'decor', 'standing_picture_frame_01', 0.5, 0.35, ['art', 'frame', 'photoreal']),
  mdl('ph_mantel_clock', 'Photoreal Mantel Clock', 'decor', 'mantel_clock_01', 0.35, 0.3, ['clock', 'decor', 'photoreal']),
  mdl('ph_grandfather_clock', 'Photoreal Grandfather Clock', 'decor', 'vintage_grandfather_clock_01', 2.1, 0.45, ['clock', 'decor', 'photoreal']),
  mdl('ph_wicker_basket', 'Photoreal Wicker Basket', 'decor', 'wicker_basket_01', 0.35, 0.3, ['basket', 'decor', 'photoreal']),
  mdl('ph_chess_set', 'Photoreal Chess Set', 'decor', 'chess_set', 0.18, 0.25, ['game', 'decor', 'photoreal'], 0.45),
  mdl('ph_horse_statue', 'Photoreal Horse Statue', 'decor', 'horse_statue_01', 0.45, 0.3, ['sculpture', 'decor', 'photoreal']),
  mdl('ph_wooden_crate', 'Photoreal Wooden Crate', 'decor', 'wooden_crate_01', 0.3, 0.35, ['crate', 'storage', 'photoreal']),
  mdl('ph_film_camera', 'Photoreal Film Camera', 'decor', 'Camera_01', 0.55, 0.4, ['camera', 'studio', 'photoreal']),
  mdl('ph_megaphone', 'Photoreal Megaphone', 'decor', 'Megaphone_01', 0.3, 0.2, ['prop', 'studio', 'photoreal']),
  mdl('ph_alarm_clock', 'Photoreal Alarm Clock', 'decor', 'alarm_clock_01', 0.2, 0.15, ['clock', 'decor', 'photoreal'], 0.45),
  mdl('ph_american_football', 'Photoreal American Football', 'decor', 'american_football', 0.16, 0.15, ['sports', 'prop', 'photoreal'], 0.45),
  mdl('ph_soccer_ball', 'Photoreal Soccer Ball', 'decor', 'football', 0.22, 0.15, ['sports', 'prop', 'photoreal'], 0.45),
  mdl('ph_gamepad', 'Photoreal Gamepad', 'decor', 'gamepad', 0.07, 0.15, ['gaming', 'prop', 'photoreal'], 0.45),
  mdl('ph_laptop', 'Photoreal Laptop', 'decor', 'classic_laptop', 0.25, 0.3, ['computer', 'office', 'photoreal'], 0.45),
  mdl('ph_video_camera', 'Photoreal Vintage Video Camera', 'decor', 'vintage_video_camera', 0.5, 0.4, ['camera', 'studio', 'photoreal']),
  mdl('ph_radio_transceiver', 'Photoreal Radio Transceiver', 'decor', 'vintage_radio_transceiver', 0.35, 0.3, ['radio', 'prop', 'photoreal']),
  mdl('ph_boombox', 'Photoreal Boombox', 'decor', 'boombox', 0.3, 0.35, ['audio', 'prop', 'photoreal']),
  mdl('ph_binoculars', 'Photoreal Binoculars', 'decor', 'binoculars', 0.14, 0.15, ['prop', 'decor', 'photoreal'], 0.45),
  mdl('ph_gaming_console', 'Photoreal Gaming Console', 'decor', 'gaming_console', 0.1, 0.25, ['gaming', 'prop', 'photoreal'], 0.45),
  mdl('ph_film_projector', 'Photoreal Film Projector', 'decor', 'filmstrip_projector_8mm', 0.35, 0.35, ['projector', 'studio', 'photoreal']),
  mdl('ph_coffee_cart', 'Photoreal Coffee Cart', 'decor', 'CoffeeCart_01', 1.2, 0.8, ['cart', 'kitchen', 'photoreal']),
  mdl('ph_chandelier_tiered', 'Photoreal Chandelier · Tiered', 'lighting', 'Chandelier_02', 0.85, 0.7, ['lamp', 'chandelier', 'photoreal'], 2.3),
  mdl('ph_industrial_pendant', 'Photoreal Industrial Pendant', 'lighting', 'hanging_industrial_lamp', 0.5, 0.35, ['lamp', 'pendant', 'photoreal'], 2.2),
  mdl('ph_wall_lamp', 'Photoreal Wall Lamp', 'lighting', 'industrial_wall_lamp', 0.35, 0.25, ['lamp', 'wall', 'photoreal'], 1.9),
  mdl('ph_potted_plant_tall', 'Photoreal Potted Plant · Tall', 'plants', 'potted_plant_04', 1.0, 0.5, ['plant', 'green', 'photoreal']),
  mdl('ph_calathea', 'Photoreal Calathea Plant', 'plants', 'calathea_orbifolia_01', 0.8, 0.45, ['plant', 'green', 'photoreal']),
  mdl('ph_anthurium', 'Photoreal Anthurium Plant', 'plants', 'anthurium_botany_01', 0.55, 0.4, ['plant', 'flower', 'photoreal']),
  mdl('ph_shrub', 'Photoreal Shrub', 'plants', 'shrub_sorrel_01', 0.4, 0.5, ['plant', 'outdoor', 'photoreal']),
  mdl('ph_grass_clump', 'Photoreal Grass Clump', 'plants', 'grass_medium_02', 0.25, 0.35, ['grass', 'outdoor', 'photoreal']),
  mdl('ph_planter_box', 'Photoreal Planter Box', 'plants', 'planter_box_01', 0.5, 0.6, ['planter', 'outdoor', 'photoreal']),
  mdl('ph_ceramic_pot', 'Photoreal Ceramic Pot', 'plants', 'ceramic_pot', 0.28, 0.2, ['pot', 'decor', 'photoreal']),
];

const BY_ID = new Map(STUDIO_ELEMENTS.map((e) => [e.id, e]));

export function getStudioElement(id: string): StudioElementDef | undefined {
  return BY_ID.get(id);
}

const TIER_ORDER: Record<StudioElementTier, number> = { free: 0, pro: 1, pro_master: 2 };

/** Elements available on a plan (mirrors the scene tier unlock rules). */
export function studioElementsForPlan(planId: string): StudioElementDef[] {
  const rank = planId === 'pro_master' ? 2 : planId === 'pro' ? 1 : 0;
  return STUDIO_ELEMENTS.filter((e) => TIER_ORDER[e.tier] <= rank);
}

/** Stage floor bounds — elements are clamped so they can never leave the set. */
export const STAGE_BOUNDS = { minX: -6, maxX: 6, minZ: -4.5, maxZ: 5.5 };

export function clampElementPosition(x: number, z: number): [number, number] {
  return [
    Math.max(STAGE_BOUNDS.minX, Math.min(STAGE_BOUNDS.maxX, x)),
    Math.max(STAGE_BOUNDS.minZ, Math.min(STAGE_BOUNDS.maxZ, z)),
  ];
}

/** Deterministic spawn spot so new elements never stack on top of each other. */
export function spawnPosition(index: number): [number, number] {
  const col = index % 5;
  const row = Math.floor(index / 5) % 4;
  return clampElementPosition((col - 2) * 1.6, 1.2 + row * 1.5);
}

/** Placed-element factory — grounded, clamped, at the definition's default scale. */
export function createPlacedElement(
  elementId: string,
  index: number,
): { id: string; elementId: string; position: [number, number]; rotation: number; scale: number } | null {
  const def = getStudioElement(elementId);
  if (!def) return null;
  return {
    id: crypto.randomUUID(),
    elementId,
    position: spawnPosition(index),
    rotation: 0,
    scale: def.scale,
  };
}

/* ------------------------------------------------------- transforms */

/** Per-axis size limits — generous but never degenerate or absurd. */
export const SCALE_LIMITS = { min: 0.2, max: 4 } as const;
/** Height above the floor in metres (wall art, floating screens, shelves). */
export const ELEVATION_LIMITS = { min: 0, max: 3 } as const;

/**
 * Normalizes legacy uniform scales (number) and per-axis scales into a
 * [x, y, z] vector, clamped to sane bounds.
 */
export function normalizeElementScale(
  scale: number | [number, number, number] | undefined,
  fallback = 1,
): [number, number, number] {
  const clampAxis = (v: number) =>
    Math.max(SCALE_LIMITS.min, Math.min(SCALE_LIMITS.max, Number.isFinite(v) ? v : fallback));
  if (Array.isArray(scale)) {
    return [clampAxis(scale[0]), clampAxis(scale[1]), clampAxis(scale[2])];
  }
  const uniform = clampAxis(scale ?? fallback);
  return [uniform, uniform, uniform];
}

/** True when the scale has non-uniform (per-axis) stretch. */
export function isNonUniformScale(scale: number | [number, number, number] | undefined): boolean {
  const [x, y, z] = normalizeElementScale(scale);
  return Math.abs(x - y) > 1e-3 || Math.abs(y - z) > 1e-3;
}

export function clampElementElevation(elevation: number): number {
  return Math.max(ELEVATION_LIMITS.min, Math.min(ELEVATION_LIMITS.max, Number.isFinite(elevation) ? elevation : 0));
}
