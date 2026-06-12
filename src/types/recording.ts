export interface MixerRecording {
  id: string;
  userId: string;
  sessionId: string | null;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number | null;
  createdAt: string;
}

export interface RecordingStorageUsage {
  usedBytes: number;
  quotaBytes: number;
  remainingBytes: number;
}
