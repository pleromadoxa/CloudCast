export interface IpCameraConfig {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
  /** Mixer input slot (1-based). Defaults to last plan slot. */
  slotNumber: number;
  sessionId: string;
  updatedAt: string;
}

export type IpStreamKind = 'whep' | 'hls' | 'mjpeg' | 'native' | 'unsupported';

export type IpCameraConnectionState = 'idle' | 'connecting' | 'connected' | 'failed';
