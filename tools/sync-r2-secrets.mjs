#!/usr/bin/env node
/**
 * Push R2 / Cloudflare secrets from .env to linked Supabase project.
 * Run: npm run secrets:r2
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

function required(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name} in .env`);
  return v;
}

loadEnv();

const accountId =
  process.env.R2_ACCOUNT_ID?.trim() ||
  process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
if (!accountId) throw new Error('Missing R2_ACCOUNT_ID or CLOUDFLARE_ACCOUNT_ID in .env');

const pairs = {
  R2_ACCOUNT_ID: accountId,
  CLOUDFLARE_ACCOUNT_ID: accountId,
  R2_ACCESS_KEY_ID: required('R2_ACCESS_KEY_ID'),
  R2_SECRET_ACCESS_KEY: required('R2_SECRET_ACCESS_KEY'),
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME?.trim() || 'cloudcast-recordings',
};
const cfToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
if (cfToken) pairs.CLOUDFLARE_API_TOKEN = cfToken;

const args = ['secrets', 'set', ...Object.entries(pairs).flatMap(([k, v]) => [`${k}=${v}`])];
const result = spawnSync('supabase', args, { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log('Supabase R2 secrets updated.');
