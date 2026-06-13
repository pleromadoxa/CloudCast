#!/usr/bin/env node
/**
 * Deploy CloudCast backend + frontend to Cloudflare.
 * Run: npm run deploy
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
}

function runOptional(cmd, label) {
  try {
    run(cmd, label);
    return true;
  } catch {
    console.warn(`⚠ Skipped: ${label}`);
    return false;
  }
}

function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  }
}

console.log('CloudCast — full deploy\n');

runOptional('npm run deploy:cloudflare', 'Supabase edge functions (R2 + Stream + Email)');

loadEnv();
runOptional('npm run email:preview', 'Regenerate email HTML previews');
runOptional('npm run deploy:pages', 'Cloudflare frontend (Vite → Workers)');

console.log('\n✓ Deploy complete.');
