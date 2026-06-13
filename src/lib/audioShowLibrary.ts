import { getSupabase, isSupabaseConfigured } from './supabase';
import { mapAudioShowPresetRow, type AudioShowPreset } from './audioShowPresets';

export interface AudioShowLibraryEntry extends AudioShowPreset {
  libraryCategory: string | null;
  isLibrary: boolean;
}

function mapLibraryRow(row: Record<string, unknown>): AudioShowLibraryEntry {
  const base = mapAudioShowPresetRow(row);
  return {
    ...base,
    isLibrary: Boolean(row.is_library),
    libraryCategory: row.library_category ? String(row.library_category) : null,
  };
}

export async function fetchAudioShowLibrary(category?: string): Promise<AudioShowLibraryEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().rpc('list_audio_show_library', {
    p_category: category?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapLibraryRow);
}

export async function promoteAudioShowToLibrary(
  presetId: string,
  category = 'General',
): Promise<AudioShowLibraryEntry> {
  if (!isSupabaseConfigured()) throw new Error('Show library requires Regal Cloud sign-in.');
  const { data, error } = await getSupabase().rpc('promote_audio_show_to_library', {
    p_id: presetId,
    p_category: category.trim() || 'General',
  });
  if (error) throw new Error(error.message);
  return mapLibraryRow(data as Record<string, unknown>);
}
