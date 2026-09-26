import type { MediaLibraryItem } from '../types/overlays';
import { resolveMediaPlayUrl } from '../types/overlays';
import { resizeImageForOverlay } from './imageResize';
import { getMixerMediaPlayUrl, uploadMixerMediaToCloud } from './mixerMediaService';

const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
const MAX_LIBRARY_ITEMS = 16;

function probeVideoDimensions(playUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth || 1920,
        height: video.videoHeight || 1080,
      });
    };
    video.onerror = () => reject(new Error('Could not read video metadata.'));
    video.src = playUrl;
  });
}

export interface ImportedMediaFile {
  item: MediaLibraryItem;
  blob: Blob;
}

export async function importMediaFile(file: File): Promise<ImportedMediaFile> {
  const id = crypto.randomUUID();
  const name = file.name.replace(/\.[^.]+$/, '').slice(0, 28) || (file.type.startsWith('video/') ? 'Video' : 'Image');

  if (file.type.startsWith('image/')) {
    const { dataUrl, width, height } = await resizeImageForOverlay(file, 1920, 1080);
    const blob = await fetch(dataUrl).then((r) => r.blob());
    return {
      blob,
      item: {
        id,
        name,
        kind: 'image',
        playUrl: dataUrl,
        thumbUrl: dataUrl,
        naturalWidth: width,
        naturalHeight: height,
        mimeType: file.type || 'image/png',
        sizeBytes: blob.size,
        createdAt: Date.now(),
      },
    };
  }

  if (file.type.startsWith('video/')) {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error('Video must be under 80 MB for browser playback.');
    }
    const playUrl = URL.createObjectURL(file);
    const { width, height } = await probeVideoDimensions(playUrl);
    return {
      blob: file,
      item: {
        id,
        name,
        kind: 'video',
        playUrl,
        naturalWidth: width,
        naturalHeight: height,
        mimeType: file.type || 'video/mp4',
        sizeBytes: file.size,
        createdAt: Date.now(),
      },
    };
  }

  throw new Error('Upload a PNG, JPG, WebP, MP4, MOV, or WebM file.');
}

export function trimMediaLibrary(items: MediaLibraryItem[]): MediaLibraryItem[] {
  return items.slice(0, MAX_LIBRARY_ITEMS);
}

export function overlayUrlFromMedia(item: MediaLibraryItem): string {
  return resolveMediaPlayUrl(item);
}

/** Result of a workspace-aware import: always usable locally, cloud-backed when possible. */
export interface WorkspaceImportResult {
  item: MediaLibraryItem;
  blob: Blob;
  /** True when the asset is saved to Regal Cloud (the shared workspace library). */
  savedToWorkspace: boolean;
  /** Set when saved — lets bindings re-resolve fresh playback URLs later. */
  storagePath?: string;
}

/**
 * Imports a local file AND saves it to the CloudCast workspace (Regal Cloud
 * media library) so the image/video stays available across sessions and shows
 * up in the workspace media picker. Falls back to a local-only copy when the
 * user is signed out, offline, or over quota — the upload itself never fails
 * because of workspace storage.
 */
export async function importMediaFileToWorkspace(file: File): Promise<WorkspaceImportResult> {
  const imported = await importMediaFile(file);
  try {
    const record = await uploadMixerMediaToCloud(imported.blob, {
      id: imported.item.id,
      name: imported.item.name,
      kind: imported.item.kind,
      mimeType: imported.item.mimeType,
      naturalWidth: imported.item.naturalWidth,
      naturalHeight: imported.item.naturalHeight,
    });
    return {
      item: imported.item,
      blob: imported.blob,
      savedToWorkspace: true,
      storagePath: record.storagePath,
    };
  } catch {
    return { ...imported, savedToWorkspace: false };
  }
}

/**
 * Resolves a fresh playback URL for a workspace-saved asset. Presigned URLs
 * expire, so bindings keep the `storagePath` and re-resolve on load.
 */
export async function resolveWorkspaceMediaUrl(storagePath: string): Promise<string | null> {
  try {
    return await getMixerMediaPlayUrl(storagePath, storagePath.split('/').pop() || 'media');
  } catch {
    return null;
  }
}
