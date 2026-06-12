import { WhepClient, type WhepConnectionState } from './whepClient';
import { whepUrlWithQuality } from './whepQuality';
import type { StreamQuality } from '../types/device';

export interface WhepPoolSnapshot {
  stream: MediaStream | null;
  connectionState: WhepConnectionState;
  error: string | null;
}

type Listener = (snap: WhepPoolSnapshot) => void;

interface Entry {
  deviceId: string;
  whepUrl: string;
  quality: StreamQuality;
  client: WhepClient;
  stream: MediaStream | null;
  connectionState: WhepConnectionState;
  error: string | null;
  refCount: number;
  listeners: Set<Listener>;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
  connecting: boolean;
}

const DISCONNECT_GRACE_MS = 1500;
const pool = new Map<string, Entry>();

function poolKey(deviceId: string, quality: StreamQuality) {
  return `${deviceId}|${quality}`;
}

function snapshot(entry: Entry): WhepPoolSnapshot {
  return {
    stream: entry.stream,
    connectionState: entry.connectionState,
    error: entry.error,
  };
}

function notify(entry: Entry) {
  const snap = snapshot(entry);
  entry.listeners.forEach((fn) => fn(snap));
}

async function connectEntry(entry: Entry) {
  if (entry.connecting) return;
  entry.connecting = true;
  entry.error = null;
  try {
    const resolvedUrl = whepUrlWithQuality(entry.whepUrl, entry.quality);
    entry.client = new WhepClient({
      whepUrl: resolvedUrl,
      onStateChange: (state) => {
        entry.connectionState = state;
        notify(entry);
      },
      onTrack: (stream) => {
        entry.stream = stream;
        notify(entry);
      },
    });
    const mediaStream = await entry.client.connect();
    entry.stream = mediaStream;
    notify(entry);
  } catch (err) {
    entry.error = err instanceof Error ? err.message : 'Stream connection failed';
    entry.connectionState = 'failed';
    notify(entry);
  } finally {
    entry.connecting = false;
  }
}

export function acquireWhepStream(
  deviceId: string,
  whepUrl: string,
  quality: StreamQuality,
  listener: Listener,
): { release: () => void; reconnect: () => void } {
  const key = poolKey(deviceId, quality);
  let entry = pool.get(key);

  if (!entry) {
    entry = {
      deviceId,
      whepUrl,
      quality,
      client: new WhepClient({ whepUrl: whepUrlWithQuality(whepUrl, quality) }),
      stream: null,
      connectionState: 'idle',
      error: null,
      refCount: 0,
      listeners: new Set(),
      disconnectTimer: null,
      connecting: false,
    };
    pool.set(key, entry);
    void connectEntry(entry);
  } else if (entry.whepUrl !== whepUrl) {
    entry.whepUrl = whepUrl;
    void connectEntry(entry);
  }

  if (entry.disconnectTimer) {
    clearTimeout(entry.disconnectTimer);
    entry.disconnectTimer = null;
  }

  entry.refCount += 1;
  entry.listeners.add(listener);
  listener(snapshot(entry));

  const release = () => {
    const e = pool.get(key);
    if (!e) return;
    e.refCount -= 1;
    e.listeners.delete(listener);
    if (e.refCount <= 0) {
      e.disconnectTimer = setTimeout(() => {
        const current = pool.get(key);
        if (!current || current.refCount > 0) return;
        void current.client.disconnect();
        pool.delete(key);
      }, DISCONNECT_GRACE_MS);
    }
  };

  const reconnect = () => {
    const e = pool.get(key);
    if (e) void connectEntry(e);
  };

  return { release, reconnect };
}

export function reconnectWhepPoolDevice(deviceId: string) {
  for (const entry of pool.values()) {
    if (entry.deviceId === deviceId) void connectEntry(entry);
  }
}

export function releaseAllWhepPool() {
  for (const [key, entry] of pool) {
    if (entry.disconnectTimer) clearTimeout(entry.disconnectTimer);
    void entry.client.disconnect();
    pool.delete(key);
  }
}
