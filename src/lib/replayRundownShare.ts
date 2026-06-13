import { getSupabase, isSupabaseConfigured } from './supabase';
import { mapReplayRundownTemplateRow, type ReplayRundownTemplate } from './replayRundownTemplates';

export async function publishRundownShareCode(templateId: string): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Rundown sharing requires Regal Cloud sign-in.');
  }

  const { data, error } = await getSupabase().rpc('publish_replay_rundown_share', {
    p_id: templateId,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function importRundownByShareCode(shareCode: string): Promise<ReplayRundownTemplate> {
  if (!isSupabaseConfigured()) {
    throw new Error('Importing shared rundowns requires Regal Cloud sign-in.');
  }

  const { data, error } = await getSupabase().rpc('import_replay_rundown_share', {
    p_share_code: shareCode.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  return mapReplayRundownTemplateRow(data as Record<string, unknown>);
}

export function formatRundownShareCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}
