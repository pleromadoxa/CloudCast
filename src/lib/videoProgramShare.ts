import { getSupabase, isSupabaseConfigured } from './supabase';
import type { ProgramPresetMeta } from '../types/programPreset';

function mapImportedPreset(row: Record<string, unknown>): ProgramPresetMeta {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    updatedAt: String(row.updated_at ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

export async function publishProgramPresetShareCode(presetId: string): Promise<string> {
  if (!isSupabaseConfigured()) throw new Error('Program sharing requires Regal Cloud sign-in.');
  const { data, error } = await getSupabase().rpc('publish_program_preset_share', { p_id: presetId });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function importProgramPresetByShareCode(shareCode: string): Promise<ProgramPresetMeta> {
  if (!isSupabaseConfigured()) throw new Error('Importing shared presets requires Regal Cloud sign-in.');
  const { data, error } = await getSupabase().rpc('import_program_preset_share', {
    p_share_code: shareCode.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  return mapImportedPreset(data as Record<string, unknown>);
}

export function formatProgramPresetShareCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}
