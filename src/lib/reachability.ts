import { isSupabaseConfigured } from './supabase';
import { pingSupabase } from './supabaseHeartbeat';

/** Verify real connectivity to CloudCast backend (not just `navigator.onLine`). */
export async function probeCloudCastReachability(): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const result = await pingSupabase('reachability');
    return result.ok;
  }

  try {
    const res = await fetch('/favicon.svg', { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}
