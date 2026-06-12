export type StreamPlatform = 'youtube' | 'twitch' | 'facebook' | 'custom';

export interface StreamDestination {
  id: string;
  name: string;
  platform: StreamPlatform;
  streamUrl: string;
  streamKey: string;
  isEnabled: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StreamDestinationInput {
  id?: string;
  name: string;
  platform: StreamPlatform;
  streamUrl: string;
  streamKey: string;
  isEnabled: boolean;
  sortOrder: number;
}

export interface StreamPlanLimits {
  maxConcurrentStreams: number;
  maxYouTubeDestinations: number;
  allowsTwitch: boolean;
  allowsFacebook: boolean;
  allowsMultiplePlatforms: boolean;
}

export const STREAM_PLATFORM_LABELS: Record<StreamPlatform, string> = {
  youtube: 'YouTube',
  twitch: 'Twitch',
  facebook: 'Facebook Live',
  custom: 'Custom RTMP',
};

export const STREAM_PLATFORM_DEFAULTS: Record<
  StreamPlatform,
  { url: string; hint: string }
> = {
  youtube: {
    url: 'rtmp://a.rtmp.youtube.com/live2',
    hint: 'YouTube Studio → Go Live → Stream settings → Stream URL & key',
  },
  twitch: {
    url: 'rtmp://live.twitch.tv/app',
    hint: 'Twitch Dashboard → Settings → Stream → Primary Stream key',
  },
  facebook: {
    url: 'rtmps://live-api-s.facebook.com:443/rtmp',
    hint: 'Facebook Live Producer → Streaming software setup',
  },
  custom: {
    url: '',
    hint: 'Enter your RTMP server URL and stream key from your provider',
  },
};
