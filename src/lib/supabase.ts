import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildRealtimeClientOptions } from './realtimeConfig';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing CloudCast backend credentials. Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: buildRealtimeClientOptions(),
    });
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
