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
  createdAt: string;
}

export interface ReplayStorageUsage {
  usedBytes: number;
  quotaBytes: number;
  remainingBytes: number;
  clipCount: number;
  totalUsedBytes?: number;
}

export type ReplaySourceKind = 'camera' | 'screen' | 'pgm-bridge';

export interface ReplayPushRequest {
  url: string;
  label: string;
  clipId: string;
  playbackRate?: number;
}
