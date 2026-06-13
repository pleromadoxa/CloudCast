import type { PlanTier } from '../../types/plans';
import type { PrismSceneObject } from '../../types/prismFeed';
import { createPrismObjectId } from './prismIds';

export type PrismModelCategory =
  | 'furniture'
  | 'architecture'
  | 'stages'
  | 'newsroom'
  | 'church'
  | 'kitchen'
  | 'decor'
  | 'lighting'
  | 'exterior'
  | 'finishing';

export type PrismModelTier = 'free' | 'pro' | 'pro_master';

export interface PrismModelCatalogEntry {
  id: string;
  name: string;
  category: PrismModelCategory;
  tags: string[];
  tier: PrismModelTier;
  generatorId: string;
  variant: number;
  defaultTransform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  };
}

const TIER_ORDER: Record<string, number> = { free: 0, pro: 1, pro_master: 2, universal: 2 };

function entry(
  id: string,
  name: string,
  category: PrismModelCategory,
  generatorId: string,
  variant: number,
  tier: PrismModelTier,
  tags: string[],
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
  scale = 1,
): PrismModelCatalogEntry {
  return {
    id,
    name,
    category,
    tags,
    tier,
    generatorId,
    variant,
    defaultTransform: { position, rotation, scale },
  };
}

function pushVariants(
  list: PrismModelCatalogEntry[],
  prefix: string,
  label: string,
  category: PrismModelCategory,
  generatorId: string,
  count: number,
  tier: PrismModelTier,
  tags: string[],
) {
  for (let i = 0; i < count; i++) {
    list.push(entry(`${prefix}_${String(i + 1).padStart(2, '0')}`, `${label} ${i + 1}`, category, generatorId, i, tier, tags));
  }
}

