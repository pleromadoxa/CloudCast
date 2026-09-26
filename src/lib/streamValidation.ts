import type { StreamDestination, StreamPlatform } from '../types/streaming';
import { isValidStreamConfig } from './rtmpUrl';
import { getSupabase } from './supabase';
import { withTimeout } from './asyncTimeout';

/** Never let the UI hang on a slow/unresponsive validation service. */
const REMOTE_VALIDATION_TIMEOUT_MS = 14_000;

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

  const invocation = getSupabase()
    .functions.invoke('validate-stream', {
      body: {
        stream_url: input.streamUrl.trim(),
        stream_key: input.streamKey.trim(),
        platform: input.platform ?? 'custom',
      },
    })
    .then(({ data, error }): StreamValidationResult => {
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
    })
    .catch(
      (e): StreamValidationResult => ({
        ok: false,
        message: e instanceof Error ? e.message : 'Could not reach the stream validation service.',
        stage: 'connect',
      }),
    );

  // Phrased to match the "unreachable" heuristic so callers fall back to format-only checks
  // (Save proceeds, GO LIVE continues) instead of leaving the button stuck forever.
  return withTimeout<StreamValidationResult>(invocation, REMOTE_VALIDATION_TIMEOUT_MS, {
    ok: false,
    message: 'Could not reach the validation service in time — using format checks only.',
    stage: 'connect',
  });
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
