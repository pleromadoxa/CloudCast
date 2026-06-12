import { getSupabase } from './supabase';
import type { StreamDestination, StreamDestinationInput } from '../types/streaming';

function mapDestination(row: Record<string, unknown>): StreamDestination {
  return {
    id: String(row.id),
    name: String(row.name),
    platform: row.platform as StreamDestination['platform'],
    streamUrl: String(row.stream_url ?? ''),
    streamKey: String(row.stream_key ?? ''),
    isEnabled: Boolean(row.is_enabled),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export async function fetchStreamDestinations(): Promise<StreamDestination[]> {
  const { data, error } = await getSupabase().rpc('list_stream_destinations');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapDestination);
}

export async function saveStreamDestination(
  input: StreamDestinationInput,
): Promise<StreamDestination> {
  const { data, error } = await getSupabase().rpc('upsert_stream_destination', {
    p_id: input.id ?? null,
    p_name: input.name,
    p_platform: input.platform,
    p_stream_url: input.streamUrl,
    p_stream_key: input.streamKey,
    p_is_enabled: input.isEnabled,
    p_sort_order: input.sortOrder,
  });
  if (error) throw new Error(error.message);
  return mapDestination(data as Record<string, unknown>);
}

export async function deleteStreamDestination(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('delete_stream_destination', { p_id: id });
  if (error) throw new Error(error.message);
}

export async function updateDeviceAudioSettings(
  accessCode: string,
  deviceId: string,
  audioSource: string,
  linkedAudioDeviceId: string | null,
): Promise<void> {
  const { error } = await getSupabase().rpc('update_device_audio_settings', {
    p_access_code: accessCode,
    p_device_id: deviceId,
    p_audio_source: audioSource,
    p_linked_audio_device_id: linkedAudioDeviceId,
  });
  if (error) throw new Error(error.message);
}
