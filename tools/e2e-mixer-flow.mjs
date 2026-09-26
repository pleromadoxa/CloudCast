#!/usr/bin/env node
/**
 * End-to-end checks for Video Mixer: relay, media pipeline helpers, browser URLs.
 * Run: node tools/e2e-mixer-flow.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import WebSocket from 'ws';

function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
    }
  }
}

loadEnv();

const RELAY_WS =
  process.env.VITE_BROADCAST_RELAY_WS?.trim() || 'wss://relay.cloudcast.live';
const RELAY_HTTP = RELAY_WS.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
const RELAY_TOKEN = process.env.VITE_BROADCAST_RELAY_TOKEN?.trim() || '';
const APP_ORIGIN = process.env.E2E_APP_ORIGIN?.trim() || 'https://cloudcast.live';

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function checkRelayHealth() {
  const url = `${RELAY_HTTP}/health`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const body = (await res.text()).trim();
    if (res.ok && body === 'ok') {
      pass('Relay HTTP health', url);
      return true;
    }
    fail('Relay HTTP health', `HTTP ${res.status}: ${body.slice(0, 80)}`);
    return false;
  } catch (e) {
    fail('Relay HTTP health', e instanceof Error ? e.message : String(e));
    return false;
  }
}

function relayWsConnect(url, timeoutMs = 12_000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error('WebSocket connect timed out'));
    }, timeoutMs);

    ws.on('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function waitForJson(ws, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for relay message')), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(data.toString()));
      } catch {
        reject(new Error('Invalid JSON from relay'));
      }
    });
  });
}

/** Minimal WebM/Matroska EBML header prefix — enough for relay init-segment detection. */
function minimalWebMInit() {
  return Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f]);
}

async function checkRelaySession() {
  let ws;
  try {
    ws = await relayWsConnect(RELAY_WS);
    pass('Relay WebSocket connect', RELAY_WS);

    ws.send(
      JSON.stringify({
        type: 'start',
        destinations: [
          {
            streamUrl: 'rtmp://127.0.0.1/live',
            streamKey: 'e2e-probe',
            name: 'e2e-probe',
          },
        ],
        ...(RELAY_TOKEN ? { token: RELAY_TOKEN } : {}),
      }),
    );

    const startMsg = await waitForJson(ws);
    if (startMsg.type === 'ready') {
      pass('Relay start handshake', `${startMsg.destinations} destination(s) armed`);
    } else if (startMsg.type === 'error') {
      if (startMsg.message?.includes('Invalid relay token')) {
        fail('Relay start handshake', 'Invalid token — set VITE_BROADCAST_RELAY_TOKEN in .env');
        return;
      }
      fail('Relay start handshake', startMsg.message ?? JSON.stringify(startMsg));
      return;
    } else {
      fail('Relay start handshake', JSON.stringify(startMsg));
      return;
    }

    ws.send(minimalWebMInit());
    await new Promise((r) => setTimeout(r, 300));

    ws.send(JSON.stringify({ type: 'stop' }));
    const stopMsg = await waitForJson(ws);
    if (stopMsg.type === 'stopped') {
      pass('Relay stop handshake');
    } else {
      fail('Relay stop handshake', JSON.stringify(stopMsg));
    }
  } catch (e) {
    fail('Relay session', e instanceof Error ? e.message : String(e));
  } finally {
    ws?.close();
  }
}

async function checkAppOrigin() {
  try {
    const res = await fetch(APP_ORIGIN, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok || res.status === 304) {
      pass('App origin reachable', APP_ORIGIN);
    } else {
      fail('App origin reachable', `HTTP ${res.status}`);
    }
  } catch (e) {
    fail('App origin reachable', e instanceof Error ? e.message : String(e));
  }
}

async function main() {
  console.log('\nCloudCast Video Mixer — E2E flow checks\n');
  console.log(`Relay: ${RELAY_WS}`);
  console.log(`App:   ${APP_ORIGIN}\n`);

  await checkAppOrigin();
  const healthy = await checkRelayHealth();
  if (healthy) await checkRelaySession();

  console.log('\n--- Vitest (media · browser · audio · go-live) ---\n');
  const { spawnSync } = await import('node:child_process');
  const vitest = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'src/lib/mixerE2eFlow.test.ts'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  if (vitest.status === 0) {
    pass('Vitest mixer E2E flow tests');
  } else {
    fail('Vitest mixer E2E flow tests', `exit ${vitest.status ?? 'unknown'}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.\n`);
  if (failed.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
