import { getSupabase, isSupabaseConfigured } from './supabase';
import type { SceneId } from './audioConsolePersistence';

export interface AudioSceneRundownItem {
  sceneId: SceneId;
  holdSeconds: number;
}

export interface AudioSceneRundownTemplate {
  id: string;
  sessionId: string | null;
  name: string;
  items: AudioSceneRundownItem[];
  createdAt: string;
  updatedAt: string;
}

const LOCAL_KEY = 'cloudcast-audio-scene-rundowns';
const VALID_SCENES: SceneId[] = ['A', 'B', 'C', 'D'];

function parseItems(raw: unknown): AudioSceneRundownItem[] {
  if (!Array.isArray(raw)) return [];
  const items: AudioSceneRundownItem[] = [];
  for (const entry of raw) {
    const row = entry as Record<string, unknown>;
    const sceneId = String(row.scene_id ?? row.sceneId ?? '').toUpperCase() as SceneId;
    if (!VALID_SCENES.includes(sceneId)) continue;
    items.push({
      sceneId,
      holdSeconds: Math.max(1, Number(row.hold_seconds ?? row.holdSeconds ?? 3)),
    });
  }
  return items;
}

export function mapAudioSceneRundownTemplateRow(row: Record<string, unknown>): AudioSceneRundownTemplate {
  return {
    id: String(row.id),
    sessionId: row.session_id ? String(row.session_id) : null,
    name: String(row.name),
    items: parseItems(row.items),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function loadLocal(): AudioSceneRundownTemplate[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AudioSceneRundownTemplate[];
  } catch {
    return [];
  }
}

function saveLocal(templates: AudioSceneRundownTemplate[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(templates));
  } catch {
    /* ignore */
  }
}

export function serializeRundownItems(items: AudioSceneRundownItem[]): Record<string, unknown>[] {
  return items.map((item) => ({
    scene_id: item.sceneId,
    hold_seconds: item.holdSeconds,
  }));
}

export async function fetchAudioSceneRundownTemplates(
  sessionId?: string | null,
): Promise<AudioSceneRundownTemplate[]> {
  if (!isSupabaseConfigured()) {
    const local = loadLocal();
    return sessionId ? local.filter((t) => !t.sessionId || t.sessionId === sessionId) : local;
  }
  const { data, error } = await getSupabase().rpc('list_audio_scene_rundown_templates', {
    p_session_id: sessionId ?? null,
  });
  if (error) return loadLocal();
  return ((data ?? []) as Record<string, unknown>[]).map(mapAudioSceneRundownTemplateRow);
}

export async function saveAudioSceneRundownTemplate(input: {
  id?: string;
  sessionId?: string | null;
  name: string;
  items: AudioSceneRundownItem[];
}): Promise<AudioSceneRundownTemplate> {
  if (!isSupabaseConfigured()) {
    const local = loadLocal();
    const next: AudioSceneRundownTemplate = {
      id: input.id ?? crypto.randomUUID(),
      sessionId: input.sessionId ?? null,
      name: input.name,
      items: input.items,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const idx = local.findIndex((t) => t.id === next.id);
    if (idx >= 0) local[idx] = next;
    else local.unshift(next);
    saveLocal(local);
    return next;
  }

  const { data, error } = await getSupabase().rpc('upsert_audio_scene_rundown_template', {
    p_id: input.id ?? null,
    p_session_id: input.sessionId ?? null,
    p_name: input.name,
    p_items: serializeRundownItems(input.items),
  });
  if (error) throw new Error(error.message);
  return mapAudioSceneRundownTemplateRow(data as Record<string, unknown>);
}

export async function deleteAudioSceneRundownTemplate(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    saveLocal(loadLocal().filter((t) => t.id !== id));
    return;
  }
  const { error } = await getSupabase().rpc('delete_audio_scene_rundown_template', { p_id: id });
  if (error) throw new Error(error.message);
}

export function validateRundownDraft(
  items: AudioSceneRundownItem[],
  storedScenes: Partial<Record<SceneId, unknown>>,
): string | null {
  if (items.length === 0) return 'Add at least one scene to the rundown.';
  for (const item of items) {
    if (!storedScenes[item.sceneId]) {
      return `Scene ${item.sceneId} is not stored — store it first (Shift+${item.sceneId}).`;
    }
  }
  return null;
}
