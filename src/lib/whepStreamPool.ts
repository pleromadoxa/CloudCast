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
  retryTimer: ReturnType<typeof setTimeout> | null;
  connecting: boolean;
  retryCount: number;
}

const DISCONNECT_GRACE_MS = 1500;
const MAX_RETRIES = 10;
const BASE_RETRY_MS = 1200;
const MAX_RETRY_MS = 30_000;

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

function clearRetry(entry: Entry) {
  if (entry.retryTimer) {
    clearTimeout(entry.retryTimer);
    entry.retryTimer = null;
  }
}

function scheduleRetry(entry: Entry) {
  if (entry.refCount <= 0 || entry.retryCount >= MAX_RETRIES) return;
  clearRetry(entry);
  const delay = Math.min(BASE_RETRY_MS * 2 ** entry.retryCount, MAX_RETRY_MS);
  entry.retryCount += 1;
  entry.connectionState = 'reconnecting';
  notify(entry);
  entry.retryTimer = setTimeout(() => {
    entry.retryTimer = null;
    void connectEntry(entry);
  }, delay);
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
        if ((state === 'disconnected' || state === 'failed') && entry.refCount > 0) {
          scheduleRetry(entry);
        }
      },
      onTrack: (stream) => {
        entry.stream = stream;
        notify(entry);
      },
    });
    const mediaStream = await entry.client.connect();
    entry.stream = mediaStream;
    entry.retryCount = 0;
    clearRetry(entry);
    notify(entry);
  } catch (err) {
    entry.error = err instanceof Error ? err.message : 'Stream connection failed';
    entry.connectionState = 'failed';
    notify(entry);
    scheduleRetry(entry);
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
      retryTimer: null,
      connecting: false,
      retryCount: 0,
    };
    pool.set(key, entry);
    void connectEntry(entry);
  } else if (entry.whepUrl !== whepUrl) {
    entry.whepUrl = whepUrl;
    entry.retryCount = 0;
    clearRetry(entry);
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
      clearRetry(e);
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
    if (!e) return;
    e.retryCount = 0;
    clearRetry(e);
    void connectEntry(e);
  };

  return { release, reconnect };
}

export function reconnectWhepPoolDevice(deviceId: string) {
  for (const entry of pool.values()) {
    if (entry.deviceId === deviceId) {
      entry.retryCount = 0;
      clearRetry(entry);
      void connectEntry(entry);
    }
  }
}

/** Read-only WHEP pool state for diagnostics (does not acquire a listener). */
export function peekWhepPoolSnapshot(
  deviceId: string,
  quality: StreamQuality = 'auto',
): WhepPoolSnapshot | null {
  const entry = pool.get(poolKey(deviceId, quality));
  return entry ? snapshot(entry) : null;
}

export function releaseAllWhepPool() {
  for (const [key, entry] of pool) {
    if (entry.disconnectTimer) clearTimeout(entry.disconnectTimer);
    clearRetry(entry);
    void entry.client.disconnect();
    pool.delete(key);
  }
}
