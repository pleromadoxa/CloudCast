import type { LayerSettings } from '../types/mixer';
import type { MediaLibraryItem } from '../types/overlays';
import { resolveMediaPlayUrl } from '../types/overlays';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { USER_MSG } from './userMessaging';
import type { RecordingStorageUsage } from '../types/recording';

type MixerMediaR2Action =
  | 'mixer-media-presign-upload'
  | 'mixer-media-presign-download'
  | 'mixer-media-delete';

export interface MixerMediaCloudRecord {
  id: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  kind: 'image' | 'video';
  sizeBytes: number;
  naturalWidth: number;
  naturalHeight: number;
  createdAt: string;
}

async function invokeMixerMediaR2<T>(action: MixerMediaR2Action, body: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new Error(USER_MSG.cloudStorageUnavailable);
  }

  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sign in to save media to Regal Cloud.');
  }

  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const res = await fetch(`${base}/functions/v1/cloudcast-r2`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify({ action, ...body }),
  });

  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(payload.error ?? `${USER_MSG.cloudStorageRequestFailed} (${res.status})`));
  }
  return payload as T;
}

function mapCloudRecord(row: Record<string, unknown>): MixerMediaCloudRecord {
  return {
    id: String(row.id),
    storagePath: String(row.storage_path),
    fileName: String(row.file_name),
    mimeType: String(row.mime_type),
    kind: String(row.kind) as 'image' | 'video',
    sizeBytes: Number(row.size_bytes ?? 0),
    naturalWidth: Number(row.natural_width ?? 0),
    naturalHeight: Number(row.natural_height ?? 0),
    createdAt: String(row.created_at),
  };
}

function fileExtension(fileName: string, mimeType: string): string {
  const fromName = fileName.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('mp4')) return 'mp4';
  return 'bin';
}

export async function getMixerMediaPlayUrl(storagePath: string, fileName: string): Promise<string> {
  const { url } = await invokeMixerMediaR2<{ url: string }>('mixer-media-presign-download', {
    storage_path: storagePath,
    file_name: fileName,
  });
  if (!url) throw new Error('Could not resolve media playback URL.');
  return url;
}

export async function uploadMixerMediaToCloud(
  blob: Blob,
  item: Pick<MediaLibraryItem, 'id' | 'name' | 'kind' | 'mimeType' | 'naturalWidth' | 'naturalHeight'>,
): Promise<MixerMediaCloudRecord> {
  const usage = await fetchMixerMediaStorageUsage().catch(() => null);
  if (usage && usage.quotaBytes <= 0) {
    throw new Error('Cloud storage is not included on your plan. Upgrade to save media to Regal Cloud.');
  }
  if (usage && blob.size > usage.remainingBytes) {
    throw new Error('Cloud storage quota exceeded. Delete old recordings, replay clips, or media to free space.');
  }

  const ext = fileExtension(item.name, item.mimeType);
  const presigned = await invokeMixerMediaR2<{
    uploadUrl: string;
    storagePath: string;
    mediaId: string;
  }>('mixer-media-presign-upload', {
    mime_type: item.mimeType,
    size_bytes: blob.size,
    media_id: item.id,
    file_ext: ext,
  });

  const uploadRes = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': item.mimeType },
    body: blob,
  });
  if (!uploadRes.ok) {
    throw new Error(`${USER_MSG.cloudStorageUploadFailed} (${uploadRes.status})`);
  }

  const { data, error } = await getSupabase().rpc('register_mixer_media_asset', {
    p_id: item.id,
    p_storage_path: presigned.storagePath,
    p_file_name: item.name,
    p_mime_type: item.mimeType,
    p_kind: item.kind,
    p_size_bytes: blob.size,
    p_natural_width: item.naturalWidth,
    p_natural_height: item.naturalHeight,
  });
  if (error) {
    await invokeMixerMediaR2('mixer-media-delete', { storage_path: presigned.storagePath }).catch(() => undefined);
    throw new Error(error.message);
  }

  return mapCloudRecord(data as Record<string, unknown>);
}

export async function fetchMixerMediaStorageUsage(): Promise<RecordingStorageUsage> {
  const { data, error } = await getSupabase().rpc('get_recording_storage_usage');
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    usedBytes: Number(row.used_bytes ?? 0),
    quotaBytes: Number(row.quota_bytes ?? 0),
    remainingBytes: Number(row.remaining_bytes ?? 0),
  };
}

function syncOverlayUrls<T extends { id: string; dataUrl: string; name: string }>(
  overlays: T[],
  library: MediaLibraryItem[],
  kind: MediaLibraryItem['kind'],
): T[] {
  const byId = new Map(library.map((item) => [item.id, item]));
  return overlays.map((overlay) => {
    const item = byId.get(overlay.id);
    if (!item || item.kind !== kind) return overlay;
    const url = resolveMediaPlayUrl(item);
    if (!url) return overlay;
    return { ...overlay, dataUrl: url, name: item.name };
  });
}

