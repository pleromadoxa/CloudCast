export interface MixerBridgeLink {
  bridgeCode: string;
  audioSessionId: string;
  audioAccessCode: string;
  audioRealtimeChannel: string;
  ownerId: string;
  linkedAt: string;
}

export interface VideoBridgeState {
  bridgeCode: string | null;
  link: MixerBridgeLink | null;
  linking: boolean;
  error: string | null;
}
