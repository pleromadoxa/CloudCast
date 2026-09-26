#!/usr/bin/env node
/**
 * Run the CloudCast broadcast relay behind its Cloudflare Tunnel.
 * Starts the FFmpeg WebSocket relay on localhost and the cloudflared connector,
 * so the deployed site can reach it over wss://relay.<domain>.
 *
 * Run: npm run relay:serve   (after `npm run relay:setup`)
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const tunnelToken = process.env.RELAY_TUNNEL_TOKEN?.trim();
if (!tunnelToken) {
  console.error('RELAY_TUNNEL_TOKEN missing. Run `npm run relay:setup` first.');
  process.exit(1);
}
if (!process.env.RELAY_TOKEN?.trim()) {
  console.error('RELAY_TOKEN missing. Run `npm run relay:setup` first.');
  process.exit(1);
}

const children = new Set();
let shuttingDown = false;

const RESTART_BASE_MS = 1_000;
const RESTART_MAX_MS = 15_000;

// Keep the relay and tunnel alive across crashes/network blips — restart with backoff
// instead of taking the whole stream down. This is what keeps broadcasts smooth and
// self-healing even on bad internet.
function start(name, cmd, args, extraEnv = {}) {
  let backoff = RESTART_BASE_MS;

  const launch = () => {
    const proc = spawn(cmd, args, {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, ...extraEnv },
    });
    children.add(proc);

    // A clean run for a while resets the backoff.
    const healthyTimer = setTimeout(() => {
      backoff = RESTART_BASE_MS;
    }, 30_000);

    proc.on('exit', (code) => {
      clearTimeout(healthyTimer);
      children.delete(proc);
      if (shuttingDown) return;
      const delay = Math.min(RESTART_MAX_MS, backoff);
      backoff = Math.min(RESTART_MAX_MS, backoff * 2);
      console.error(`[${name}] exited (${code}). Restarting in ${Math.round(delay / 1000)}s…`);
      setTimeout(() => {
        if (!shuttingDown) launch();
      }, delay);
    });

    proc.on('error', (err) => {
      console.error(`[${name}] failed to start:`, err?.message ?? err);
    });

    return proc;
  };

  return launch();
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const proc of children) {
    try {
      proc.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(code), 500);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('CloudCast relay + Cloudflare Tunnel\n');

// Relay listens locally; the tunnel publishes it over wss.
start('relay', process.execPath, [join(__dirname, 'server.mjs')], {
  RELAY_HOST: '127.0.0.1',
  NODE_ENV: 'production',
});

start('cloudflared', process.env.CLOUDFLARED_PATH?.trim() || 'cloudflared', [
  'tunnel',
  '--no-autoupdate',
  'run',
  '--token',
  tunnelToken,
]);

console.log('Relay running. Press Ctrl+C to stop.\n');
