import { getSupabase, isSupabaseConfigured } from './supabase';
import { mapReplayRundownTemplateRow, type ReplayRundownTemplate } from './replayRundownTemplates';

export interface ReplayShowLibraryEntry extends ReplayRundownTemplate {
  libraryCategory: string | null;
  isLibrary: boolean;
}

function mapLibraryRow(row: Record<string, unknown>): ReplayShowLibraryEntry {
  const base = mapReplayRundownTemplateRow(row);
  return {
    ...base,
    isLibrary: Boolean(row.is_library),
    libraryCategory: row.library_category ? String(row.library_category) : null,
  };
}

export async function fetchReplayShowLibrary(category?: string): Promise<ReplayShowLibraryEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await getSupabase().rpc('list_replay_show_library', {
    p_category: category?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapLibraryRow);
}

export async function promoteRundownToLibrary(
  templateId: string,
  category = 'General',
): Promise<ReplayShowLibraryEntry> {
  if (!isSupabaseConfigured()) {
    throw new Error('Show library requires Regal Cloud sign-in.');
  }

  const { data, error } = await getSupabase().rpc('promote_replay_rundown_to_library', {
    p_id: templateId,
    p_category: category.trim() || 'General',
  });
  if (error) throw new Error(error.message);
  return mapLibraryRow(data as Record<string, unknown>);
}

export function groupLibraryByCategory(entries: ReplayShowLibraryEntry[]): Map<string, ReplayShowLibraryEntry[]> {
  const map = new Map<string, ReplayShowLibraryEntry[]>();
  for (const entry of entries) {
    const key = entry.libraryCategory ?? 'General';
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  return map;
}
