import { getSupabase, isSupabaseConfigured } from './supabase';

export interface AudioComplianceExportPreset {
  id: string;
  name: string;
  includeAudit: boolean;
  includeChannels: boolean;
  includeScenes: boolean;
  includeRundown: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const LOCAL_KEY = 'cloudcast-audio-compliance-export-presets';

const BUILTIN_DEFAULT: AudioComplianceExportPreset = {
  id: 'local-default',
  name: 'Full handoff',
  includeAudit: true,
  includeChannels: true,
  includeScenes: true,
  includeRundown: false,
  isDefault: true,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

function mapPreset(row: Record<string, unknown>): AudioComplianceExportPreset {
  return {
    id: String(row.id),
    name: String(row.name),
    includeAudit: Boolean(row.include_audit),
    includeChannels: Boolean(row.include_channels),
    includeScenes: Boolean(row.include_scenes),
    includeRundown: Boolean(row.include_rundown),
    isDefault: Boolean(row.is_default),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function loadLocalPresets(): AudioComplianceExportPreset[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [BUILTIN_DEFAULT];
    const parsed = JSON.parse(raw) as AudioComplianceExportPreset[];
    return parsed.length > 0 ? parsed : [BUILTIN_DEFAULT];
  } catch {
    return [BUILTIN_DEFAULT];
  }
}

function saveLocalPresets(presets: AudioComplianceExportPreset[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(presets));
  } catch {
    /* ignore */
  }
}

export async function fetchAudioComplianceExportPresets(): Promise<AudioComplianceExportPreset[]> {
  if (!isSupabaseConfigured()) return loadLocalPresets();
  const { data, error } = await getSupabase().rpc('list_audio_compliance_export_presets');
  if (error) return loadLocalPresets();
  const cloud = ((data ?? []) as Record<string, unknown>[]).map(mapPreset);
  return cloud.length > 0 ? cloud : loadLocalPresets();
}

export async function saveAudioComplianceExportPreset(
  preset: Omit<AudioComplianceExportPreset, 'createdAt' | 'updatedAt'> & {
    createdAt?: string;
    updatedAt?: string;
  },
): Promise<AudioComplianceExportPreset> {
  if (!isSupabaseConfigured()) {
    const local = loadLocalPresets();
    const next: AudioComplianceExportPreset = {
      ...preset,
      createdAt: preset.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const merged = preset.isDefault ? local.map((p) => ({ ...p, isDefault: false })) : local;
    const idx = merged.findIndex((p) => p.id === preset.id);
    if (idx >= 0) merged[idx] = next;
    else merged.unshift(next);
    saveLocalPresets(merged);
    return next;
  }

  const { data, error } = await getSupabase().rpc('upsert_audio_compliance_export_preset', {
    p_id: preset.id.startsWith('local-') ? null : preset.id,
    p_name: preset.name,
    p_include_audit: preset.includeAudit,
    p_include_channels: preset.includeChannels,
    p_include_scenes: preset.includeScenes,
    p_include_rundown: preset.includeRundown,
    p_is_default: preset.isDefault,
  });
  if (error) throw new Error(error.message);
  return mapPreset(data as Record<string, unknown>);
}

export async function deleteAudioComplianceExportPreset(id: string): Promise<void> {
  if (id.startsWith('local-')) return;
  if (!isSupabaseConfigured()) {
    saveLocalPresets(loadLocalPresets().filter((p) => p.id !== id));
    return;
  }
  const { error } = await getSupabase().rpc('delete_audio_compliance_export_preset', { p_id: id });
  if (error) throw new Error(error.message);
}

export function resolveDefaultComplianceExportPreset(
  presets: AudioComplianceExportPreset[],
): AudioComplianceExportPreset {
  return presets.find((p) => p.isDefault) ?? presets[0] ?? BUILTIN_DEFAULT;
}
