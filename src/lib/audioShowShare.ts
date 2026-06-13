import { getSupabase, isSupabaseConfigured } from './supabase';
import { mapAudioShowPresetRow, type AudioShowPreset } from './audioShowPresets';

export async function publishAudioShowShareCode(presetId: string): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('Show sharing requires Regal Cloud sign-in.');
  const { data, error } = await getSupabase().rpc('publish_audio_show_share', { p_id: presetId });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function importAudioShowByShareCode(shareCode: string): Promise<AudioShowPreset> {
  if (!isSupabaseConfigured()) throw new Error('Importing shared show files requires Regal Cloud sign-in.');
  const { data, error } = await getSupabase().rpc('import_audio_show_share', {
    p_share_code: shareCode.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  return mapAudioShowPresetRow(data as Record<string, unknown>);
}

export function formatAudioShowShareCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}
