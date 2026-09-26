/** Virtual video input — active media library item (image or video). */
export const REGAL_MEDIA_DEVICE_ID = 'regal-media-feed';

export interface ActiveMediaFeed {
  kind: 'image' | 'video';
  id: string;
  name: string;
  playUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  muted: boolean;
  liveOnPgm: boolean;
  loop?: boolean;
}
