#!/usr/bin/env node
/**
 * Check cloudcast.pro DNS / Workers custom domain status.
 * Reads CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID from .env.
 * Run: npm run setup:dns
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const APEX = 'cloudcast.pro';
const WWW = 'www.cloudcast.pro';
const WORKER_NAME = 'cloudcast';

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

async function cfRequest(method, path, body) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function cfGet(path) {
  const { data } = await cfRequest('GET', path);
  if (!data.success) {
    const msg = data.errors?.[0]?.message ?? JSON.stringify(data.errors);
    throw new Error(msg);
  }
  return data.result;
}

function dig(name, type) {
  try {
    return execSync(`dig ${name} ${type} +short 2>/dev/null`, { encoding: 'utf8' })
      .split('\n')
      .map((l) => l.trim().replace(/\.$/, ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function printManualDnsFix({ apexA, wwwCnamePages }) {
  console.log(`
━━━ Manual DNS cleanup (Cloudflare → cloudcast.pro → DNS) ━━━

The app runs on the "cloudcast" Worker — not Pages. Conflicting records block attach:

${apexA.length ? `  • DELETE A record(s) for @ (${APEX}): ${apexA.join(', ')}` : ''}
${wwwCnamePages ? `  • DELETE CNAME www → cloudcast.pages.dev (causes Error 522)` : ''}

After deleting those records:
  1. npm run setup:dns     (reattach Worker custom domains)
  2. npm run deploy:pages  (sync DNS records + deploy)

API token tip: add Zone → DNS → Edit and Workers Routes → Edit so deploy scripts
can manage DNS and custom domains automatically.
`);
}

async function attachWorkerDomain(accountId, hostname) {
  const { data } = await cfRequest('PUT', `/accounts/${accountId}/workers/domains`, {
    hostname,
    service: WORKER_NAME,
    environment: 'production',
  });
  if (data.success) {
    console.log(`✓ Attached ${hostname} → ${WORKER_NAME} Worker`);
    return true;
  }
  const msg = data.errors?.[0]?.message ?? 'unknown error';
  console.log(`✗ Could not attach ${hostname}: ${msg}`);
  return false;
}

async function main() {
  loadEnv();

  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();

  console.log('CloudCast — DNS / custom domain status\n');

  const apexA = dig(APEX, 'A');
  const wwwCname = dig(WWW, 'CNAME');
  const wwwCnamePages = wwwCname.some((c) => c.includes('pages.dev'));

  console.log('Public DNS:');
  console.log(`  ${APEX} A: ${apexA.length ? apexA.join(', ') : '(none)'}`);
  console.log(`  ${WWW} CNAME: ${wwwCname.length ? wwwCname.join(', ') : '(none)'}`);
  if (wwwCnamePages) console.log('  ⚠ www still points at Pages → Error 522 until removed');

  if (!token || !accountId) {
    console.warn('\nCLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID not set.');
    printManualDnsFix({ apexA, wwwCnamePages });
    process.exit(0);
  }

  const zones = await cfGet(`/zones?name=${APEX}`);
  const zone = zones?.[0];

  if (zone) {
    console.log(`\nZone "${APEX}": ${zone.status} (id ${zone.id})`);
    if (zone.account?.id && zone.account.id !== accountId) {
      console.log(`⚠ Zone is on account ${zone.account.id}, deploy uses ${accountId}.`);
    } else {
      console.log('✓ Zone reachable with your API token');
    }
  } else {
    console.log(`\n⚠ Zone "${APEX}" not found with this API token.`);
  }

  const workerDomains = await cfGet(`/accounts/${accountId}/workers/domains`);
  const attached = new Set(
    (workerDomains ?? [])
      .filter((d) => d.hostname === APEX || d.hostname === WWW)
      .map((d) => d.hostname),
  );

  console.log('\nWorker custom domains:');
  if (attached.size) {
    for (const h of attached) console.log(`  • ${h} → ${WORKER_NAME}`);
  } else {
    console.log('  (none yet)');
  }

  const needsAttach = [APEX, WWW].filter((h) => !attached.has(h));
  if (needsAttach.length && (apexA.length || wwwCnamePages)) {
    printManualDnsFix({ apexA, wwwCnamePages });
    process.exit(0);
  }

  for (const hostname of needsAttach) {
    await attachWorkerDomain(accountId, hostname);
  }

  if (!needsAttach.length) {
    console.log(`\n✓ Both ${APEX} and ${WWW} are attached to the Worker.`);
    console.log('  Run: npm run deploy:pages');
  } else {
    console.log('\nThen run: npm run deploy:pages');
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
