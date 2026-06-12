import type { CloudProjectMeta, SymphonyProject, Track, TrackColor } from '../types/symphony';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { USER_MSG } from './userMessaging';
import { LOOP_LIBRARY } from './symphony/loops';

const LOCAL_INDEX_KEY = 'cloudcast_symphony_projects';

type R2SymphonyAction = 'symphony-presign-upload' | 'symphony-presign-download' | 'symphony-delete';

async function invokeSymphonyR2<T>(action: R2SymphonyAction, body: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new Error(USER_MSG.cloudStorageUnavailable);
  }

  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in to use Regal Cloud Archive.');
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

function readLocalIndex(): CloudProjectMeta[] {
  try {
    const raw = localStorage.getItem(LOCAL_INDEX_KEY);
    return raw ? (JSON.parse(raw) as CloudProjectMeta[]) : [];
  } catch {
    return [];
  }
}

function writeLocalIndex(projects: CloudProjectMeta[]): void {
  localStorage.setItem(LOCAL_INDEX_KEY, JSON.stringify(projects));
}

const TRACK_COLORS: TrackColor[] = ['green', 'blue', 'purple', 'yellow', 'orange', 'red', 'cyan'];

export function createDefaultProject(name = 'Untitled Project'): SymphonyProject {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const tracks: Track[] = [
    { id: crypto.randomUUID(), index: 1, name: 'Heavy Bass', color: 'green', instrumentId: 'synth-bass-sub', volume: 85, pan: 0, muted: false, solo: false, armed: false },
    { id: crypto.randomUUID(), index: 2, name: 'Synth Lead', color: 'blue', instrumentId: 'synth-lead-bright', volume: 78, pan: 0, muted: false, solo: false, armed: false },
    { id: crypto.randomUUID(), index: 3, name: 'String Pad', color: 'purple', instrumentId: 'strings-legato', volume: 70, pan: -10, muted: false, solo: false, armed: false },
    { id: crypto.randomUUID(), index: 4, name: 'Drum Kit', color: 'green', instrumentId: 'drums-kit', volume: 90, pan: 0, muted: false, solo: false, armed: false },
    { id: crypto.randomUUID(), index: 5, name: 'Vocal Shouts', color: 'yellow', instrumentId: 'vocals-chops', volume: 75, pan: 15, muted: false, solo: false, armed: false },
    { id: crypto.randomUUID(), index: 6, name: 'Electronic Perc', color: 'green', instrumentId: 'perc-shaker', volume: 65, pan: -20, muted: false, solo: false, armed: false },
    { id: crypto.randomUUID(), index: 7, name: 'Arpeggio', color: 'purple', instrumentId: 'synth-lead-arp', volume: 72, pan: 25, muted: false, solo: false, armed: false },
    { id: crypto.randomUUID(), index: 8, name: 'Brass Section', color: 'orange', instrumentId: 'brass-horn', volume: 68, pan: 0, muted: false, solo: false, armed: false },
    { id: crypto.randomUUID(), index: 9, name: 'FX Riser', color: 'red', instrumentId: 'fx-riser', volume: 60, pan: 0, muted: false, solo: false, armed: false },
  ];

  const bassLoop = LOOP_LIBRARY.find((l) => l.id === 'loop-heavy-bass');
  const drumLoop = LOOP_LIBRARY.find((l) => l.id === 'loop-rising-tension');
  const leadLoop = LOOP_LIBRARY.find((l) => l.id === 'loop-synth-lead-arp');
  const vocalLoop = LOOP_LIBRARY.find((l) => l.id === 'loop-vocal-shouts');
  const stringLoop = LOOP_LIBRARY.find((l) => l.id === 'loop-string-pad');
  const percLoop = LOOP_LIBRARY.find((l) => l.id === 'loop-perc-groove');

  const regions = [
    bassLoop && { id: crypto.randomUUID(), trackId: tracks[0].id, name: bassLoop.name, startBar: 0, lengthBars: 4, loopId: bassLoop.id, notes: bassLoop.pattern, color: 'green' as const },
    leadLoop && { id: crypto.randomUUID(), trackId: tracks[1].id, name: leadLoop.name, startBar: 0, lengthBars: 4, loopId: leadLoop.id, notes: leadLoop.pattern, color: 'blue' as const },
    stringLoop && { id: crypto.randomUUID(), trackId: tracks[2].id, name: stringLoop.name, startBar: 0, lengthBars: 8, loopId: stringLoop.id, notes: stringLoop.pattern, color: 'purple' as const },
    drumLoop && { id: crypto.randomUUID(), trackId: tracks[3].id, name: drumLoop.name, startBar: 0, lengthBars: 4, loopId: drumLoop.id, notes: drumLoop.pattern, color: 'green' as const },
    vocalLoop && { id: crypto.randomUUID(), trackId: tracks[4].id, name: vocalLoop.name, startBar: 0, lengthBars: 4, loopId: vocalLoop.id, notes: vocalLoop.pattern, color: 'yellow' as const },
    percLoop && { id: crypto.randomUUID(), trackId: tracks[5].id, name: percLoop.name, startBar: 0, lengthBars: 4, loopId: percLoop.id, notes: percLoop.pattern, color: 'green' as const },
    leadLoop && { id: crypto.randomUUID(), trackId: tracks[6].id, name: 'Arpeggio', startBar: 0, lengthBars: 4, notes: leadLoop.pattern, color: 'purple' as const },
  ].filter(Boolean) as SymphonyProject['regions'];

  return {
    id,
    name,
    tempo: 127,
    timeSignature: [4, 4],
    key: 'C maj',
    tracks,
    regions,
    markers: [],
    masterVolume: 85,
    limiterThreshold: -18,
    createdAt: now,
    updatedAt: now,
  };
}

