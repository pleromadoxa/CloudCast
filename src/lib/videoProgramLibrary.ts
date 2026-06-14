import { getSupabase, isSupabaseConfigured } from './supabase';
import type { ProgramPresetMeta } from '../types/programPreset';

export interface ProgramPresetLibraryEntry extends ProgramPresetMeta {
  libraryCategory: string | null;
  isLibrary: boolean;
}

function mapLibraryRow(row: Record<string, unknown>): ProgramPresetLibraryEntry {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    updatedAt: String(row.updated_at ?? ''),
    createdAt: String(row.created_at ?? ''),
    isLibrary: Boolean(row.is_library),
    libraryCategory: row.library_category ? String(row.library_category) : null,
  };
}

export async function fetchProgramPresetLibrary(category?: string): Promise<ProgramPresetLibraryEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().rpc('list_program_preset_library', {
    p_category: category?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapLibraryRow);
}

export async function promoteProgramPresetToLibrary(
  presetId: string,
  category = 'General',
): Promise<ProgramPresetLibraryEntry> {
  if (!isSupabaseConfigured()) throw new Error('Program library requires Regal Cloud sign-in.');
  const { data, error } = await getSupabase().rpc('promote_program_preset_to_library', {
    p_id: presetId,
    p_category: category.trim() || 'General',
  });
  if (error) throw new Error(error.message);
  return mapLibraryRow(data as Record<string, unknown>);
}
