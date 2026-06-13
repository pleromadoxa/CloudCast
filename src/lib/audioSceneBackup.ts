import { getSupabase, isSupabaseConfigured } from './supabase';
import type { ConsoleSceneSnapshot, SceneId } from './audioConsolePersistence';

export interface AudioSceneBackupRow {
  id: string;
  sessionId: string | null;
  sceneId: SceneId;
  snapshot: ConsoleSceneSnapshot;
  updatedAt: string;
}

function mapBackupRow(row: Record<string, unknown>): AudioSceneBackupRow {
  return {
    id: String(row.id),
    sessionId: row.session_id ? String(row.session_id) : null,
    sceneId: String(row.scene_id).toUpperCase() as SceneId,
    snapshot: (row.snapshot ?? {}) as ConsoleSceneSnapshot,
    updatedAt: String(row.updated_at),
  };
}

export async function upsertAudioSceneBackup(input: {
  sessionId?: string | null;
  sceneId: SceneId;
  snapshot: ConsoleSceneSnapshot;
}): Promise<AudioSceneBackupRow | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase().rpc('upsert_audio_scene_backup', {
    p_session_id: input.sessionId ?? null,
    p_scene_id: input.sceneId,
    p_snapshot: input.snapshot,
  });
  if (error) throw new Error(error.message);
  return mapBackupRow(data as Record<string, unknown>);
}

export async function fetchAudioSceneBackups(sessionId?: string | null): Promise<AudioSceneBackupRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().rpc('list_audio_scene_backups', {
    p_session_id: sessionId ?? null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapBackupRow);
}

export function backupAgeMinutes(updatedAt: string, nowMs = Date.now()): number {
  const ageMs = Math.max(0, nowMs - Date.parse(updatedAt));
  return ageMs / 60_000;
}