export function nextTrackColor(index: number): TrackColor {
  return TRACK_COLORS[index % TRACK_COLORS.length];
}

export async function listCloudProjects(): Promise<CloudProjectMeta[]> {
  return readLocalIndex();
}

export async function saveProjectToRegalCloud(project: SymphonyProject): Promise<CloudProjectMeta> {
  const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });

  const presign = await invokeSymphonyR2<{ uploadUrl: string; storagePath: string }>(
    'symphony-presign-upload',
    { mime_type: 'application/json', size_bytes: blob.size, project_id: project.id },
  );

  const uploadRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: blob,
  });

  if (!uploadRes.ok) {
    throw new Error(USER_MSG.cloudStorageUploadFailed);
  }

  const meta: CloudProjectMeta = {
    id: project.id,
    name: project.name,
    storagePath: presign.storagePath,
    sizeBytes: blob.size,
    updatedAt: new Date().toISOString(),
  };

  const index = readLocalIndex().filter((p) => p.id !== project.id);
  index.unshift(meta);
  writeLocalIndex(index);

  return meta;
}

export async function loadProjectFromRegalCloud(meta: CloudProjectMeta): Promise<SymphonyProject> {
  const { url } = await invokeSymphonyR2<{ url: string }>('symphony-presign-download', {
    storage_path: meta.storagePath,
    file_name: `${meta.name}.ccsym`,
  });

  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not download project from Regal Cloud Archive.');
  return (await res.json()) as SymphonyProject;
}

export async function deleteCloudProject(meta: CloudProjectMeta): Promise<void> {
  await invokeSymphonyR2('symphony-delete', { storage_path: meta.storagePath });
  writeLocalIndex(readLocalIndex().filter((p) => p.id !== meta.id));
}

export function exportProjectJson(project: SymphonyProject): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name}.ccsym`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importProjectJson(file: File): Promise<SymphonyProject> {
  const text = await file.text();
  return JSON.parse(text) as SymphonyProject;
}
