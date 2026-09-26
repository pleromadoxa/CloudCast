#!/usr/bin/env node
/**
 * CloudCast broadcast relay — receives WebM chunks from the dashboard over WebSocket
 * and pushes transcoded FLV to RTMP destinations via FFmpeg.
 *
 * Resilience model (smooth stream even on bad internet):
 *  - The first WebM chunk from MediaRecorder is the init segment (EBML header + Tracks).
 *    We cache it. When the encoder re-keys (adaptive bitrate restart) it sends a new init
 *    segment which we detect and use to re-spawn the FFmpeg outputs cleanly.
 *  - Each destination runs its own FFmpeg, isolated so one flaky platform can't drop the
 *    others. If an FFmpeg exits unexpectedly while live, it is auto-restarted with backoff
 *    and re-primed with the cached init segment so it can resume mid-stream.
 *  - Per-process stdin backlog is capped so a slow RTMP endpoint can't grow memory without
 *    bound; under sustained congestion the oldest data is dropped and FFmpeg recovers at
 *    the next keyframe.
 *
 * Usage: RELAY_PORT=8090 node tools/broadcast-relay/server.mjs
 */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { WebSocketServer } from 'ws';
import { buildPublishUrl } from './rtmpUrl.mjs';

const PORT = Number(process.env.RELAY_PORT ?? 8090);
const HOST = process.env.RELAY_HOST ?? '127.0.0.1';
const RELAY_TOKEN = process.env.RELAY_TOKEN?.trim() || '';
const MAX_DESTINATIONS = Number(process.env.RELAY_MAX_DESTINATIONS ?? 5);
const MAX_CHUNK_BYTES = Number(process.env.RELAY_MAX_CHUNK_BYTES ?? 1024 * 1024);
const MAX_BYTES_PER_SEC = Number(process.env.RELAY_MAX_BYTES_PER_SEC ?? 6 * 1024 * 1024);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
/** Cap of per-FFmpeg stdin backlog before we shed data to bound memory. */
const STDIN_BACKLOG_CAP = Number(process.env.RELAY_STDIN_BACKLOG_CAP ?? 8 * 1024 * 1024);
const FFMPEG_RESTART_BASE_MS = 500;
const FFMPEG_RESTART_MAX_MS = 5_000;

if (IS_PRODUCTION && !RELAY_TOKEN) {
  console.error('[relay] RELAY_TOKEN is required in production.');
  process.exit(1);
}

/** WebM/Matroska files start with the EBML magic. A chunk beginning with it is a fresh header. */
function isInitSegment(buf) {
  return (
    buf.length >= 4 &&
    buf[0] === 0x1a &&
    buf[1] === 0x45 &&
    buf[2] === 0xdf &&
    buf[3] === 0xa3
  );
}

function spawnFfmpeg(publishUrl, name) {
  const args = [
    '-hide_banner',
    '-loglevel',
    'warning',
    // Input resilience: tolerate timestamp gaps and partial data after a mid-stream join.
    '-thread_queue_size',
    '1024',
    '-fflags',
    '+genpts+nobuffer+igndts',
    '-err_detect',
    'ignore_err',
    '-f',
    'webm',
    '-i',
    'pipe:0',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-tune',
    'zerolatency',
    '-profile:v',
    'main',
    '-pix_fmt',
    'yuv420p',
    // Constant bitrate-ish output keeps RTMP pacing steady for the viewer.
    '-b:v',
    '2500k',
    '-maxrate',
    '2500k',
    '-bufsize',
    '5000k',
    '-g',
    '60',
    '-keyint_min',
    '60',
    '-sc_threshold',
    '0',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ar',
    '48000',
    '-max_muxing_queue_size',
    '1024',
    '-f',
    'flv',
    '-flvflags',
    'no_duration_filesize',
    publishUrl,
  ];

  const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  proc.stdin.on('error', () => {
    /* EPIPE when FFmpeg exits — handled via the exit event */
  });
  proc.stderr.on('data', (buf) => {
    const line = buf.toString().trim();
    if (line) console.error(`[ffmpeg:${name ?? publishUrl}]`, line);
  });
  return proc;
}

/** Spawn a supervised FFmpeg for one destination, with auto-restart + header re-priming. */
function spawnDestination(session, dest) {
  const proc = spawnFfmpeg(dest.publishUrl, dest.name);
  const entry = { proc, dest, alive: true, intentionalStop: false, backoff: FFMPEG_RESTART_BASE_MS };

  // Re-prime a (re)started FFmpeg with the cached init segment so it can parse the stream.
  if (session.initSegment) {
    try {
      proc.stdin.write(session.initSegment);
    } catch {
      /* ignore */
    }
  }

  proc.on('exit', (code) => {
    entry.alive = false;
    if (entry.intentionalStop || session.stopping || !session.ready) return;
    if (code && code !== 255) {
      console.error(`[relay] ffmpeg for "${dest.name ?? dest.publishUrl}" exited ${code} — restarting`);
    }
    const delay = Math.min(FFMPEG_RESTART_MAX_MS, entry.backoff);
    setTimeout(() => {
      if (entry.intentionalStop || session.stopping || !session.ready) return;
      const idx = session.procs.indexOf(entry);
      if (idx >= 0) session.procs.splice(idx, 1);
      const next = spawnDestination(session, dest);
      next.backoff = Math.min(FFMPEG_RESTART_MAX_MS, entry.backoff * 2);
      session.procs.push(next);
    }, delay);
  });

  return entry;
}

