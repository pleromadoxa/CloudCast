import type { ConnectionMode } from '../types/plans';
import type { DeviceConnectionDebugRow } from './audioConnectionDebug';

export type AudioMixerHealth = 'ok' | 'warn' | 'fail' | 'idle';

export interface AudioEngineDebug {
  consoleEnabled: boolean;
  masterMuted: boolean;
  monitorMuted: boolean;
  masterVolume: number;
  activeChannels: number;
  liveInputCount: number;
  soloActive: boolean;
}

export interface AudioBridgeDebug {
  canBridge: boolean;
  bridgeCode: string | null;
  bridgeConnected: boolean;
}

export interface AudioChecklistSection {
  title: string;
  steps: Array<{
    id: string;
    label: string;
    hint: string;
    autoPass?: boolean;
  }>;
}

export function evaluateAudioEngineHealth(engine: AudioEngineDebug): { health: AudioMixerHealth; reason: string } {
  if (!engine.consoleEnabled) {
    return { health: 'idle', reason: 'Console powered off' };
  }
  if (engine.liveInputCount > 0) {
    return { health: 'ok', reason: `${engine.liveInputCount} live input(s)` };
  }
  return { health: 'warn', reason: 'No live audio inputs — pair CloudCast Mobile or add USB mic' };
}

export function evaluateAudioIngressHealth(rows: DeviceConnectionDebugRow[]): { health: AudioMixerHealth; reason: string } {
  const live = rows.filter((r) => r.usableAudio);
  if (live.length > 0) return { health: 'ok', reason: `${live.length} input(s) with usable audio` };
  if (rows.some((r) => r.status === 'live' || r.status === 'connecting')) {
    return { health: 'warn', reason: 'Devices connected but no usable audio tracks yet' };
  }
  return { health: 'fail', reason: 'No paired devices with audio' };
}

