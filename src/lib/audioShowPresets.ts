import { getSupabase, isSupabaseConfigured } from './supabase';
import type { PersistedAudioMixerData } from './audioConsolePersistence';

export interface AudioShowPreset {
  id: string;
  sessionId: string | null;
  name: string;
  config: PersistedAudioMixerData;
  createdAt: string;
  updatedAt: string;
}

const LOCAL_KEY = 'cloudcast-audio-show-presets';

function mapRow(row: Record<string, unknown>): AudioShowPreset {
  return {
    id: String(row.id),
    sessionId: row.session_id ? String(row.session_id) : null,
    name: String(row.name),
    config: (row.config as PersistedAudioMixerData) ?? { console: {}, scenes: {}, audioSources: {}, linkedUsb: {} },
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function loadLocal(): AudioShowPreset[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AudioShowPreset[];
  } catch {
    return [];
  }
}

function saveLocal(presets: AudioShowPreset[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(presets));
  } catch {
    /* ignore */
  }
}

export { mapRow as mapAudioShowPresetRow };

export async function fetchAudioShowPresets(sessionId?: string | null): Promise<AudioShowPreset[]> {
  if (!isSupabaseConfigured()) {
    const local = loadLocal();
    return sessionId ? local.filter((p) => !p.sessionId || p.sessionId === sessionId) : local;
  }

  const { data, error } = await getSupabase().rpc('list_audio_show_presets', {
    p_session_id: sessionId ?? null,
  });
  if (error) return loadLocal();
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}

export async function saveAudioShowPreset(input: {
  id?: string;
  sessionId?: string | null;
  name: string;
  config: PersistedAudioMixerData;
}): Promise<AudioShowPreset> {
  if (!isSupabaseConfigured()) {
    const local = loadLocal();
    const next: AudioShowPreset = {
      id: input.id ?? crypto.randomUUID(),
      sessionId: input.sessionId ?? null,
      name: input.name,
      config: input.config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const idx = local.findIndex((p) => p.id === next.id);
    if (idx >= 0) local[idx] = next;
    else local.unshift(next);
    saveLocal(local);
    return next;
  }

  const { data, error } = await getSupabase().rpc('upsert_audio_show_preset', {
    p_id: input.id ?? null,
    p_session_id: input.sessionId ?? null,
    p_name: input.name,
    p_config: input.config,
  });
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function deleteAudioShowPreset(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    saveLocal(loadLocal().filter((p) => p.id !== id));
    return;
  }

  const { error } = await getSupabase().rpc('delete_audio_show_preset', { p_id: id });
  if (error) throw new Error(error.message);
}
