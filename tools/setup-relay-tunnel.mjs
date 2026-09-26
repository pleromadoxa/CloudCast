#!/usr/bin/env node
/**
 * Provision a Cloudflare Tunnel for the CloudCast broadcast relay — no third-party host.
 *
 * Creates (or reuses) a remotely-managed tunnel that maps
 *   wss://relay.<your-domain>  →  http://localhost:8090  (the local FFmpeg relay)
 * adds the proxied DNS record, generates a relay auth token, and wires .env:
 *   VITE_BROADCAST_RELAY_WS, VITE_BROADCAST_RELAY_TOKEN, RELAY_TOKEN, RELAY_TUNNEL_TOKEN
 *
 * Run: npm run relay:setup
 * Requires in .env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDCAST_DOMAIN
 * API token scopes: Account → Cloudflare Tunnel → Edit, Zone → DNS → Edit.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ENV_PATH = join(process.cwd(), '.env');
const TUNNEL_NAME = process.env.RELAY_TUNNEL_NAME ?? 'cloudcast-relay';
const RELAY_SUBDOMAIN = process.env.RELAY_SUBDOMAIN ?? 'relay';
const RELAY_LOCAL_PORT = Number(process.env.RELAY_PORT ?? 8090);

function loadEnv() {
  const env = {};
  for (const file of ['.env', '.env.local']) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    }
  }
  return env;
}

/** Upsert keys into .env, preserving existing lines/comments. */
function updateEnv(updates) {
  let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(content)) {
      content = content.replace(re, line);
    } else {
      content += (content.endsWith('\n') || content === '' ? '' : '\n') + line + '\n';
    }
  }
  writeFileSync(ENV_PATH, content);
}

async function cf(method, path, token, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!data.success) {
    const msg = data.errors?.[0]?.message ?? `HTTP ${res.status}`;
    const code = data.errors?.[0]?.code ? ` (code ${data.errors[0].code})` : '';
    throw new Error(`${method} ${path} failed: ${msg}${code}`);
  }
  return data.result;
}

async function findTunnelByName(accountId, token, name) {
  const list = await cf(
    'GET',
    `/accounts/${accountId}/cfd_tunnel?name=${encodeURIComponent(name)}&is_deleted=false`,
    token,
  );
  return Array.isArray(list) && list.length ? list[0] : null;
}

async function main() {
  const env = { ...loadEnv(), ...process.env };
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const domain = (env.CLOUDCAST_DOMAIN || env.APP_PUBLIC_URL?.replace(/^https?:\/\//, '').replace(/\/$/, ''))?.trim();

  if (!token || !accountId || !domain) {
    console.error('Missing CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID or CLOUDCAST_DOMAIN in .env');
    process.exit(1);
  }

  const hostname = `${RELAY_SUBDOMAIN}.${domain}`;
  console.log(`CloudCast relay tunnel setup\n  hostname: ${hostname}\n  local:    http://127.0.0.1:${RELAY_LOCAL_PORT}\n`);

  // 1. Create or reuse the tunnel.
  let tunnel = await findTunnelByName(accountId, token, TUNNEL_NAME);
  if (tunnel) {
    console.log(`✓ Reusing tunnel "${TUNNEL_NAME}" (${tunnel.id})`);
  } else {
    const tunnelSecret = randomBytes(32).toString('base64');
    tunnel = await cf('POST', `/accounts/${accountId}/cfd_tunnel`, token, {
      name: TUNNEL_NAME,
      tunnel_secret: tunnelSecret,
      config_src: 'cloudflare',
    });
    console.log(`✓ Created tunnel "${TUNNEL_NAME}" (${tunnel.id})`);
  }

  // 2. Fetch the run token (for `cloudflared tunnel run --token`).
  const runToken = await cf('GET', `/accounts/${accountId}/cfd_tunnel/${tunnel.id}/token`, token);

  // 3. Configure ingress: hostname → local relay, with a catch-all.
  await cf('PUT', `/accounts/${accountId}/cfd_tunnel/${tunnel.id}/configurations`, token, {
    config: {
      ingress: [
        { hostname, service: `http://127.0.0.1:${RELAY_LOCAL_PORT}` },
        { service: 'http_status:404' },
      ],
    },
  });
  console.log('✓ Tunnel ingress configured');

  // 4. DNS CNAME relay.<domain> → <tunnel>.cfargotunnel.com (proxied).
  const cnameTarget = `${tunnel.id}.cfargotunnel.com`;
  let dnsManual = false;
  try {
    const zones = await cf('GET', `/zones?name=${encodeURIComponent(domain)}`, token);
    const zone = zones?.[0];
    if (!zone) throw new Error(`Zone "${domain}" not found with this API token.`);

    const existing = await cf(
      'GET',
      `/zones/${zone.id}/dns_records?type=CNAME&name=${encodeURIComponent(hostname)}`,
      token,
    );
    if (existing?.length) {
      await cf('PUT', `/zones/${zone.id}/dns_records/${existing[0].id}`, token, {
        type: 'CNAME',
        name: hostname,
        content: cnameTarget,
        proxied: true,
      });
      console.log('✓ Updated DNS record');
    } else {
      await cf('POST', `/zones/${zone.id}/dns_records`, token, {
        type: 'CNAME',
        name: hostname,
        content: cnameTarget,
        proxied: true,
      });
      console.log('✓ Created DNS record');
    }
  } catch (dnsErr) {
    dnsManual = true;
    console.log(`⚠ Could not write DNS automatically (${dnsErr.message}).`);
    console.log('  Add this record manually in Cloudflare → DNS:');
    console.log(`    Type: CNAME   Name: ${RELAY_SUBDOMAIN}   Target: ${cnameTarget}   Proxy: ON (orange cloud)`);
  }

  // 5. Relay auth token (reuse existing if present).
  const relayToken = env.RELAY_TOKEN?.trim() || randomBytes(24).toString('hex');

  // 6. Wire .env.
  updateEnv({
    VITE_BROADCAST_RELAY_WS: `wss://${hostname}`,
    VITE_BROADCAST_RELAY_TOKEN: relayToken,
    RELAY_TOKEN: relayToken,
    RELAY_TUNNEL_TOKEN: runToken,
  });
  console.log('✓ Updated .env (VITE_BROADCAST_RELAY_WS, VITE_BROADCAST_RELAY_TOKEN, RELAY_TOKEN, RELAY_TUNNEL_TOKEN)');

  console.log(`
Next steps:${
    dnsManual
      ? `\n  0. Add the CNAME above (relay → ${cnameTarget}, proxied) in Cloudflare DNS first.`
      : ''
  }
  1. Production (always-on): deploy the relay container to a small VPS — see tools/broadcast-relay/docker-compose.yml
     docker compose -f tools/broadcast-relay/docker-compose.yml up -d --build
  2. Local dev:               npm run relay:serve
  3. Rebuild & redeploy app:  npm run deploy:pages
     (VITE_BROADCAST_RELAY_WS is baked in at build time — must match wss://${hostname})

The relay cannot run on Cloudflare Pages/Workers (FFmpeg + long-lived WebSockets).
Pages serves the dashboard; a VPS/container keeps wss://${hostname} online 24/7.
`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message ?? err}`);
  if (/code 1000|Authentication|not authorized|forbidden|HTTP 403/i.test(String(err.message))) {
    console.error(
      'Your CLOUDFLARE_API_TOKEN likely lacks scopes. Add:\n' +
        '  • Account → Cloudflare Tunnel → Edit\n' +
        '  • Zone → DNS → Edit (for your domain)\n',
    );
  }
  process.exit(1);
});
