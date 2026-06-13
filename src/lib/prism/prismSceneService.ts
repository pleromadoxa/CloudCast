import { getSupabase } from '../supabase';
import type { ChromaKeySettings } from './chromaKey';
import type { PrismProductionMode } from './virtualSets';
import type { PrismSceneExtendedState, PrismSceneRecord } from '../../types/prismFeed';
import type { PrismNodeGraph } from './nodeGraph';
import type { PrismSecondarySlot } from '../../types/prismCameras';
import type { PrismLowerThird, PrismSceneObject } from '../../types/prismFeed';

export interface SavePrismSceneInput {
  name: string;
  virtualSetId: string;
  mode: PrismProductionMode;
  keySettings: ChromaKeySettings;
  cameraYaw: number;
  cameraPitch: number;
  cameraZoom: number;
  showShadows: boolean;
  showReflections: boolean;
  extendedState?: PrismSceneExtendedState;
}

function rowToRecord(row: Record<string, unknown>): PrismSceneRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    virtual_set_id: String(row.virtual_set_id),
    key_color: row.key_color as { r: number; g: number; b: number },
    key_settings: row.key_settings as Record<string, number>,
    camera_settings: row.camera_settings as { yaw: number; pitch: number; zoom: number },
    lighting: row.lighting as { shadows: boolean; reflections: boolean },
    mode: row.mode as PrismProductionMode,
    extended_state: (row.extended_state as PrismSceneExtendedState) ?? {},
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listPrismScenes(): Promise<PrismSceneRecord[]> {
  const { data, error } = await getSupabase()
    .from('prism_scenes')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToRecord(row as Record<string, unknown>));
}

export async function savePrismScene(input: SavePrismSceneInput): Promise<PrismSceneRecord> {
  const { data: { user } } = await getSupabase().auth.getUser();
  if (!user) throw new Error('Sign in to save scenes');

  const payload = {
    user_id: user.id,
    name: input.name,
    virtual_set_id: input.virtualSetId,
    mode: input.mode,
    key_color: input.keySettings.keyColor,
    key_settings: {
      similarity: input.keySettings.similarity,
      smoothness: input.keySettings.smoothness,
      spill: input.keySettings.spill,
      lightWrap: input.keySettings.lightWrap,
    },
    camera_settings: {
      yaw: input.cameraYaw,
      pitch: input.cameraPitch,
      zoom: input.cameraZoom,
    },
    lighting: {
      shadows: input.showShadows,
      reflections: input.showReflections,
    },
    extended_state: input.extendedState ?? {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await getSupabase()
    .from('prism_scenes')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return rowToRecord(data as Record<string, unknown>);
}

export async function deletePrismScene(id: string): Promise<void> {
  const { error } = await getSupabase().from('prism_scenes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export function sceneToKeySettings(record: PrismSceneRecord): ChromaKeySettings {
  return {
    keyColor: record.key_color,
    similarity: record.key_settings.similarity ?? 0.4,
    smoothness: record.key_settings.smoothness ?? 0.08,
    spill: record.key_settings.spill ?? 0.35,
    lightWrap: record.key_settings.lightWrap ?? 0.15,
  };
}

export function sceneExtendedState(record: PrismSceneRecord): {
  nodeGraph?: PrismNodeGraph;
  secondarySlots?: PrismSecondarySlot[];
  lowerThird?: PrismLowerThird;
  sceneObjects?: PrismSceneObject[];
} {
  return record.extended_state ?? {};
}
