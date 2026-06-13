import { getSupabase, isSupabaseConfigured } from './supabase';
import { mapAudioSceneRundownTemplateRow, type AudioSceneRundownTemplate } from './audioSceneRundown';

export async function publishSceneRundownShareCode(templateId: string): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('Rundown sharing requires Regal Cloud sign-in.');
  const { data, error } = await getSupabase().rpc('publish_audio_scene_rundown_share', { p_id: templateId });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function importSceneRundownByShareCode(shareCode: string): Promise<AudioSceneRundownTemplate> {
  if (!isSupabaseConfigured()) throw new Error('Import requires Regal Cloud sign-in.');
  const { data, error } = await getSupabase().rpc('import_audio_scene_rundown_share', {
    p_share_code: shareCode.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  return mapAudioSceneRundownTemplateRow(data as Record<string, unknown>);
}

export function formatSceneRundownShareCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}