export function buildAudioMixerChecklist(input: {
  engine: AudioEngineDebug;
  bridge: AudioBridgeDebug;
  deviceRows: DeviceConnectionDebugRow[];
  hasPairedDevices: boolean;
  connectionMode: ConnectionMode;
  operatorReadOnly: boolean;
  storedSceneCount: number;
  fatChannelEnabled: boolean;
}): AudioChecklistSection[] {
  const engineHealth = evaluateAudioEngineHealth(input.engine);
  const ingressHealth = evaluateAudioIngressHealth(input.deviceRows);

  return [
    {
      title: '1 · Pairing & ingress',
      steps: [
        {
          id: 'devices-paired',
          label: 'Mobile or USB inputs paired',
          autoPass: input.hasPairedDevices,
          hint: 'Share the access code from the header or add host USB microphones.',
        },
        {
          id: 'usable-audio',
          label: 'Usable audio tracks on inputs',
          autoPass: ingressHealth.health === 'ok',
          hint:
            input.connectionMode === 'mesh'
              ? 'Mesh audio from CloudCast Mobile.'
              : 'Audio sessions use mesh; verify mobile app sends audio.',
        },
      ],
    },
    {
      title: '2 · Console',
      steps: [
        {
          id: 'console-live',
          label: 'Console powered on',
          autoPass: input.engine.consoleEnabled,
          hint: 'Master section — toggle console power.',
        },
        {
          id: 'engine-health',
          label: `Engine health: ${engineHealth.health}`,
          autoPass: engineHealth.health === 'ok',
          hint: engineHealth.reason,
        },
        {
          id: 'scenes-stored',
          label: `Scenes stored (${input.storedSceneCount}/4)`,
          autoPass: input.storedSceneCount > 0,
          hint: 'Store scenes A–D for show recall (Shift+A–D).',
        },
      ],
    },
    {
      title: '3 · Universal bridge',
      steps: [
        {
          id: 'bridge-available',
          label: 'Universal audio↔video bridge available',
          autoPass: input.bridge.canBridge,
          hint: 'Requires Universal bundle or linked Video Mixer entitlement.',
        },
        {
          id: 'bridge-connected',
          label: 'PGM bridge publishing',
          autoPass: !input.bridge.canBridge || input.bridge.bridgeConnected,
          hint: 'Generate bridge code and link Video Mixer program bus.',
        },
      ],
    },
    {
      title: '4 · Enterprise',
      steps: [
        {
          id: 'audit-trail',
          label: 'Operator audit trail',
          hint: 'Scene recall, mutes, bridge events logged to Regal Cloud when signed in.',
        },
        {
          id: 'operator-lock',
          label: 'Multi-operator console lock',
          autoPass: !input.operatorReadOnly,
          hint: 'Only one A1 operator controls faders per session; others are read-only followers.',
        },
        {
          id: 'director-sync',
          label: 'Cross-operator director sync',
          hint: 'Read-only stations mirror primary operator channel, master, and scene state.',
        },
        {
          id: 'show-presets',
          label: 'Cloud show file presets',
          hint: 'Save and reload full console state to Regal Cloud (Pro+).',
        },
        {
          id: 'compliance-export',
          label: 'Compliance audit export',
          hint: 'Download CSV/JSON mix event trail from the audit panel.',
        },
        {
          id: 'show-share',
          label: 'Team show file share codes',
          hint: 'Publish an 8-character code so another operator can import your show file.',
        },
        {
          id: 'show-library',
          label: 'Account show library',
          hint: 'Promote show files to reusable categories across sessions.',
        },
        {
          id: 'console-snapshot',
          label: 'Ops console snapshot archival',
          hint: 'Rolling metadata saved to Regal Cloud every 30s while console is live.',
        },
        {
          id: 'ops-digest',
          label: 'Ops digest email',
          hint: 'Email summary of console snapshots and audit events from the last 7 days.',
        },
        {
          id: 'fat-channel-tier',
          label: 'Fat Channel (Pro Master)',
          autoPass: input.fatChannelEnabled,
          hint: 'EQ, dynamics, and noise cancel on Fat Channel require Pro Master tier.',
        },
        {
          id: 'scene-rundown',
          label: 'Automated scene rundown queue',
          hint: 'Build A–D recall sequences with hold times; save templates to Regal Cloud.',
        },
        {
          id: 'scene-diff',
          label: 'Scene diff compliance export',
          hint: 'Compare stored scenes and export CSV/JSON fader/mute deltas.',
        },
        {
          id: 'scheduled-digest',
          label: 'Scheduled ops digest email',
          hint: 'Daily/weekly digests auto-send when console opens and schedule is due.',
        },
        {
          id: 'rundown-sync',
          label: 'Rundown director sync',
          hint: 'Primary operator broadcasts rundown step and scene queue to read-only followers.',
        },
        {
          id: 'rundown-share',
          label: 'Scene rundown share codes',
          hint: 'Publish 8-character codes so another operator can import rundown templates.',
        },
        {
          id: 'fx-diff',
          label: 'FX slot diff export',
          hint: 'Compare stored scenes and export CSV/JSON FX enable/mix deltas for slots A–D.',
        },
        {
          id: 'rundown-library',
          label: 'Account rundown library',
          hint: 'Promote scene rundown templates to reusable categories across sessions.',
        },
        {
          id: 'scene-cloud-backup',
          label: 'Cloud scene backup & restore',
          hint: 'Shift+store syncs scenes A–D to Regal Cloud; restore from backup panel.',
        },
        {
          id: 'scene-manifest',
          label: 'Scene manifest compliance export',
          hint: 'Download SCENES CSV/JSON manifest of stored scene metadata from audit panel.',
        },
        {
          id: 'follower-rundown-mirror',
          label: 'Follower rundown auto-recall toggle',
          hint: 'Read-only operators can disable automatic scene recall during director rundown.',
        },
        {
          id: 'console-lifecycle',
          label: 'Console metadata lifecycle',
          hint: 'Auto-prune old ops snapshots and cloud scene backups from Regal Cloud.',
        },
        {
          id: 'channel-inventory',
          label: 'Channel inventory export',
          hint: 'Export live input routing, levels, and mute state as CSV/JSON.',
        },
        {
          id: 'rundown-runsheet',
          label: 'Rundown run sheet export',
          hint: 'Export scene rundown queue as CSV/JSON/TXT show calling sheet.',
        },
        {
          id: 'auto-lifecycle',
          label: 'Auto lifecycle on console open',
          hint: 'Prune old snapshots and backups automatically when console opens (24h rate limit).',
        },
        {
          id: 'compliance-presets',
          label: 'Compliance export presets',
          hint: 'Save which sections to include in one-click compliance handoff bundles.',
        },
        {
          id: 'compliance-bundle',
          label: 'Compliance handoff bundle',
          hint: 'Export audit, channels, scenes, and rundown in a single JSON bundle.',
        },
      ],
    },
  ];
}

export function formatAudioMixerDebugSnapshot(snapshot: Record<string, unknown>): string {
  return JSON.stringify(snapshot, null, 2);
}
