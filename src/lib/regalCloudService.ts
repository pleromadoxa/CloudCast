import { getSupabase, isSupabaseConfigured } from './supabase';
import { USER_MSG } from './userMessaging';
import type { PlanTier } from '../types/plans';

export interface RegalCloudEndpoints {
  streamId: string;
  whipUrl: string;
  whepUrl: string;
  planId: PlanTier;
  qualityTier: 'hd' | 'uhd';
  connectionMode: 'regal';
}

type StreamAction = 'provision' | 'delete';

async function invokeCloudcastStream<T>(
  action: StreamAction,
  accessCode: string,
  deviceId: string,
): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new Error(USER_MSG.backendUnavailable);
  }

  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const res = await fetch(`${base}/functions/v1/cloudcast-stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify({
      action,
      access_code: accessCode,
      device_id: deviceId,
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(payload.error ?? `${USER_MSG.regalCloudRequestFailed} (${res.status})`));
  }
  return payload as T;
}

/** Provision WHIP ingest + WHEP playback for a paired device on Pro / Pro Master sessions. */
export async function provisionRegalCloudStream(
  accessCode: string,
  deviceId: string,
): Promise<RegalCloudEndpoints> {
  const data = await invokeCloudcastStream<Record<string, unknown>>('provision', accessCode, deviceId);
  return {
    streamId: String(data.stream_id ?? ''),
    whipUrl: String(data.whip_url ?? ''),
    whepUrl: String(data.whep_url ?? ''),
    planId: (data.plan_id as PlanTier) ?? 'pro',
    qualityTier: data.quality_tier === 'uhd' ? 'uhd' : 'hd',
    connectionMode: 'regal',
  };
}

export async function releaseRegalCloudStream(accessCode: string, deviceId: string): Promise<void> {
  await invokeCloudcastStream('delete', accessCode, deviceId);
}
