import type { PlanTier } from '../types/plans';
import type { StreamPlanLimits, StreamPlatform } from '../types/streaming';

export function resolveStreamLimits(planId: PlanTier | null | undefined): StreamPlanLimits {
  switch (planId) {
    case 'pro':
    case 'universal_essential':
      return {
        maxConcurrentStreams: 3,
        maxYouTubeDestinations: 3,
        allowsTwitch: true,
        allowsFacebook: true,
        allowsMultiplePlatforms: true,
      };
    case 'pro_master':
    case 'universal_studio':
    case 'universal':
      return {
        maxConcurrentStreams: 5,
        maxYouTubeDestinations: 5,
        allowsTwitch: true,
        allowsFacebook: true,
        allowsMultiplePlatforms: true,
      };
    default:
      return {
        maxConcurrentStreams: 1,
        maxYouTubeDestinations: 1,
        allowsTwitch: false,
        allowsFacebook: false,
        allowsMultiplePlatforms: false,
      };
  }
}

export function isPlatformAllowed(platform: StreamPlatform, limits: StreamPlanLimits): boolean {
  if (platform === 'youtube' || platform === 'custom') return true;
  if (platform === 'twitch') return limits.allowsTwitch;
  if (platform === 'facebook') return limits.allowsFacebook;
  return false;
}

export function countYouTubeDestinations(
  destinations: { platform: StreamPlatform; id?: string }[],
  excludeId?: string,
): number {
  return destinations.filter(
    (d) => d.platform === 'youtube' && d.id !== excludeId,
  ).length;
}

export function validateDestinationSave(
  input: { platform: StreamPlatform; id?: string },
  existing: { platform: StreamPlatform; id: string }[],
  limits: StreamPlanLimits,
): string | null {
  if (!isPlatformAllowed(input.platform, limits)) {
    return `${input.platform} streaming requires a Pro or Pro Master plan.`;
  }
  if (
    input.platform === 'youtube' &&
    countYouTubeDestinations(existing, input.id) >= limits.maxYouTubeDestinations &&
    !existing.some((d) => d.id === input.id && d.platform === 'youtube')
  ) {
    return `Your plan allows up to ${limits.maxYouTubeDestinations} YouTube destination(s).`;
  }
  return null;
}

export function validateConcurrentStreamStart(
  enabledCount: number,
  limits: StreamPlanLimits,
): string | null {
  if (enabledCount > limits.maxConcurrentStreams) {
    if (limits.maxConcurrentStreams === 1) {
      return 'Free plan: enable only one destination at a time (YouTube or Custom).';
    }
    return `Your plan allows up to ${limits.maxConcurrentStreams} simultaneous streams.`;
  }
  return null;
}
