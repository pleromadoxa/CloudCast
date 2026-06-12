/** Where audio is pulled from for a video input. */
export type AudioInputSource = 'camera' | 'capture_card' | 'usb_audio';

export type DeviceRole = 'video' | 'audio';

export const AUDIO_SOURCE_LABELS: Record<AudioInputSource, string> = {
  camera: 'Phone / Camera mic',
  capture_card: 'USB capture card audio',
  usb_audio: 'USB audio device',
};
