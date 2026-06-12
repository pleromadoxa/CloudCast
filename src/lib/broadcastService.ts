import { getSupabase } from './supabase';
import type { BroadcastSeverity } from '../types/admin';

export interface ActiveBroadcast {
  id: string;
  title: string;
  message: string;
  severity: BroadcastSeverity;
  link_url: string | null;
  link_label: string | null;
  target_plan: string;
  starts_at: string;
  ends_at: string | null;
}

export async function fetchActiveBroadcasts(): Promise<ActiveBroadcast[]> {
  const { data, error } = await getSupabase().rpc('get_active_broadcasts');
  if (error) throw new Error(error.message);
  return (data ?? []) as ActiveBroadcast[];
}