function stopEntry(entry) {
  entry.intentionalStop = true;
  entry.alive = false;
  try {
    entry.proc.stdin.end();
  } catch {
    /* ignore */
  }
  try {
    entry.proc.kill('SIGTERM');
  } catch {
    /* ignore */
  }
}

/** (Re)start all destination FFmpegs — used on first header and on encoder re-key. */
function restartDestinations(session) {
  for (const entry of session.procs) stopEntry(entry);
  session.procs = [];
  if (!session.ready || session.stopping) return;
  for (const dest of session.destinations) {
    session.procs.push(spawnDestination(session, dest));
  }
}

function writeToDestinations(session, data) {
  for (const entry of session.procs) {
    if (!entry.alive) continue;
    const { stdin } = entry.proc;
    if (!stdin.writable) continue;
    // Shed data if this output's backlog is too deep (slow RTMP) to bound memory.
    if (stdin.writableLength > STDIN_BACKLOG_CAP) continue;
    try {
      stdin.write(data);
    } catch {
      /* stdin closed mid-write — exit handler will restart */
    }
  }
}

function stopSession(session) {
  session.stopping = true;
  for (const entry of session.procs) stopEntry(entry);
  session.procs = [];
  session.ready = false;
  session.initSegment = null;
  session.bytesThisSecond = 0;
  session.stopping = false;
}

const server = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('CloudCast broadcast relay');
});

server.on('error', (err) => {
  console.error('[relay] listen error:', err?.message ?? err);
  process.exit(1);
});
const wss = new WebSocketServer({ server, maxPayload: MAX_CHUNK_BYTES });

// Never let a socket-level error (oversized frame, abrupt reset, protocol violation) crash
// the relay process — log it and let the per-connection cleanup run.
wss.on('error', (err) => {
  console.error('[relay] server socket error:', err?.message ?? err);
});

let activeConnections = 0;
const MAX_CONNECTIONS = Number(process.env.RELAY_MAX_CONNECTIONS ?? 20);

setInterval(() => {
  for (const client of wss.clients) {
    if (client._relaySession) client._relaySession.bytesThisSecond = 0;
  }
}, 1000);

wss.on('connection', (ws) => {
  if (activeConnections >= MAX_CONNECTIONS) {
    ws.send(JSON.stringify({ type: 'error', message: 'Relay at capacity. Try again shortly.' }));
    ws.close();
    return;
  }

  activeConnections += 1;
  const session = {
    destinations: [],
    procs: [],
    ready: false,
    stopping: false,
    initSegment: null,
    bytesThisSecond: 0,
  };
  ws._relaySession = session;

  ws.on('error', (err) => {
    console.error('[relay] connection error:', err?.message ?? err);
    stopSession(session);
  });

  ws.on('message', (data, isBinary) => {
    if (!isBinary) {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message.' }));
        return;
      }

      if (msg.type === 'start') {
        if (RELAY_TOKEN && msg.token !== RELAY_TOKEN) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid relay token.' }));
          ws.close();
          return;
        }

        stopSession(session);

        const destinations = Array.isArray(msg.destinations) ? msg.destinations : [];
        if (destinations.length === 0) {
          ws.send(JSON.stringify({ type: 'error', message: 'No destinations provided.' }));
          return;
        }
        if (destinations.length > MAX_DESTINATIONS) {
          ws.send(JSON.stringify({ type: 'error', message: `Maximum ${MAX_DESTINATIONS} destinations per session.` }));
          return;
        }

        try {
          session.destinations = destinations.map((dest) => ({
            publishUrl: buildPublishUrl(dest.streamUrl, dest.streamKey),
            name: dest.name,
          }));
          session.ready = true;
          // FFmpeg starts when the first WebM header arrives (see binary handler).
          ws.send(JSON.stringify({ type: 'ready', destinations: destinations.length }));
          console.log(`[relay] armed ${destinations.length} RTMP output(s) — waiting for stream`);
        } catch (e) {
          stopSession(session);
          ws.send(
            JSON.stringify({
              type: 'error',
              message: e instanceof Error ? e.message : 'Failed to start FFmpeg.',
            }),
          );
        }
        return;
      }

      if (msg.type === 'stop') {
        stopSession(session);
        ws.send(JSON.stringify({ type: 'stopped' }));
        console.log('[relay] stopped');
      }
      return;
    }

    if (!session.ready) return;

    const size = data.byteLength ?? data.length ?? 0;
    if (size > MAX_CHUNK_BYTES) {
      ws.send(JSON.stringify({ type: 'error', message: 'Chunk too large.' }));
      ws.close();
      stopSession(session);
      return;
    }

    session.bytesThisSecond += size;
    if (session.bytesThisSecond > MAX_BYTES_PER_SEC) {
      ws.send(JSON.stringify({ type: 'error', message: 'Bitrate limit exceeded.' }));
      ws.close();
      stopSession(session);
      return;
    }

    // A WebM header chunk means the encoder (re)started — cache it and (re)key FFmpeg.
    if (isInitSegment(data)) {
      session.initSegment = Buffer.from(data);
      restartDestinations(session);
      return;
    }

    // Media data only flows once we have a header and outputs are running.
    if (!session.initSegment) return;
    if (session.procs.length === 0) restartDestinations(session);
    writeToDestinations(session, data);
  });

  ws.on('close', () => {
    stopSession(session);
    activeConnections = Math.max(0, activeConnections - 1);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`CloudCast broadcast relay listening on ws://${HOST}:${PORT}`);
  console.log('Set VITE_BROADCAST_RELAY_WS=ws://' + HOST + ':' + PORT);
  if (!RELAY_TOKEN) console.log('Tip: set RELAY_TOKEN for production auth.');
});
