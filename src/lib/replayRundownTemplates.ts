import { getSupabase, isSupabaseConfigured } from './supabase';
import type { ReplayBankSlot, ReplayRundownItem } from '../types/replay';

export interface ReplayRundownTemplateItem {
  bankIndex: number;
  label: string;
  clipId?: string;
  cloudId?: string;
}

export interface ReplayRundownTemplate {
  id: string;
  sessionId: string | null;
  name: string;
  playbackRate: number;
  items: ReplayRundownTemplateItem[];
  createdAt: string;
  updatedAt: string;
}

const LOCAL_KEY = 'cloudcast-replay-rundown-templates';

function mapRow(row: Record<string, unknown>): ReplayRundownTemplate {
  const itemsRaw = row.items;
  const items = Array.isArray(itemsRaw)
    ? itemsRaw.map((item) => {
        const rowItem = item as Record<string, unknown>;
        return {
          bankIndex: Number(rowItem.bank_index ?? rowItem.bankIndex ?? 0),
          label: String(rowItem.label ?? ''),
          clipId: rowItem.clip_id ? String(rowItem.clip_id) : rowItem.clipId ? String(rowItem.clipId) : undefined,
          cloudId: rowItem.cloud_id ? String(rowItem.cloud_id) : rowItem.cloudId ? String(rowItem.cloudId) : undefined,
        };
      })
    : [];

  return {
    id: String(row.id),
    sessionId: row.session_id ? String(row.session_id) : null,
    name: String(row.name),
    playbackRate: Number(row.playback_rate ?? 1),
    items,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function loadLocalTemplates(): ReplayRundownTemplate[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ReplayRundownTemplate[];
  } catch {
    return [];
  }
}

function saveLocalTemplates(templates: ReplayRundownTemplate[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(templates));
  } catch {
    /* ignore */
  }
}

export async function fetchReplayRundownTemplates(sessionId?: string | null): Promise<ReplayRundownTemplate[]> {
  if (!isSupabaseConfigured()) {
    const local = loadLocalTemplates();
    return sessionId ? local.filter((t) => !t.sessionId || t.sessionId === sessionId) : local;
  }

  const { data, error } = await getSupabase().rpc('list_replay_rundown_templates', {
    p_session_id: sessionId ?? null,
  });
  if (error) return loadLocalTemplates();
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}

export async function saveReplayRundownTemplate(input: {
  id?: string;
  sessionId?: string | null;
  name: string;
  playbackRate: number;
  items: ReplayRundownTemplateItem[];
}): Promise<ReplayRundownTemplate> {
  const payloadItems = input.items.map((item) => ({
    bank_index: item.bankIndex,
    label: item.label,
    clip_id: item.clipId ?? null,
    cloud_id: item.cloudId ?? null,
  }));

  if (!isSupabaseConfigured()) {
    const local = loadLocalTemplates();
    const next: ReplayRundownTemplate = {
      id: input.id ?? crypto.randomUUID(),
      sessionId: input.sessionId ?? null,
      name: input.name,
      playbackRate: input.playbackRate,
      items: input.items,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const idx = local.findIndex((t) => t.id === next.id);
    if (idx >= 0) local[idx] = next;
    else local.unshift(next);
    saveLocalTemplates(local);
    return next;
  }

  const { data, error } = await getSupabase().rpc('upsert_replay_rundown_template', {
    p_id: input.id ?? null,
    p_session_id: input.sessionId ?? null,
    p_name: input.name,
    p_playback_rate: input.playbackRate,
    p_items: payloadItems,
  });
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function deleteReplayRundownTemplate(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    saveLocalTemplates(loadLocalTemplates().filter((t) => t.id !== id));
    return;
  }

  const { error } = await getSupabase().rpc('delete_replay_rundown_template', { p_id: id });
  if (error) throw new Error(error.message);
}

export function buildTemplateItemsFromDraft(
  banks: ReplayBankSlot[],
  bankIndices: number[],
): ReplayRundownTemplateItem[] {
  const items: ReplayRundownTemplateItem[] = [];
  for (const bankIndex of bankIndices) {
    const clip = banks[bankIndex]?.clip;
    if (!clip) continue;
    items.push({
      bankIndex,
      label: clip.sourceLabel,
      clipId: clip.id,
      cloudId: clip.cloudId,
    });
  }
  return items;
}

export function resolveTemplateBankIndices(
  banks: ReplayBankSlot[],
  template: ReplayRundownTemplate,
): number[] {
  const resolved: number[] = [];

  for (const item of template.items) {
    const byClip = banks.findIndex((bank) => bank.clip?.id === item.clipId);
    if (byClip >= 0) {
      resolved.push(byClip);
      continue;
    }
    if (banks[item.bankIndex]?.clip) {
      resolved.push(item.bankIndex);
    }
  }

  return resolved;
}

export { mapRow as mapReplayRundownTemplateRow };

export function templateItemsToRundownItems(
  banks: ReplayBankSlot[],
  bankIndices: number[],
  playbackRate: number,
): ReplayRundownItem[] {
  const items: ReplayRundownItem[] = [];
  for (const bankIndex of bankIndices) {
    const clip = banks[bankIndex]?.clip;
    if (!clip) continue;
    items.push({
      url: clip.blobUrl,
      label: clip.sourceLabel,
      clipId: clip.id,
      playbackRate,
      busTake: true,
      bankIndex,
    });
  }
  return items;
}
