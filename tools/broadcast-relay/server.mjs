#!/usr/bin/env node
/**
 * CloudCast broadcast relay — receives WebM chunks from the dashboard over WebSocket
 * and pushes transcoded FLV to RTMP destinations via FFmpeg.
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
const MAX_CHUNK_BYTES = Number(process.env.RELAY_MAX_CHUNK_BYTES ?? 256 * 1024);
const MAX_BYTES_PER_SEC = Number(process.env.RELAY_MAX_BYTES_PER_SEC ?? 4 * 1024 * 1024);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (IS_PRODUCTION && !RELAY_TOKEN) {
  console.error('[relay] RELAY_TOKEN is required in production.');
  process.exit(1);
}

function spawnFfmpeg(publishUrl, name) {
  const args = [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-fflags',
    'nobuffer',
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
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ar',
    '48000',
    '-f',
    'flv',
    publishUrl,
  ];

  const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  proc.stderr.on('data', (buf) => {
    const line = buf.toString().trim();
    if (line) console.error(`[ffmpeg:${name ?? publishUrl}]`, line);
  });
  proc.on('exit', (code) => {
    if (code && code !== 255) console.error(`[ffmpeg:${name ?? publishUrl}] exited ${code}`);
  });
  return proc;
}

function stopSession(session) {
  for (const proc of session.procs) {
    try {
      proc.stdin.end();
    } catch {
      /* ignore */
    }
    proc.kill('SIGTERM');
  }
  session.procs = [];
  session.ready = false;
  session.bytesThisSecond = 0;
}

const server = createServer();
const wss = new WebSocketServer({ server, maxPayload: MAX_CHUNK_BYTES });

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
  const session = { procs: [], ready: false, bytesThisSecond: 0 };
  ws._relaySession = session;

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
          for (const dest of destinations) {
            const publishUrl = buildPublishUrl(dest.streamUrl, dest.streamKey);
            session.procs.push(spawnFfmpeg(publishUrl, dest.name));
          }
          session.ready = true;
          ws.send(JSON.stringify({ type: 'ready', destinations: destinations.length }));
          console.log(`[relay] started ${destinations.length} RTMP output(s)`);
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

    for (const proc of session.procs) {
      try {
        if (!proc.stdin.writable) continue;
        const ok = proc.stdin.write(data);
        if (!ok) {
          proc.stdin.once('drain', () => {});
        }
      } catch {
        /* stdin closed */
      }
    }
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
