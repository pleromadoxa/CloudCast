#!/usr/bin/env node
/**
 * Sync Stripe secrets from .env to Supabase edge functions.
 * Run: npm run secrets:stripe
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

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

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!secretKey) {
  console.warn('⚠ STRIPE_SECRET_KEY missing — run npm run setup:stripe after adding your key to .env');
  process.exit(0);
}

const pairs = {
  STRIPE_SECRET_KEY: secretKey,
};

const priceKeys = [
  'STRIPE_PRICE_video_mixer_pro',
  'STRIPE_PRICE_video_mixer_pro_master',
  'STRIPE_PRICE_audio_mixer_pro',
  'STRIPE_PRICE_audio_mixer_pro_master',
  'STRIPE_PRICE_symphony_studio_pro',
  'STRIPE_PRICE_symphony_studio_pro_master',
  'STRIPE_PRICE_regal_prism_pro',
  'STRIPE_PRICE_regal_prism_pro_master',
  'STRIPE_PRICE_universal_universal_essential',
  'STRIPE_PRICE_universal_universal_studio',
  'STRIPE_PRICE_universal_universal',
];

for (const key of priceKeys) {
  const v = process.env[key]?.trim();
  if (v) pairs[key] = v;
}

const webhook = process.env.STRIPE_WEBHOOK_SECRET?.trim();
if (webhook) pairs.STRIPE_WEBHOOK_SECRET = webhook;

const appUrl = process.env.APP_PUBLIC_URL?.trim();
if (appUrl) pairs.APP_PUBLIC_URL = appUrl;

const args = ['secrets', 'set', ...Object.entries(pairs).flatMap(([k, v]) => [`${k}=${v}`])];
const result = spawnSync('supabase', args, { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);

console.log('Supabase Stripe secrets updated.');
if (!webhook) {
  console.warn('⚠ STRIPE_WEBHOOK_SECRET not set — webhooks will fail until configured.');
}
