import type { PrismSceneObject } from '../../types/prismFeed';
import { createPrismObjectId } from './prismIds';

export interface PrismSceneBundle {
  id: string;
  name: string;
  description: string;
  virtualSetId: string;
  tier: 'free' | 'pro' | 'pro_master';
  tags: string[];
  /** Suggested camera for this layout */
  camera: { yaw: number; pitch: number; zoom: number };
  objects: Omit<PrismSceneObject, 'id'>[];
}

function obj(
  catalogId: string,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale = 1,
): Omit<PrismSceneObject, 'id'> {
  return { catalogId, position, rotation, scale };
}

export const PRISM_SCENE_BUNDLES: PrismSceneBundle[] = [
  {
    id: 'newsroom_full',
    name: 'Newsroom Studio',
    description: 'Anchor desk, monitor wall, chairs, teleprompters, and LED backdrop — ready for live news.',
    virtualSetId: 'newsroom_full',
    tier: 'pro',
    tags: ['news', 'broadcast', 'studio'],
    camera: { yaw: 0, pitch: 0.12, zoom: 1 },
    objects: [
      obj('news_desk_01', [0, 0, 0]),
      obj('news_chair_01', [0, 0, 0.55]),
      obj('news_chair_02', [-0.9, 0, 0.35], [0, 0.25, 0]),
      obj('monitor_wall_01', [0, 0, 0]),
      obj('led_panel_01', [0, 0, 0]),
      obj('teleprompter_01', [0.35, 0, 0.2]),
      obj('teleprompter_02', [-0.35, 0, 0.2]),
      obj('spotlight_01', [-2.5, 0, -1], [0, 0.4, 0]),
      obj('spotlight_02', [2.5, 0, -1], [0, -0.4, 0]),
      obj('mic_01', [0.5, 0, 0.15]),
      obj('tripod_01', [2.2, 0, 1.5], [0, -0.6, 0]),
    ],
  },
  {
    id: 'news_desk_solo',
    name: 'Solo News Desk',
    description: 'Compact anchor desk setup for single-talent broadcasts.',
    virtualSetId: 'news_studio',
    tier: 'free',
    tags: ['news', 'desk'],
    camera: { yaw: 0, pitch: 0.1, zoom: 1.05 },
    objects: [
      obj('news_desk_03', [0, 0, 0]),
      obj('news_chair_03', [0, 0, 0.5]),
      obj('teleprompter_01', [0.3, 0, 0.15]),
      obj('monitor_wall_02', [0, 0, 0], [0, 0, 0], 0.85),
      obj('mic_02', [0.4, 0, 0.1]),
    ],
  },
  {
    id: 'church_worship',
    name: 'Church Worship Stage',
    description: 'Pulpit, altar, cross, pews, and choir risers for worship services.',
    virtualSetId: 'church_stage',
    tier: 'pro',
    tags: ['church', 'worship', 'stage'],
    camera: { yaw: 0, pitch: 0.18, zoom: 0.95 },
    objects: [
      obj('stage_02', [0, 0, -0.8]),
      obj('pulpit_01', [0, 0, -0.3]),
      obj('altar_01', [0, 0, -1.2]),
      obj('cross_01', [0, 0, 0]),
      obj('pew_01', [-1.8, 0, 1.2]),
      obj('pew_02', [1.8, 0, 1.2]),
      obj('pew_03', [-1.8, 0, 2.0]),
      obj('pew_04', [1.8, 0, 2.0]),
      obj('choir_riser_01', [0, 0, -2.0]),
      obj('spotlight_03', [-2, 0, 0], [0, 0.35, 0]),
      obj('spotlight_04', [2, 0, 0], [0, -0.35, 0]),
      obj('plant_01', [-2.5, 0, 0.5]),
      obj('plant_02', [2.5, 0, 0.5]),
    ],
  },
  {
    id: 'kitchen_modern',
    name: 'Modern Kitchen',
    description: 'Full kitchen with counters, island, appliances, and bar stools.',
    virtualSetId: 'kitchen_set',
    tier: 'pro',
    tags: ['kitchen', 'home', 'cooking'],
    camera: { yaw: 0.15, pitch: 0.14, zoom: 0.9 },
    objects: [
      obj('counter_01', [-1.5, 0, -1.5]),
      obj('counter_02', [1.5, 0, -1.5]),
      obj('island_01', [0, 0, 0]),
      obj('cabinet_01', [-2.2, 0, -1.5]),
      obj('cabinet_02', [2.2, 0, -1.5]),
      obj('cabinet_03', [-2.2, 0, -0.8]),
      obj('fridge_01', [-2.8, 0, 0], [0, Math.PI / 2, 0]),
      obj('stove_01', [0, 0, -1.5]),
      obj('sink_01', [1.0, 0, -1.5]),
      obj('bar_stool_01', [-0.35, 0, 0.55]),
      obj('bar_stool_02', [0.35, 0, 0.55]),
      obj('bar_stool_03', [0, 0, 0.55]),
      obj('lamp_01', [2.5, 0, 0.5]),
      obj('plant_03', [-0.5, 0, 0.8]),
    ],
  },
  {
    id: 'living_room',
    name: 'Furnished Living Room',
    description: 'Sofa, armchairs, coffee table, TV, rug, and decor — move-in ready.',
    virtualSetId: 'furnished_living',
    tier: 'free',
    tags: ['living-room', 'home', 'furnished'],
    camera: { yaw: 0, pitch: 0.15, zoom: 1 },
    objects: [
      obj('couch_01', [0, 0, 0.3]),
      obj('armchair_01', [-1.5, 0, 0], [0, 0.4, 0]),
      obj('armchair_02', [1.5, 0, 0], [0, -0.4, 0]),
      obj('coffee_table_01', [0, 0, 0.8]),
      obj('rug_01', [0, 0, 0.6]),
      obj('area_mat_01', [1.8, 0, -0.8]),
      obj('tv_01', [0, 0, 0]),
      obj('bookshelf_01', [-2.5, 0, -1], [0, 0.3, 0]),
      obj('lamp_02', [-2, 0, 0.5]),
      obj('lamp_03', [2, 0, 0.5]),
      obj('plant_04', [-1, 0, -0.5]),
      obj('plant_05', [1, 0, -0.5]),
      obj('ceiling_fan_01', [0, 0, -1.2]),
      obj('wall_decal_01', [-2.2, 0, 0]),
      obj('wall_shelf_01', [2.3, 0, 0]),
      obj('pendant_01', [0, 0, 0.2]),
    ],
  },
  {
    id: 'bedroom_suite',
    name: 'Furnished Bedroom',
    description: 'Bed, wardrobe, nightstands, rug, and soft lighting.',
    virtualSetId: 'furnished_bedroom',
    tier: 'pro',
    tags: ['bedroom', 'home', 'furnished'],
    camera: { yaw: 0.1, pitch: 0.16, zoom: 0.95 },
    objects: [
      obj('bed_01', [0, 0, -0.5]),
      obj('wardrobe_01', [-2.2, 0, -1], [0, 0.2, 0]),
      obj('desk_02', [2, 0, -0.8], [0, -0.35, 0]),
      obj('office_chair_02', [2, 0, -0.2]),
      obj('bookshelf_02', [2.5, 0, -1.5], [0, -0.5, 0]),
      obj('rug_02', [0, 0, 0.2]),
      obj('lamp_04', [-1.2, 0, -0.2]),
      obj('lamp_05', [1.2, 0, -0.2]),
      obj('plant_06', [-2, 0, 0.5]),
      obj('ceiling_fan_02', [0, 0, -0.8]),
      obj('pendant_02', [0, 0, 0.4]),
      obj('wall_decal_03', [0, 0, 0]),
    ],
  },
  {
    id: 'talk_show',
    name: 'Talk Show Stage',
    description: 'Stage platform, guest seating, desk, truss lighting, and curtains.',
    virtualSetId: 'talk_show',
    tier: 'pro_master',
    tags: ['talk-show', 'stage', 'interview'],
    camera: { yaw: 0, pitch: 0.14, zoom: 0.92 },
    objects: [
      obj('stage_03', [0, 0, -0.5]),
      obj('desk_03', [0, 0, 0.2]),
      obj('couch_05', [-1.2, 0, 0.5], [0, 0.3, 0]),
      obj('armchair_05', [1.2, 0, 0.5], [0, -0.3, 0]),
      obj('curtain_01', [0, 0, 0]),
      obj('truss_01', [0, 0, 0]),
      obj('spotlight_05', [-2, 0, 0]),
      obj('spotlight_06', [2, 0, 0]),
      obj('spotlight_07', [0, 0, -2], [0, 0, 0]),
      obj('mic_03', [0, 0, 0.35]),
      obj('tripod_02', [2.5, 0, 1.2], [0, -0.7, 0]),
    ],
  },
  {
    id: 'conference_room',
    name: 'Conference Room',
    description: 'Large table, office chairs, whiteboard, and presentation screen.',
    virtualSetId: 'conference_room',
    tier: 'pro',
    tags: ['corporate', 'meeting', 'office'],
    camera: { yaw: 0, pitch: 0.2, zoom: 0.88 },
    objects: [
      obj('conference_01', [0, 0, 0]),
      obj('office_chair_01', [0, 0, 0.9]),
      obj('office_chair_02', [0, 0, -0.9], [0, Math.PI, 0]),
      obj('office_chair_03', [-0.8, 0, 0.5], [0, 0.5, 0]),
      obj('office_chair_04', [0.8, 0, 0.5], [0, -0.5, 0]),
      obj('office_chair_05', [-0.8, 0, -0.5], [0, 2.6, 0]),
      obj('office_chair_06', [0.8, 0, -0.5], [0, -2.6, 0]),
      obj('whiteboard_01', [0, 0, 0]),
      obj('tv_02', [0, 0, 0], [0, 0, 0], 0.9),
      obj('plant_07', [-2.5, 0, 0]),
      obj('plant_08', [2.5, 0, 0]),
      obj('track_01', [0, 0, -1.5]),
      obj('wall_decal_02', [-3, 0, 0]),
      obj('ceiling_01', [-1.5, 0, -0.5]),
      obj('ceiling_02', [1.5, 0, -0.5]),
    ],
  },
  {
    id: 'sports_desk',
    name: 'Sports Broadcast Desk',
    description: 'Wide desk, multiple screens, and dynamic stage lighting.',
    virtualSetId: 'broadcast_desk',
    tier: 'pro',
    tags: ['sports', 'broadcast', 'desk'],
    camera: { yaw: 0, pitch: 0.1, zoom: 1 },
    objects: [
      obj('news_desk_05', [0, 0, 0], [0, 0, 0], 1.1),
      obj('news_chair_04', [0, 0, 0.55]),
      obj('news_chair_05', [-1, 0, 0.4], [0, 0.2, 0]),
      obj('monitor_wall_03', [0, 0, 0]),
      obj('led_panel_02', [0, 0, 0], [0, 0, 0], 0.8),
      obj('spotlight_08', [-2.5, 0, -0.5]),
      obj('spotlight_09', [2.5, 0, -0.5]),
      obj('mic_04', [0.6, 0, 0.1]),
    ],
  },
  {
    id: 'house_exterior',
    name: 'Residential Exterior',
    description: 'House shell with fence, trees, and driveway staging area.',
    virtualSetId: 'residential_exterior',
    tier: 'pro_master',
    tags: ['exterior', 'house', 'outdoor'],
    camera: { yaw: 0.2, pitch: 0.12, zoom: 0.75 },
    objects: [
      obj('house_01', [0, 0, -2]),
      obj('fence_01', [-3, 0, 0]),
      obj('fence_02', [3, 0, 0]),
      obj('tree_01', [-4, 0, -1]),
      obj('tree_02', [4, 0, -1]),
      obj('tree_03', [-3, 0, 2]),
      obj('stage_01', [0, 0, 1.5], [0, 0, 0], 0.6),
    ],
  },
  {
    id: 'green_room',
    name: 'Broadcast Green Room',
    description: 'Comfortable waiting area with couches, plants, and soft lighting.',
    virtualSetId: 'furnished_living',
    tier: 'free',
    tags: ['green-room', 'lounge', 'backstage'],
    camera: { yaw: 0.25, pitch: 0.14, zoom: 1 },
    objects: [
      obj('couch_03', [0, 0, 0.2]),
      obj('couch_04', [-1.8, 0, 0.5], [0, 0.5, 0], 0.85),
      obj('coffee_table_03', [0, 0, 0.9]),
      obj('rug_03', [0, 0, 0.5]),
      obj('lamp_06', [-2, 0, -0.3]),
      obj('lamp_07', [2, 0, -0.3]),
      obj('plant_09', [-1, 0, -0.8]),
      obj('plant_10', [1, 0, -0.8]),
      obj('tv_03', [0, 0, 0], [0, 0, 0], 0.7),
    ],
  },
  {
    id: 'xr_concert',
    name: 'XR Concert Stage',
    description: 'Full XR stage with truss, LED walls, curtains, and lighting rig.',
    virtualSetId: 'xr_stage',
    tier: 'pro_master',
    tags: ['xr', 'concert', 'stage'],
    camera: { yaw: 0, pitch: 0.16, zoom: 0.85 },
    objects: [
      obj('stage_04', [0, 0, -0.3]),
      obj('truss_02', [0, 0, 0]),
      obj('curtain_02', [0, 0, 0]),
      obj('led_panel_03', [0, 0, 0]),
      obj('cyclorama_01', [0, 0, 0]),
      obj('spotlight_10', [-2.5, 0, 0]),
      obj('spotlight_11', [2.5, 0, 0]),
      obj('spotlight_12', [0, 0, -2.5]),
      obj('mic_05', [0, 0, 0.3]),
      obj('tripod_03', [3, 0, 1], [0, -0.8, 0]),
    ],
  },
];

const TIER_ORDER: Record<string, number> = { free: 0, pro: 1, pro_master: 2, universal: 2 };

export function bundlesForPlan(planId: string): PrismSceneBundle[] {
  const userTier = TIER_ORDER[planId] ?? 0;
  return PRISM_SCENE_BUNDLES.filter((b) => TIER_ORDER[b.tier] <= userTier);
}

export function getSceneBundle(id: string): PrismSceneBundle | undefined {
  return PRISM_SCENE_BUNDLES.find((b) => b.id === id);
}

export function instantiateBundle(bundle: PrismSceneBundle): PrismSceneObject[] {
  return bundle.objects.map((o) => ({
    ...o,
    id: createPrismObjectId(),
  }));
}
