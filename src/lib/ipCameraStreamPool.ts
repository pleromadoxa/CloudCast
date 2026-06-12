import Hls from 'hls.js';
import { detectIpStreamKind } from './ipCameraUrl';
import type { IpCameraConnectionState } from '../types/ipCamera';

export interface IpCameraPoolSnapshot {
  stream: MediaStream | null;
  connectionState: IpCameraConnectionState;
  error: string | null;
}

type Listener = (snap: IpCameraPoolSnapshot) => void;

interface Entry {
  url: string;
  video: HTMLVideoElement;
  hls: Hls | null;
  stream: MediaStream | null;
  connectionState: IpCameraConnectionState;
  error: string | null;
  refCount: number;
  listeners: Set<Listener>;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
  cleanupListeners: (() => void) | null;
}

const DISCONNECT_GRACE_MS = 1500;
const pool = new Map<string, Entry>();

function snapshot(entry: Entry): IpCameraPoolSnapshot {
  return {
    stream: entry.stream,
    connectionState: entry.connectionState,
    error: entry.error,
  };
}

function notify(entry: Entry) {
  entry.listeners.forEach((fn) => fn(snapshot(entry)));
}

function cleanupEntry(entry: Entry) {
  entry.cleanupListeners?.();
  entry.cleanupListeners = null;
  entry.hls?.destroy();
  entry.hls = null;
  entry.video.pause();
  entry.video.removeAttribute('src');
  entry.video.load();
  entry.stream = null;
}

function attachStream(entry: Entry) {
  const videoEl = entry.video as HTMLVideoElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  const mediaStream = videoEl.captureStream?.() ?? videoEl.mozCaptureStream?.();
  if (mediaStream) {
    entry.stream = mediaStream;
    entry.connectionState = 'connected';
    notify(entry);
  }
}

function connectEntry(entry: Entry) {
  const url = entry.url.trim();
  if (!url) return;

  const kind = detectIpStreamKind(url);
  if (kind === 'whep' || kind === 'unsupported') {
    entry.connectionState = 'idle';
    entry.error = null;
    notify(entry);
    return;
  }

  cleanupEntry(entry);
  entry.connectionState = 'connecting';
  entry.error = null;
  notify(entry);

  const onVideoReady = () => {
    void entry.video.play().then(() => attachStream(entry)).catch(() => {
      entry.error = 'Browser blocked autoplay for this stream.';
      entry.connectionState = 'failed';
      notify(entry);
    });
  };

  const onVideoError = () => {
    entry.error = 'Could not load IP camera stream. Check the URL and CORS settings.';
    entry.connectionState = 'failed';
    notify(entry);
  };

  entry.video.addEventListener('loadedmetadata', onVideoReady);
  entry.video.addEventListener('error', onVideoError);
  entry.cleanupListeners = () => {
    entry.video.removeEventListener('loadedmetadata', onVideoReady);
    entry.video.removeEventListener('error', onVideoError);
  };

  if (kind === 'hls') {
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      entry.hls = hls;
      hls.loadSource(url);
      hls.attachMedia(entry.video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => onVideoReady());
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          entry.error = 'HLS stream failed. Verify the .m3u8 URL is reachable.';
          entry.connectionState = 'failed';
          notify(entry);
        }
      });
    } else if (entry.video.canPlayType('application/vnd.apple.mpegurl')) {
      entry.video.src = url;
    } else {
      entry.error = 'HLS is not supported in this browser.';
      entry.connectionState = 'failed';
      notify(entry);
    }
  } else {
    entry.video.src = url;
  }
}

export function acquireIpCameraStream(url: string, listener: Listener): { release: () => void; reconnect: () => void } {
  const key = url.trim();
  let entry = pool.get(key);

  if (!entry) {
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.crossOrigin = 'anonymous';
    entry = {
      url: key,
      video,
      hls: null,
      stream: null,
      connectionState: 'idle',
      error: null,
      refCount: 0,
      listeners: new Set(),
      disconnectTimer: null,
      cleanupListeners: null,
    };
    pool.set(key, entry);
    connectEntry(entry);
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
        cleanupEntry(current);
        pool.delete(key);
      }, DISCONNECT_GRACE_MS);
    }
  };

  const reconnect = () => {
    const e = pool.get(key);
    if (e) connectEntry(e);
  };

  return { release, reconnect };
}

export function releaseAllIpCameraPool() {
  for (const [key, entry] of pool) {
    if (entry.disconnectTimer) clearTimeout(entry.disconnectTimer);
    cleanupEntry(entry);
    pool.delete(key);
  }
}
