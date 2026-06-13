#!/usr/bin/env node
/**
 * Verify Cloudflare Stream API access for Regal Cloud (WHIP/WHEP ingest).
 * Run: npm run verify:stream
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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

const accountId =
  process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
  process.env.R2_ACCOUNT_ID?.trim();
const token = process.env.CLOUDFLARE_API_TOKEN?.trim();

if (!accountId || !token) {
  console.error('Missing CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID) and CLOUDFLARE_API_TOKEN in .env');
  process.exit(1);
}

const listRes = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
  { headers: { Authorization: `Bearer ${token}` } },
);
const listJson = await listRes.json();

if (listRes.status === 403 || !listJson.success) {
  const msg = listJson.errors?.[0]?.message ?? `HTTP ${listRes.status}`;
  console.error('Regal Cloud Stream check failed:', msg);
  console.error('');
  console.error('Your CLOUDFLARE_API_TOKEN cannot access Cloudflare Stream.');
  console.error('Create a new token at https://dash.cloudflare.com/profile/api-tokens with:');
  console.error('  - Account → Stream → Edit');
  console.error('  - Account Resources → Include → your account');
  console.error('');
  console.error('Then update .env, run: npm run secrets:r2 && npm run deploy:stream');
  process.exit(1);
}

const createRes = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ meta: { probe: 'cloudcast-verify' }, recording: { mode: 'off' } }),
  },
);
const createJson = await createRes.json();

if (!createJson.success) {
  console.error('Stream live input creation failed:', createJson.errors?.[0]?.message ?? createRes.status);
  process.exit(1);
}

const uid = createJson.result?.uid;
if (uid) {
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs/${uid}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );
}

console.log('Regal Cloud Stream OK — token can create live inputs (WHIP/WHEP).');
console.log('Sync to Supabase: npm run secrets:r2 && npm run deploy:stream');
