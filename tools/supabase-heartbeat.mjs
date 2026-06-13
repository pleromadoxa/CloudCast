#!/usr/bin/env node
/**
 * External Supabase heartbeat for free-tier projects.
 * Run on a schedule when no browsers are open (cron, GitHub Actions, UptimeRobot, etc.).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node tools/supabase-heartbeat.mjs
 *   npm run heartbeat
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

loadEnvFile();

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const source = process.env.HEARTBEAT_SOURCE ?? 'cron';

if (!url || !key) {
  console.error('[heartbeat] Missing SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_* equivalents).');
  process.exit(1);
}

const supabase = createClient(url, key);

const loop = process.argv.includes('--loop');
const intervalHours = Number(process.env.HEARTBEAT_INTERVAL_HOURS ?? 4);
const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;

async function processEmailQueue() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) return true;

  const headers = { 'Content-Type': 'application/json' };
  if (webhookSecret) {
    headers['x-email-webhook-secret'] = webhookSecret;
  } else if (serviceKey) {
    headers.Authorization = `Bearer ${serviceKey}`;
  } else {
    console.warn('[email-queue] skipped — set EMAIL_WEBHOOK_SECRET or SUPABASE_SERVICE_ROLE_KEY');
    return true;
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ process_pending: true }),
    });
    if (!res.ok) {
      console.warn('[email-queue] process failed:', res.status, await res.text());
      return false;
    }
    console.log('[email-queue] processed', await res.json());
    return true;
  } catch (err) {
    console.warn('[email-queue] error:', err instanceof Error ? err.message : err);
    return false;
  }
}

async function runOnce() {
  const { data, error } = await supabase.rpc('cloudcast_heartbeat', { p_source: source });
  if (error) {
    console.error('[heartbeat] failed:', error.message);
    return false;
  }
  console.log('[heartbeat] ok', new Date().toISOString(), JSON.stringify(data));
  await processEmailQueue();
  return true;
}

if (loop) {
  console.log(`[heartbeat] loop mode — every ${intervalHours}h`);
  const tick = async () => {
    await runOnce();
    setTimeout(tick, intervalMs);
  };
  await tick();
} else {
  const ok = await runOnce();
  process.exit(ok ? 0 : 1);
}
