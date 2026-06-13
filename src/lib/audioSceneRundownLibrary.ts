import { getSupabase, isSupabaseConfigured } from './supabase';
import { mapAudioSceneRundownTemplateRow, type AudioSceneRundownTemplate } from './audioSceneRundown';

export interface AudioSceneRundownLibraryEntry extends AudioSceneRundownTemplate {
  libraryCategory: string | null;
  isLibrary: boolean;
}

function mapLibraryRow(row: Record<string, unknown>): AudioSceneRundownLibraryEntry {
  const base = mapAudioSceneRundownTemplateRow(row);
  return {
    ...base,
    isLibrary: Boolean(row.is_library),
    libraryCategory: row.library_category ? String(row.library_category) : null,
  };
}

export async function fetchAudioSceneRundownLibrary(category?: string): Promise<AudioSceneRundownLibraryEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().rpc('list_audio_scene_rundown_library', {
    p_category: category?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapLibraryRow);
}

export async function promoteSceneRundownToLibrary(
  templateId: string,
  category = 'General',
): Promise<AudioSceneRundownLibraryEntry> {
  if (!isSupabaseConfigured()) throw new Error('Rundown library requires Regal Cloud sign-in.');
  const { data, error } = await getSupabase().rpc('promote_audio_scene_rundown_to_library', {
    p_id: templateId,
    p_category: category.trim() || 'General',
  });
  if (error) throw new Error(error.message);
  return mapLibraryRow(data as Record<string, unknown>);
}
