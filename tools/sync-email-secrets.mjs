#!/usr/bin/env node
/**
 * Push transactional email secrets from .env + linked Supabase DB to edge functions.
 * Run: npm run secrets:email
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fetchDbSetting } from './supabase-db-settings.mjs';

function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        process.env[m[1].trim()] = v;
      }
    }
  }
}

loadEnv();

const appPublicUrl = (() => {
  if (process.env.APP_PUBLIC_URL?.trim()) return process.env.APP_PUBLIC_URL.trim();
  const domain = process.env.CLOUDCAST_DOMAIN?.trim();
  if (domain) return `https://${domain.replace(/^https?:\/\//, '')}`;
  return 'https://cloudcast.pleromadoxa.workers.dev';
})();

const fromEmail =
  process.env.FROM_EMAIL?.trim() || 'CloudCast by Quantum Regal <notifications@cloudcast.regal>';

const webhookSecret =
  process.env.EMAIL_WEBHOOK_SECRET?.trim() || fetchDbSetting('email_webhook_secret');

const pairs = {
  APP_PUBLIC_URL: appPublicUrl,
  FROM_EMAIL: fromEmail,
};

if (webhookSecret) {
  pairs.EMAIL_WEBHOOK_SECRET = webhookSecret;
} else {
  console.warn('⚠ EMAIL_WEBHOOK_SECRET not found in .env or database.');
}

const resendKey = process.env.RESEND_API_KEY?.trim();
if (resendKey) {
  pairs.RESEND_API_KEY = resendKey;
} else {
  console.warn(
    '⚠ RESEND_API_KEY missing — emails queue but will not send until you add it to .env and re-run npm run secrets:email',
  );
  console.warn('  Create a key at https://resend.com/api-keys and verify your sending domain.');
}

const args = ['secrets', 'set', ...Object.entries(pairs).flatMap(([k, v]) => [`${k}=${v}`])];
const result = spawnSync('supabase', args, { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);

console.log('Supabase email secrets updated.');
if (!resendKey) {
  console.warn('⚠ Add RESEND_API_KEY to .env for live email delivery.');
}
