export type VideoMixerHealth = 'ok' | 'warn' | 'fail' | 'idle';

export interface VideoSwitcherDebug {
  isOnAir: boolean;
  isRecording: boolean;
  liveInputCount: number;
  pstDeviceId: string | null;
  pgmDeviceId: string | null;
  inTransition: boolean;
}

export interface VideoChecklistSection {
  title: string;
  steps: Array<{
    id: string;
    label: string;
    hint: string;
    autoPass?: boolean;
  }>;
}

export function evaluateVideoSwitcherHealth(
  switcher: VideoSwitcherDebug,
): { health: VideoMixerHealth; reason: string } {
  if (switcher.liveInputCount === 0) {
    return { health: 'fail', reason: 'No live sources — pair CloudCast Mobile or add IP camera' };
  }
  if (!switcher.pgmDeviceId) {
    return { health: 'warn', reason: 'PGM bus empty — assign a program source' };
  }
  if (switcher.isOnAir) {
    return { health: 'ok', reason: 'On air with live program output' };
  }
  return { health: 'warn', reason: `${switcher.liveInputCount} live source(s) — not streaming yet` };
}

export function buildVideoMixerChecklist(input: {
  switcher: VideoSwitcherDebug;
  hasPairedDevices: boolean;
  isSignalingLeader: boolean;
  operatorReadOnly: boolean;
  canCloud: boolean;
}): VideoChecklistSection[] {
  const switcherHealth = evaluateVideoSwitcherHealth(input.switcher);

  return [
    {
      title: '1 · Pairing & ingress',
      steps: [
        {
          id: 'devices-paired',
          label: 'Mobile or IP sources paired',
          autoPass: input.hasPairedDevices,
          hint: 'Share the access code from the header or configure an IP camera slot.',
        },
        {
          id: 'signaling-leader',
          label: 'This tab is receiving mobile streams',
          autoPass: input.isSignalingLeader,
          hint: 'Close other CloudCast dashboard tabs so this one is the signaling leader.',
        },
        {
          id: 'live-inputs',
          label: `Live inputs (${input.switcher.liveInputCount})`,
          autoPass: input.switcher.liveInputCount > 0,
          hint: switcherHealth.reason,
        },
      ],
    },
    {
      title: '2 · Program bus',
      steps: [
        {
          id: 'pgm-assigned',
          label: 'PGM source assigned',
          autoPass: Boolean(input.switcher.pgmDeviceId),
          hint: 'Cut or take a source to program output.',
        },
        {
          id: 'pst-preview',
          label: 'Preview bus active',
          autoPass: Boolean(input.switcher.pstDeviceId),
          hint: 'Select a source on PST before cut/take.',
        },
        {
          id: 'on-air',
          label: input.switcher.isOnAir ? 'Streaming on air' : 'Off air',
          autoPass: input.switcher.isOnAir,
          hint: 'Go Live from the stream panel when ready.',
        },
      ],
    },
    {
      title: '3 · Enterprise',
      steps: [
        {
          id: 'audit-trail',
          label: 'Operator audit trail',
          hint: 'Cut, take, on-air, and recording events logged to Regal Cloud when signed in.',
        },
        {
          id: 'operator-lock',
          label: 'Multi-operator director lock',
          autoPass: !input.operatorReadOnly,
          hint: 'Only one TD operator controls switching per session; others are read-only followers.',
        },
        {
          id: 'director-sync',
          label: 'Cross-operator director sync',
          hint: 'Read-only stations mirror primary operator PST/PGM and on-air state.',
        },
        {
          id: 'program-presets',
          label: 'Cloud program presets',
          autoPass: input.canCloud,
          hint: 'Save and reload full show configuration to Regal Cloud (Pro+).',
        },
        {
          id: 'preset-share',
          label: 'Team preset share codes',
          autoPass: input.canCloud,
          hint: 'Publish an 8-character code so another operator can import your program preset.',
        },
        {
          id: 'preset-library',
          label: 'Account preset library',
          autoPass: input.canCloud,
          hint: 'Promote presets to reusable categories across sessions.',
        },
        {
          id: 'program-snapshot',
          label: 'Ops program snapshot archival',
          autoPass: input.canCloud,
          hint: 'Rolling PGM metadata saved to Regal Cloud every 30s while dashboard is live.',
        },
        {
          id: 'ops-digest',
          label: 'Ops digest email',
          autoPass: input.canCloud,
          hint: 'Email summary of program snapshots and audit events from the last 7 days.',
        },
        {
          id: 'compliance-export',
          label: 'Compliance audit export',
          hint: 'Download CSV/JSON switch event trail from the audit panel.',
        },
      ],
    },
  ];
}

export function formatVideoMixerDebugSnapshot(snapshot: Record<string, unknown>): string {
  return JSON.stringify(snapshot, null, 2);
}
