/** Per-session channel prefix — full name is `cloudcast-{session_id}`. */
export const SESSION_CHANNEL_PREFIX = 'cloudcast-';

/** Broadcast event names for WebRTC signaling between mobile and dashboard. */
export const SIGNALING_EVENTS = {
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE: 'ice',
  STREAM_READY: 'stream-ready',
  STREAM_STOPPED: 'stream-stopped',
  DEVICE_ACK: 'device-ack',
  DEVICE_CONNECTED: 'device-connected',
  PAIRING_STATUS: 'pairing-status',
  ACCESS_CODE_REVOKED: 'access-code-revoked',
  /** Dashboard leader regained — mobile should re-send mesh offer. */
  REQUEST_REOFFER: 'request-reoffer',
  /** Regal Display — live congregation output sync. */
  DISPLAY_FEED_SYNC: 'display-feed-sync',
  /** Regal Prism Eye — phone gyro virtual camera sync. */
  PRISM_TRACKING_SYNC: 'prism-tracking-sync',
  /** CloudCast Replay — cross-operator console state sync. */
  REPLAY_CONSOLE_SYNC: 'replay-console-sync',
  /** CloudCast Audio Mixer — cross-operator console state sync. */
  AUDIO_CONSOLE_SYNC: 'audio-console-sync',
  /** CloudCast Video Mixer — cross-operator director state sync. */
  VIDEO_MIXER_SYNC: 'video-mixer-sync',
} as const;

/** Dashboard presence key — distinguishes dashboard observers from mobile publishers. */
export const DASHBOARD_PRESENCE_KEY = 'dashboard';

export { REGAL_ICE_SERVERS as ICE_SERVERS } from './meshConfig';

export const GRID_LAYOUTS = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-2',
  6: 'grid-cols-2 lg:grid-cols-3',
  9: 'grid-cols-3',
} as const;
