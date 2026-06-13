export interface ReplayClipLocal {
  id: string;
  blob: Blob;
  blobUrl: string;
  mimeType: string;
  durationSec: number;
  inSec: number;
  outSec: number;
  sourceLabel: string;
  sourceDeviceId?: string;
  tags?: string[];
  timecodeIn?: string;
  timecodeOut?: string;
  frameRate?: number;
  createdAt: string;
  cloudId?: string;
  storagePath?: string;
  synced: boolean;
}

export interface ReplayBankSlot {
  id: string;
  index: number;
  label: string;
  clip: ReplayClipLocal | null;
}

export interface ReplayCloudClip {
  id: string;
  userId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number | null;
  inSec: number | null;
  outSec: number | null;
  sourceDeviceId: string | null;
  bankIndex: number | null;
  label: string | null;
  tags: string[];
  timecodeIn: string | null;
  timecodeOut: string | null;
  frameRate: number | null;
  createdAt: string;
  lifecycleStatus?: 'active' | 'archived';
  archivedAt?: string | null;
}

export interface ReplayStorageUsage {
  usedBytes: number;
  quotaBytes: number;
  remainingBytes: number;
  clipCount: number;
  totalUsedBytes?: number;
}

export type ReplaySourceKind = 'camera' | 'screen' | 'pgm-program';

export interface ReplayPushRequest {
  url: string;
  label: string;
  clipId: string;
  playbackRate?: number;
  /** Routes through Video Mixer PGM bus (stream encoders + monitor). */
  busTake?: boolean;
}

/** Ordered clip in a PGM rundown (plays sequentially on program). */
export interface ReplayRundownItem extends ReplayPushRequest {
  bankIndex?: number;
}