export function syncLayersWithMediaLibrary(
  layers: LayerSettings,
  library: MediaLibraryItem[],
  pgmLayers?: LayerSettings,
): Partial<LayerSettings> & { pgmLayers?: LayerSettings } {
  const imageOverlays = syncOverlayUrls(layers.imageOverlays, library, 'image');
  const videoOverlays = syncOverlayUrls(layers.videoOverlays, library, 'video');

  const patch: Partial<LayerSettings> & { pgmLayers?: LayerSettings } = {
    mediaLibrary: library,
    imageOverlays,
    videoOverlays,
  };

  if (pgmLayers) {
    patch.pgmLayers = {
      ...pgmLayers,
      imageOverlays: syncOverlayUrls(pgmLayers.imageOverlays, library, 'image'),
      videoOverlays: syncOverlayUrls(pgmLayers.videoOverlays, library, 'video'),
    };
  }

  return patch;
}

export async function deleteMixerMediaFromCloud(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { data: storagePath, error } = await getSupabase().rpc('delete_mixer_media_asset', { p_id: id });
  if (error) throw new Error(error.message);
  if (!storagePath) return;
  await invokeMixerMediaR2('mixer-media-delete', { storage_path: String(storagePath) }).catch(() => undefined);
}

export async function fetchMixerMediaLibrary(): Promise<MixerMediaCloudRecord[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase().rpc('list_mixer_media_assets');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapCloudRecord);
}

export async function cloudRecordToLibraryItem(record: MixerMediaCloudRecord): Promise<MediaLibraryItem> {
  const playUrl = await getMixerMediaPlayUrl(record.storagePath, record.fileName);
  return {
    id: record.id,
    name: record.fileName.replace(/\.[^.]+$/, '').slice(0, 28) || record.fileName,
    kind: record.kind,
    playUrl,
    thumbUrl: record.kind === 'image' ? playUrl : undefined,
    storagePath: record.storagePath,
    sizeBytes: record.sizeBytes,
    naturalWidth: record.naturalWidth,
    naturalHeight: record.naturalHeight,
    mimeType: record.mimeType,
    createdAt: new Date(record.createdAt).getTime(),
  };
}

export async function hydrateMediaLibraryItems(
  items: MediaLibraryItem[],
): Promise<MediaLibraryItem[]> {
  if (!isSupabaseConfigured()) {
    return items.map((item) => ({
      ...item,
      playUrl: resolveLocalPlayUrl(item),
    }));
  }

  const hydrated: MediaLibraryItem[] = [];
  for (const item of items) {
    if (item.storagePath) {
      try {
        const playUrl = await getMixerMediaPlayUrl(item.storagePath, item.name);
        hydrated.push({
          ...item,
          playUrl,
          thumbUrl: item.kind === 'image' ? playUrl : item.thumbUrl,
        });
      } catch {
        hydrated.push({ ...item, playUrl: resolveLocalPlayUrl(item) });
      }
    } else {
      hydrated.push({ ...item, playUrl: resolveLocalPlayUrl(item) });
    }
  }
  return hydrated;
}

function resolveLocalPlayUrl(item: MediaLibraryItem): string {
  return item.playUrl || item.dataUrl || item.thumbUrl || '';
}

export function serializeMediaLibraryForStorage(items: MediaLibraryItem[]): MediaLibraryItem[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    kind: item.kind,
    playUrl: '',
    storagePath: item.storagePath,
    sizeBytes: item.sizeBytes,
    naturalWidth: item.naturalWidth,
    naturalHeight: item.naturalHeight,
    mimeType: item.mimeType,
    createdAt: item.createdAt,
    ...(item.kind === 'image' && item.thumbUrl && item.thumbUrl.length < 120_000
      ? { thumbUrl: item.thumbUrl }
      : item.kind === 'image' && item.dataUrl && item.dataUrl.length < 120_000
        ? { dataUrl: item.dataUrl }
        : {}),
  }));
}

export async function mergeCloudMediaLibrary(local: MediaLibraryItem[]): Promise<MediaLibraryItem[]> {
  const cloud = await fetchMixerMediaLibrary();
  const byId = new Map(local.map((item) => [item.id, item]));

  const merged: MediaLibraryItem[] = [];
  for (const record of cloud) {
    const existing = byId.get(record.id);
    byId.delete(record.id);
    try {
      const playUrl = await getMixerMediaPlayUrl(record.storagePath, record.fileName);
      merged.push({
        id: record.id,
        name: existing?.name ?? record.fileName.replace(/\.[^.]+$/, '').slice(0, 28),
        kind: record.kind,
        playUrl,
        thumbUrl: record.kind === 'image' ? playUrl : existing?.thumbUrl,
        storagePath: record.storagePath,
        sizeBytes: record.sizeBytes,
        naturalWidth: record.naturalWidth || existing?.naturalWidth || 0,
        naturalHeight: record.naturalHeight || existing?.naturalHeight || 0,
        mimeType: record.mimeType,
        createdAt: existing?.createdAt ?? new Date(record.createdAt).getTime(),
      });
    } catch {
      if (existing) merged.push(existing);
    }
  }

  for (const leftover of byId.values()) {
    if (!leftover.storagePath) merged.push(leftover);
  }

  return merged.sort((a, b) => b.createdAt - a.createdAt);
}
