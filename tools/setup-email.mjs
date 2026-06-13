#!/usr/bin/env node
/**
 * One-shot transactional email production setup.
 * Run: npm run setup:email
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';
import { fetchDbSetting } from './supabase-db-settings.mjs';

const PROJECT_REF = 'ixjydnkpnyxnckhkqhue';

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

function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
}

function tryRun(cmd, label) {
  try {
    run(cmd, label);
    return true;
  } catch {
    console.warn(`⚠ Skipped: ${label}`);
    return false;
  }
}

function getApiKeys() {
  const result = spawnSync(
    'supabase',
    ['projects', 'api-keys', '--project-ref', PROJECT_REF, '-o', 'json'],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) return [];
  try {
    const parsed = JSON.parse(result.stdout);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.keys)) return parsed.keys;
    return [];
  } catch {
    return [];
  }
}

function setGhSecret(name, value) {
  if (!value) return false;
  const r = spawnSync('gh', ['secret', 'set', name, '--body', value], { stdio: 'pipe', encoding: 'utf8' });
  if (r.status === 0) {
    console.log(`✓ GitHub secret ${name}`);
    return true;
  }
  console.warn(`⚠ Could not set GitHub secret ${name}:`, r.stderr?.trim() || 'gh not available');
  return false;
}

async function main() {
  loadEnv();

  console.log('CloudCast — transactional email setup\n');

  tryRun(
    'npx supabase db push --linked --yes --include-all',
    'Apply pending DB migrations (email production + sessions)',
  );

  let secretsOk = false;
  try {
    run('npm run secrets:email', 'Sync email secrets to Supabase');
    secretsOk = true;
  } catch (err) {
    const code = err.status ?? 1;
    if (code === 2) {
      console.warn('⚠ Email secrets partially synced (RESEND_API_KEY still needed).');
    } else {
      console.warn('⚠ Skipped: Sync email secrets to Supabase');
    }
  }

  tryRun('npm run deploy:email', 'Deploy send-transactional-email edge function');

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
  const keyList = getApiKeys();
  const serviceRole =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    keyList.find((k) => k.id === 'service_role' || k.name === 'service_role')?.api_key;

  if (supabaseUrl) setGhSecret('SUPABASE_URL', supabaseUrl);
  if (anonKey) setGhSecret('SUPABASE_ANON_KEY', anonKey);
  if (serviceRole) setGhSecret('SUPABASE_SERVICE_ROLE_KEY', serviceRole);

  const webhookSecret =
    process.env.EMAIL_WEBHOOK_SECRET?.trim() || fetchDbSetting('email_webhook_secret');
  if (webhookSecret) setGhSecret('EMAIL_WEBHOOK_SECRET', webhookSecret);

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const webhookSecretForTest =
    process.env.EMAIL_WEBHOOK_SECRET?.trim() || fetchDbSetting('email_webhook_secret');

  if (webhookSecretForTest && supabaseUrl) {
    console.log('\n▶ Send test welcome email');
    const testTo = process.env.EMAIL_TEST_TO?.trim() || 'pleromadoxa@gmail.com';
    try {
      const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'x-email-webhook-secret': webhookSecretForTest,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_to: testTo,
          template: 'signup_welcome',
          payload: { full_name: 'CloudCast Operator', plan_id: 'free' },
        }),
      });
      const body = await res.json();
      if (res.ok) console.log('✓ Test email queued/sent:', JSON.stringify(body));
      else console.warn('⚠ Test email failed:', res.status, body);
    } catch (err) {
      console.warn('⚠ Test email error:', err instanceof Error ? err.message : err);
    }
  }

  console.log('\n---');
  if (!resendKey) {
    console.log('Add RESEND_API_KEY to .env, then run: npm run secrets:email && npm run deploy:email');
  } else if (secretsOk) {
    console.log('✓ Email stack configured. Preview templates: npm run email:preview');
    console.log('  Admin queue: /admin → Email queue');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
