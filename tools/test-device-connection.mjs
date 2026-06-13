/**
 * Lightweight connectivity reconciliation checks (no test runner required).
 * Run: node tools/test-device-connection.mjs
 */

const DEVICE_CONNECTING_TIMEOUT_MS = 40_000;

function deriveStatusFromConnection(hasStream, presenceOnline, peerState) {
  if (hasStream) return 'live';
  if (
    presenceOnline ||
    peerState === 'connecting' ||
    peerState === 'new' ||
    peerState === 'connected'
  ) {
    return 'connecting';
  }
  return 'offline';
}

function reconcileDeviceConnectivity(device, context) {
  const nowMs = context.nowMs ?? Date.now();
  const now = new Date(nowMs).toISOString();
  const meshActive = context.hasMeshStream;
  const { presenceOnline, peerState, connectingSinceMs, videoTransport } = context;
  const cloudPlayback = videoTransport === 'cloud' || Boolean(device.whepUrl?.trim());

  if (meshActive) {
    return { ...device, status: 'live', isOnline: true, connectionState: 'connected', lastSeenAt: now };
  }

  if (cloudPlayback && device.status === 'live') {
    return {
      ...device,
      status: 'live',
      isOnline: presenceOnline || device.isOnline,
      connectionState: 'connected',
      lastSeenAt: now,
    };
  }

  if (peerState === 'connected') {
    return {
      ...device,
      status: 'connecting',
      isOnline: true,
      connectionState: 'connected',
      lastSeenAt: now,
    };
  }

  if (presenceOnline || peerState === 'connecting' || peerState === 'new') {
    const since = connectingSinceMs ?? (device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : nowMs);
    const stuckConnecting = !meshActive && since > 0 && nowMs - since > DEVICE_CONNECTING_TIMEOUT_MS;
    if (stuckConnecting) {
      return {
        ...device,
        status: 'offline',
        isOnline: false,
        connectionState: 'disconnected',
        lastSeenAt: device.lastSeenAt ?? now,
      };
    }
    return {
      ...device,
      status: 'connecting',
      isOnline: true,
      connectionState: peerState ?? 'connecting',
      lastSeenAt: now,
    };
  }

  const staleLiveWithoutFeed =
    device.status === 'live' && !meshActive && !cloudPlayback && !presenceOnline;

  if (staleLiveWithoutFeed) {
    return { ...device, status: 'offline', isOnline: false, connectionState: 'disconnected' };
  }

  return { ...device, status: 'offline', isOnline: false, connectionState: 'disconnected' };
}

const base = {
  deviceId: 'dev-1',
  label: 'Cam 1',
  platform: 'ios',
  whepUrl: '',
  streamId: '',
  status: 'offline',
  updatedAt: new Date().toISOString(),
  isOnline: false,
  lastSeenAt: new Date().toISOString(),
};

const cases = [
  {
    name: 'peer connected without stream stays connecting (CONNECTED UI)',
    input: { ...base, status: 'connecting' },
    ctx: { presenceOnline: true, hasMeshStream: false, peerState: 'connected', nowMs: Date.now() },
    expect: { status: 'connecting', connectionState: 'connected' },
  },
  {
    name: 'active mesh stream is live',
    input: { ...base, status: 'connecting' },
    ctx: { presenceOnline: true, hasMeshStream: true, peerState: 'connected', nowMs: Date.now() },
    expect: { status: 'live' },
  },
  {
    name: 'regal cloud live with whep stays live without mesh',
    input: { ...base, status: 'live', whepUrl: 'https://stream.example/whep/abc' },
    ctx: { presenceOnline: true, hasMeshStream: false, videoTransport: 'cloud', nowMs: Date.now() },
    expect: { status: 'live', isOnline: true },
  },
  {
    name: 'mesh live without stream is not forced offline while on presence',
    input: { ...base, status: 'live' },
    ctx: { presenceOnline: true, hasMeshStream: false, videoTransport: 'mesh', nowMs: Date.now() },
    expect: { status: 'connecting' },
  },
  {
    name: 'linked connecting (acknowledged) stays connecting with isOnline',
    input: { ...base, status: 'connecting', isOnline: true, connectionState: 'connected' },
    ctx: { presenceOnline: true, hasMeshStream: false, peerState: 'connected', nowMs: Date.now() },
    expect: { status: 'connecting', isOnline: true, connectionState: 'connected' },
  },
  {
    name: 'deriveStatus: connected peer without stream is connecting',
    fn: () => deriveStatusFromConnection(false, false, 'connected'),
    expect: 'connecting',
  },
];

let failed = 0;
for (const testCase of cases) {
  const result = testCase.fn
    ? testCase.fn()
    : reconcileDeviceConnectivity(testCase.input, testCase.ctx);
  const expected = testCase.expect;
  const ok = Object.entries(expected).every(([key, value]) => result[key] === value);
  if (!ok) {
    failed += 1;
    console.error(`FAIL: ${testCase.name}`, { expected, got: result });
  } else {
    console.log(`ok: ${testCase.name}`);
  }
}

if (failed > 0) {
  process.exitCode = 1;
  console.error(`${failed} test(s) failed`);
} else {
  console.log(`All ${cases.length} checks passed`);
}
