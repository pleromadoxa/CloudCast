#!/usr/bin/env node
/**
 * Build and deploy CloudCast frontend to Cloudflare Workers (static assets).
 * Run: npm run deploy:pages
 *
 * Requires in .env:
 *   CLOUDFLARE_API_TOKEN (Account → Workers Scripts → Edit)
 *   CLOUDFLARE_ACCOUNT_ID
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (baked in at build time)
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKER_NAME = 'cloudcast';

function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim();
      }
    }
  }
}

function portInUse(port) {
  try {
    const out = execSync(`lsof -ti:${port} 2>/dev/null`, { encoding: 'utf8' }).trim();
    return Boolean(out);
  } catch {
    return false;
  }
}

function ensureDevStopped() {
  if (portInUse(5173) || portInUse(4173)) {
    throw new Error(
      'Stop `npm run dev` / `npm run preview` before deploying — a running dev server can interfere with builds.',
    );
  }
}

function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd(), env: process.env });
}

async function ensurePagesProject(accountId, token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const listRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
    { headers },
  );
  const listData = await listRes.json();
  if (!listData.success) {
    console.warn(
      `⚠ Could not list Pages projects (${listData.errors?.[0]?.message ?? 'auth error'}). ` +
        'Deploy will still run via Workers.',
    );
    return null;
  }
  const existing = listData.result?.find((p) => p.name === WORKER_NAME);
  if (existing) {
    console.log(`Pages project "${WORKER_NAME}" already exists (${existing.subdomain})`);
    return existing;
  }

  console.log(`Creating Pages project "${WORKER_NAME}"...`);
  const createRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: WORKER_NAME,
        production_branch: 'main',
      }),
    },
  );
  const createData = await createRes.json();
  if (!createData.success) {
    console.warn(
      `⚠ Pages project create skipped: ${createData.errors?.[0]?.message ?? 'unknown error'}`,
    );
    return null;
  }
  console.log(`Created Pages project "${WORKER_NAME}"`);
  return createData.result;
}

async function main() {
  loadEnv();
  ensureDevStopped();

  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ||
    process.env.R2_ACCOUNT_ID?.trim();

  if (!token || !accountId) {
    throw new Error('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env');
  }

  if (!process.env.VITE_SUPABASE_URL?.trim() || !process.env.VITE_SUPABASE_ANON_KEY?.trim()) {
    throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  }

  process.env.CLOUDFLARE_ACCOUNT_ID = accountId;

  console.log('CloudCast — Cloudflare frontend deploy\n');

  await ensurePagesProject(accountId, token);

  run('npm run build', 'Vite production build');

  run('npx wrangler deploy', 'Deploy to Cloudflare Workers');

  console.log(`
✓ Frontend deployed.

  Worker URL:  https://cloudcast.<your-subdomain>.workers.dev  (see wrangler output above)
  Production:  https://cloudcast.pro  (after zone is on this Cloudflare account — npm run setup:dns)

  The app runs on the "cloudcast" Worker with SPA routing — not a separate Pages CNAME.
  Backend: npm run deploy:cloudflare  (R2 + Stream edge functions)
`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
