#!/usr/bin/env node
/**
 * One-shot Cloudflare setup for CloudCast.
 * Run: npm run setup:cloudflare
 *
 * Steps: R2 bucket + CORS
 */
import { execSync } from 'node:child_process';

function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
    return true;
  } catch {
    console.warn(`⚠ Skipped: ${label}`);
    return false;
  }
}

console.log('CloudCast — Cloudflare setup\n');

run('npm run setup:r2', 'R2 bucket + CORS');

console.log(`
Next steps:
  1. Enable R2 if not already: https://dash.cloudflare.com/?to=/:account/r2
  2. Point cloudcast.pro DNS to Cloudflare (orange cloud / proxied)
  3. Deploy frontend: npm run deploy:pages
  4. Deploy backend:  npm run deploy:cloudflare  (R2 + Stream edge functions)
  5. Attach custom domain: npm run setup:dns

Free features in use: R2, Workers static assets, CDN cache, DDoS protection, SSL.
`);