function buildCatalog(): PrismModelCatalogEntry[] {
  const c: PrismModelCatalogEntry[] = [];

  pushVariants(c, 'couch', 'Sofa', 'furniture', 'couch', 14, 'free', ['seating', 'living-room']);
  pushVariants(c, 'armchair', 'Armchair', 'furniture', 'armchair', 10, 'free', ['seating', 'living-room']);
  pushVariants(c, 'coffee_table', 'Coffee Table', 'furniture', 'coffee_table', 10, 'free', ['table', 'living-room']);
  pushVariants(c, 'dining_table', 'Dining Table', 'furniture', 'dining_table', 10, 'pro', ['table', 'dining']);
  pushVariants(c, 'desk', 'Desk', 'furniture', 'desk', 10, 'pro', ['office', 'work']);
  pushVariants(c, 'bed', 'Bed', 'furniture', 'bed', 8, 'pro', ['bedroom', 'sleep']);
  pushVariants(c, 'bookshelf', 'Bookshelf', 'furniture', 'bookshelf', 8, 'pro', ['storage', 'office']);
  pushVariants(c, 'wardrobe', 'Wardrobe', 'furniture', 'wardrobe', 6, 'pro', ['storage', 'bedroom']);
  pushVariants(c, 'office_chair', 'Office Chair', 'furniture', 'office_chair', 10, 'pro', ['seating', 'office']);
  pushVariants(c, 'bar_stool', 'Bar Stool', 'furniture', 'bar_stool', 8, 'pro', ['seating', 'kitchen']);

  pushVariants(c, 'wall_panel', 'Wall Panel', 'architecture', 'wall_panel', 12, 'free', ['wall', 'structure']);
  pushVariants(c, 'wall_corner', 'Wall Corner', 'architecture', 'wall_corner', 6, 'pro', ['wall', 'structure']);
  pushVariants(c, 'door', 'Door', 'architecture', 'door', 8, 'pro', ['door', 'structure']);
  pushVariants(c, 'window', 'Window', 'architecture', 'window', 8, 'pro', ['window', 'structure']);
  pushVariants(c, 'pillar', 'Column', 'architecture', 'pillar', 8, 'pro', ['structure', 'support']);
  pushVariants(c, 'stairs', 'Staircase', 'architecture', 'stairs', 6, 'pro_master', ['structure', 'stairs']);
  pushVariants(c, 'house', 'House', 'architecture', 'house_shell', 6, 'pro_master', ['exterior', 'building']);

  pushVariants(c, 'stage', 'Stage Platform', 'stages', 'stage_platform', 8, 'pro', ['stage', 'performance']);
  pushVariants(c, 'truss', 'Lighting Truss', 'stages', 'truss', 8, 'pro', ['stage', 'rigging']);
  pushVariants(c, 'curtain', 'Stage Curtain', 'stages', 'curtain', 6, 'pro', ['stage', 'backdrop']);
  pushVariants(c, 'podium', 'Podium', 'stages', 'podium', 8, 'pro', ['stage', 'speaking']);
  pushVariants(c, 'cyclorama', 'Cyclorama', 'stages', 'cyclorama', 4, 'pro_master', ['stage', 'backdrop']);

  pushVariants(c, 'news_desk', 'Anchor Desk', 'newsroom', 'news_desk', 10, 'pro', ['news', 'desk']);
  pushVariants(c, 'monitor_wall', 'Monitor Wall', 'newsroom', 'monitor_wall', 8, 'pro', ['news', 'screens']);
  pushVariants(c, 'news_chair', 'News Chair', 'newsroom', 'news_chair', 8, 'pro', ['news', 'seating']);
  pushVariants(c, 'teleprompter', 'Teleprompter', 'newsroom', 'teleprompter', 6, 'pro_master', ['news', 'broadcast']);
  pushVariants(c, 'led_panel', 'LED Video Wall', 'newsroom', 'led_panel', 6, 'pro_master', ['news', 'led']);

  pushVariants(c, 'pulpit', 'Pulpit', 'church', 'church_pulpit', 8, 'pro', ['church', 'worship']);
  pushVariants(c, 'pew', 'Church Pew', 'church', 'church_pew', 10, 'pro', ['church', 'seating']);
  pushVariants(c, 'cross', 'Cross', 'church', 'cross', 6, 'free', ['church', 'symbol']);
  pushVariants(c, 'altar', 'Altar', 'church', 'altar', 6, 'pro', ['church', 'worship']);
  pushVariants(c, 'choir_riser', 'Choir Riser', 'church', 'choir_riser', 6, 'pro_master', ['church', 'stage']);

  pushVariants(c, 'counter', 'Kitchen Counter', 'kitchen', 'kitchen_counter', 10, 'pro', ['kitchen', 'counter']);
  pushVariants(c, 'island', 'Kitchen Island', 'kitchen', 'kitchen_island', 8, 'pro', ['kitchen', 'island']);
  pushVariants(c, 'cabinet', 'Kitchen Cabinet', 'kitchen', 'kitchen_cabinet', 10, 'pro', ['kitchen', 'storage']);
  pushVariants(c, 'fridge', 'Refrigerator', 'kitchen', 'fridge', 6, 'pro', ['kitchen', 'appliance']);
  pushVariants(c, 'stove', 'Range Stove', 'kitchen', 'stove', 6, 'pro', ['kitchen', 'appliance']);
  pushVariants(c, 'sink', 'Kitchen Sink', 'kitchen', 'sink', 6, 'pro', ['kitchen', 'appliance']);

  pushVariants(c, 'plant', 'Plant', 'decor', 'plant', 12, 'free', ['decor', 'greenery']);
  pushVariants(c, 'lamp', 'Floor Lamp', 'decor', 'floor_lamp', 10, 'free', ['decor', 'lighting']);
  pushVariants(c, 'rug', 'Area Rug', 'decor', 'rug', 10, 'free', ['decor', 'floor']);
  pushVariants(c, 'tv', 'Display Screen', 'decor', 'tv_screen', 8, 'pro', ['screen', 'display']);
  pushVariants(c, 'whiteboard', 'Whiteboard', 'decor', 'whiteboard', 6, 'pro', ['office', 'display']);

  pushVariants(c, 'spotlight', 'Spotlight', 'lighting', 'spotlight', 12, 'pro', ['lighting', 'stage']);
  pushVariants(c, 'mic', 'Microphone Stand', 'lighting', 'mic_stand', 8, 'pro', ['audio', 'broadcast']);
  pushVariants(c, 'tripod', 'Camera Tripod', 'lighting', 'camera_tripod', 6, 'pro_master', ['camera', 'production']);

  pushVariants(c, 'ceiling_fan', 'Ceiling Fan', 'lighting', 'ceiling_fan', 8, 'free', ['lighting', 'ceiling', 'fan']);
  pushVariants(c, 'pendant', 'Pendant Light', 'lighting', 'pendant_light', 8, 'free', ['lighting', 'ceiling']);
  pushVariants(c, 'track', 'Track Light', 'lighting', 'track_light', 6, 'pro', ['lighting', 'studio']);
  pushVariants(c, 'ceiling', 'Recessed Light', 'lighting', 'ceiling_light', 8, 'free', ['lighting', 'ceiling']);
  pushVariants(c, 'wall_decal', 'Wall Decal', 'finishing', 'wall_decal', 10, 'free', ['wall', 'sticker', 'decor']);
  pushVariants(c, 'area_mat', 'Floor Mat', 'finishing', 'area_mat', 8, 'free', ['floor', 'mat', 'rug']);
  pushVariants(c, 'wall_shelf', 'Wall Shelf', 'finishing', 'wall_shelf', 8, 'pro', ['wall', 'shelf', 'decor']);

  pushVariants(c, 'conference', 'Conference Table', 'furniture', 'conference_table', 6, 'pro_master', ['office', 'meeting']);
  pushVariants(c, 'fence', 'Fence Section', 'exterior', 'fence', 6, 'pro', ['exterior', 'outdoor']);
  pushVariants(c, 'tree', 'Tree', 'exterior', 'tree', 8, 'free', ['exterior', 'landscape']);

  return c;
}

export const PRISM_MODEL_CATALOG: PrismModelCatalogEntry[] = buildCatalog();

export const PRISM_MODEL_CATEGORIES: { id: PrismModelCategory; label: string }[] = [
  { id: 'furniture', label: 'Furniture' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'stages', label: 'Stages' },
  { id: 'newsroom', label: 'Newsroom' },
  { id: 'church', label: 'Church' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'decor', label: 'Decor' },
  { id: 'lighting', label: 'Lighting & Fans' },
  { id: 'finishing', label: 'Finishing & Mats' },
  { id: 'exterior', label: 'Exterior' },
];

export function getCatalogEntry(id: string): PrismModelCatalogEntry | undefined {
  return PRISM_MODEL_CATALOG.find((e) => e.id === id);
}

export function modelsForPlan(planId: PlanTier | string): PrismModelCatalogEntry[] {
  const userTier = TIER_ORDER[planId] ?? 0;
  return PRISM_MODEL_CATALOG.filter((m) => TIER_ORDER[m.tier] <= userTier);
}

export function createSceneObject(catalogId: string, overrides?: Partial<PrismSceneObject>): PrismSceneObject | null {
  const catalog = getCatalogEntry(catalogId);
  if (!catalog) return null;
  return {
    id: createPrismObjectId(),
    catalogId,
    position: [...catalog.defaultTransform.position],
    rotation: [...catalog.defaultTransform.rotation],
    scale: catalog.defaultTransform.scale,
    ...overrides,
  };
}

export function catalogCountForPlan(planId: PlanTier | string): number {
  return modelsForPlan(planId).length;
}
