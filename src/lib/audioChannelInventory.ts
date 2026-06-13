import type { AudioInputSource } from '../types/audio';
import { AUDIO_SOURCE_LABELS } from '../types/audio';
import type { Device } from '../types/device';
import { isRealDevice } from '../types/device';
import type { AudioConsoleState } from '../hooks/useAudioConsoleState';
import { downloadBlobLocally } from './replayClipService';

export interface AudioChannelInventoryRow {
  channelIndex: number;
  deviceId: string;
  label: string;
  status: string;
  platform: string;
  audioSource: string;
  linkedUsbId: string | null;
  volume: number;
  muted: boolean;
  mixEnabled: boolean;
  solo: boolean;
  fatChannelActive: boolean;
}

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildChannelInventoryRows(input: {
  devices: Device[];
  state: AudioConsoleState;
  getAudioSourceForDevice: (deviceId: string) => AudioInputSource;
  linkedUsb: Record<string, string | null>;
}): AudioChannelInventoryRow[] {
  const rows: AudioChannelInventoryRow[] = [];

  input.devices.forEach((device, index) => {
    if (!isRealDevice(device)) return;
    const source = input.getAudioSourceForDevice(device.deviceId);
    rows.push({
      channelIndex: index + 1,
      deviceId: device.deviceId,
      label: input.state.channelLabels[device.deviceId] ?? device.label,
      status: device.status,
      platform: device.platform,
      audioSource: AUDIO_SOURCE_LABELS[source] ?? source,
      linkedUsbId: input.linkedUsb[device.deviceId] ?? null,
      volume: input.state.inputVolumes[device.deviceId] ?? 0,
      muted: Boolean(input.state.inputMuted[device.deviceId]),
      mixEnabled: input.state.mixEnabled[device.deviceId] !== false,
      solo: input.state.soloId === device.deviceId,
      fatChannelActive: Boolean(input.state.fatChannel[device.deviceId]),
    });
  });

  return rows;
}

export function buildChannelInventoryCsv(rows: AudioChannelInventoryRow[]): string {
  const header = [
    'channel',
    'device_id',
    'label',
    'status',
    'platform',
    'audio_source',
    'linked_usb_id',
    'volume',
    'muted',
    'mix_enabled',
    'solo',
    'fat_channel',
  ];
  const body = rows.map((row) => [
    String(row.channelIndex),
    row.deviceId,
    row.label,
    row.status,
    row.platform,
    row.audioSource,
    row.linkedUsbId ?? '',
    String(row.volume),
    String(row.muted),
    String(row.mixEnabled),
    String(row.solo),
    String(row.fatChannelActive),
  ]);
  return [header.join(','), ...body.map((r) => r.map(csvEscape).join(','))].join('\n');
}

export function buildChannelInventoryJson(
  rows: AudioChannelInventoryRow[],
  sessionId?: string | null,
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      sessionId: sessionId ?? null,
      channelCount: rows.length,
      channels: rows,
    },
    null,
    2,
  );
}

export function downloadChannelInventoryCsv(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'text/csv;charset=utf-8' }), fileName);
}

export function downloadChannelInventoryJson(content: string, fileName: string): void {
  downloadBlobLocally(new Blob([content], { type: 'application/json;charset=utf-8' }), fileName);
}
