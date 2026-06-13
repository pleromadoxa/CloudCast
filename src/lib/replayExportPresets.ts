import { getSupabase, isSupabaseConfigured } from './supabase';

export interface ReplayExportPreset {
  id: string;
  name: string;
  playbackRate: number;
  frameAccurate: boolean;
  autoCloudSync: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const LOCAL_KEY = 'cloudcast-replay-export-presets';

const BUILTIN_DEFAULT: ReplayExportPreset = {
  id: 'local-default',
  name: 'Standard',
  playbackRate: 1,
  frameAccurate: false,
  autoCloudSync: true,
  isDefault: true,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

function mapPreset(row: Record<string, unknown>): ReplayExportPreset {
  return {
    id: String(row.id),
    name: String(row.name),
    playbackRate: Number(row.playback_rate ?? 1),
    frameAccurate: Boolean(row.frame_accurate),
    autoCloudSync: Boolean(row.auto_cloud_sync),
    isDefault: Boolean(row.is_default),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function loadLocalPresets(): ReplayExportPreset[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [BUILTIN_DEFAULT];
    const parsed = JSON.parse(raw) as ReplayExportPreset[];
    return parsed.length > 0 ? parsed : [BUILTIN_DEFAULT];
  } catch {
    return [BUILTIN_DEFAULT];
  }
}

function saveLocalPresets(presets: ReplayExportPreset[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(presets));
  } catch {
    /* ignore */
  }
}

export async function fetchReplayExportPresets(): Promise<ReplayExportPreset[]> {
  if (!isSupabaseConfigured()) return loadLocalPresets();

  const { data, error } = await getSupabase().rpc('list_replay_export_presets');
  if (error) return loadLocalPresets();
  const cloud = ((data ?? []) as Record<string, unknown>[]).map(mapPreset);
  return cloud.length > 0 ? cloud : loadLocalPresets();
}

export async function saveReplayExportPreset(
  preset: Omit<ReplayExportPreset, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string },
): Promise<ReplayExportPreset> {
  if (!isSupabaseConfigured()) {
    const local = loadLocalPresets();
    const next: ReplayExportPreset = {
      ...preset,
      createdAt: preset.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const merged = preset.isDefault
      ? local.map((p) => ({ ...p, isDefault: false }))
      : local;
    const idx = merged.findIndex((p) => p.id === preset.id);
    if (idx >= 0) merged[idx] = next;
    else merged.unshift(next);
    saveLocalPresets(merged);
    return next;
  }

  const { data, error } = await getSupabase().rpc('upsert_replay_export_preset', {
    p_id: preset.id.startsWith('local-') ? null : preset.id,
    p_name: preset.name,
    p_playback_rate: preset.playbackRate,
    p_frame_accurate: preset.frameAccurate,
    p_auto_cloud_sync: preset.autoCloudSync,
    p_is_default: preset.isDefault,
  });
  if (error) throw new Error(error.message);
  return mapPreset(data as Record<string, unknown>);
}

export async function deleteReplayExportPreset(id: string): Promise<void> {
  if (id.startsWith('local-')) return;

  if (!isSupabaseConfigured()) {
    saveLocalPresets(loadLocalPresets().filter((p) => p.id !== id));
    return;
  }

  const { error } = await getSupabase().rpc('delete_replay_export_preset', { p_id: id });
  if (error) throw new Error(error.message);
}

export function resolveDefaultPreset(presets: ReplayExportPreset[]): ReplayExportPreset {
  return presets.find((p) => p.isDefault) ?? presets[0] ?? BUILTIN_DEFAULT;
}
