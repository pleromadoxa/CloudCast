import type { StreamDestination, StreamPlatform } from '../types/streaming';
import { isValidStreamConfig } from './rtmpUrl';
import { getSupabase } from './supabase';

export type StreamValidationStage = 'format' | 'connect' | 'handshake' | 'publish';

export interface StreamValidationResult {
  ok: boolean;
  message: string;
  stage?: StreamValidationStage;
}

export function validateStreamConfigLocal(
  streamUrl: string,
  streamKey: string,
): StreamValidationResult {
  const err = isValidStreamConfig(streamUrl, streamKey);
  if (err) return { ok: false, message: err, stage: 'format' };
  return { ok: true, message: 'Stream settings look valid.' };
}

export async function testStreamDestinationRemote(input: {
  streamUrl: string;
  streamKey: string;
  platform?: StreamPlatform;
}): Promise<StreamValidationResult> {
  const local = validateStreamConfigLocal(input.streamUrl, input.streamKey);
  if (!local.ok) return local;

  const { data, error } = await getSupabase().functions.invoke('validate-stream', {
    body: {
      stream_url: input.streamUrl.trim(),
      stream_key: input.streamKey.trim(),
      platform: input.platform ?? 'custom',
    },
  });

  if (error) {
    return {
      ok: false,
      message: error.message || 'Could not reach the stream validation service.',
      stage: 'connect',
    };
  }

  const result = data as StreamValidationResult | null;
  if (!result) {
    return { ok: false, message: 'Empty response from validation service.', stage: 'connect' };
  }

  return result;
}

export async function testStreamDestination(
  destination: Pick<StreamDestination, 'name' | 'streamUrl' | 'streamKey' | 'platform'>,
): Promise<StreamValidationResult> {
  const local = validateStreamConfigLocal(destination.streamUrl, destination.streamKey);
  if (!local.ok) return local;

  try {
    return await testStreamDestinationRemote({
      streamUrl: destination.streamUrl,
      streamKey: destination.streamKey,
      platform: destination.platform,
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Stream validation failed.',
      stage: 'connect',
    };
  }
}

export function getEnabledDestinations(
  destinations: StreamDestination[],
): StreamDestination[] {
  return destinations.filter(
    (d) => d.isEnabled && d.streamUrl.trim() && d.streamKey.trim(),
  );
}

export function findIncompleteEnabledDestinations(
  destinations: StreamDestination[],
): StreamDestination[] {
  return destinations.filter(
    (d) => d.isEnabled && (!d.streamUrl.trim() || !d.streamKey.trim()),
  );
}
