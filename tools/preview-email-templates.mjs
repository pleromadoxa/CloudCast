#!/usr/bin/env node
/**
 * Generate static HTML previews for all CloudCast email templates.
 * Run: npm run email:preview
 *
 * Writes to public/email/previews/*.html — served at /email/previews/ after deploy.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public/email/previews');

process.env.APP_PUBLIC_URL = process.env.APP_PUBLIC_URL ?? 'https://cloudcast.pleromadoxa.workers.dev';

// Mirror of supabase/functions/_shared/legal.ts + templates.ts (keep in sync)
const EMAIL_BRAND = {
  productName: 'CloudCast',
  byline: 'by Quantum Regal',
  companyName: 'Quantum Regal Digital Labs',
  tagline: 'Professional broadcast production platform',
  supportEmail: 'support@cloudcast.regal',
  legalEmail: 'legal@cloudcast.regal',
};

function appPublicUrl() {
  return (process.env.APP_PUBLIC_URL ?? 'https://cloudcast.regal').replace(/\/$/, '');
}

function logoUrl() {
  return `${appPublicUrl()}/email/cloudcast-logo.png`;
}

function emailHeaderHtml() {
  const base = appPublicUrl();
  return `
    <tr>
      <td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #1a1a1a;background:linear-gradient(180deg,#0f0f0f 0%,#0a0a0a 100%);">
        <a href="${base}" style="text-decoration:none;display:inline-block;">
          <img src="${logoUrl()}" alt="${EMAIL_BRAND.productName} ${EMAIL_BRAND.byline}" width="200" height="auto" style="max-width:200px;height:auto;display:block;margin:0 auto 12px;border:0;"/>
          <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#e11d48;">${EMAIL_BRAND.byline}</p>
          <p style="margin:6px 0 0;font-size:11px;color:#666;letter-spacing:0.04em;">${EMAIL_BRAND.tagline}</p>
        </a>
      </td>
    </tr>`;
}

function legalFooterHtml() {
  const base = appPublicUrl();
  const links = [
    { href: `${base}/legal/terms`, label: 'Terms of Service' },
    { href: `${base}/legal/privacy`, label: 'Privacy Policy' },
    { href: `${base}/legal/refunds`, label: 'Refunds' },
  ];
  return `
    <p style="margin:24px 0 8px;font-size:11px;color:#888;line-height:1.6;">
      ${EMAIL_BRAND.productName} ${EMAIL_BRAND.byline}<br/>
      ${EMAIL_BRAND.companyName} · ${EMAIL_BRAND.legalEmail} · ${EMAIL_BRAND.supportEmail}
    </p>
    <p style="margin:0;font-size:11px;color:#666;line-height:1.8;">
      ${links.map((l) => `<a href="${l.href}" style="color:#e11d48;text-decoration:none;margin-right:12px;">${l.label}</a>`).join('')}
    </p>`;
}

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;padding:0;background:#060606;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8e8e8;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#060606;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#0a0a0a;border:1px solid #222;border-radius:12px;overflow:hidden;">
        ${emailHeaderHtml()}
        <tr><td style="padding:28px 32px;">
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#fff;">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:0 32px 28px;">${legalFooterHtml()}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function btn(href, label) {
  return `<p style="margin:24px 0 0;"><a href="${href}" style="display:inline-block;background:#e11d48;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.05em;">${label}</a></p>`;
}

const PLAN_LABELS = { free: 'Free', pro: 'Pro', pro_master: 'Pro Master', universal: 'Universal' };
const PRODUCT_LABELS = {
  video_mixer: 'Video Mixer',
  audio_mixer: 'Audio Mixer',
  symphony_studio: 'Symphony',
  instant_replay: 'CloudCast Replay',
  universal: 'CloudCast Universal',
};

function planLabel(id) {
  return PLAN_LABELS[id] ?? id;
}

function productLabel(id) {
  return PRODUCT_LABELS[id] ?? id;
}

function formatMoney(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatBytes(bytes) {
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function receiptTable(rows) {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0 0;border-top:1px solid #222;">${
    rows.map(([l, v]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #1a1a1a;font-size:13px;color:#888;width:42%;">${l}</td><td style="padding:10px 0;border-bottom:1px solid #1a1a1a;font-size:13px;color:#fff;text-align:right;">${v}</td></tr>`).join('')
  }</table>`;
}

const base = appPublicUrl();
const name = 'Alex Rivera';

const templates = {
  signup_welcome: {
    subject: 'Welcome to CloudCast by Quantum Regal',
    html: layout('Welcome aboard', `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">Hi ${name},</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">
        Your CloudCast account is ready. You now have access to the full Quantum Regal broadcast suite — live video mixing,
        instant replay, audio console, and Symphony studio — from one dashboard.
      </p>
      <ul style="margin:0 0 16px;padding-left:18px;font-size:13px;line-height:1.7;color:#999;">
        <li>Pair mobile cameras with a 6-digit access code</li>
        <li>Switch multi-cam live production from the Video Mixer</li>
        <li>Mark replay clips and push to PGM in one click</li>
        <li>Compose scores in Symphony and mix on the Audio Console</li>
      </ul>
      <p style="margin:0;font-size:14px;line-height:1.65;color:#bbb;">
        Starting plan: <strong style="color:#fff;">Free</strong>
        · CloudCast Replay is included with Video Mixer at every tier.
      </p>
      ${btn(`${base}/products`, 'OPEN PRODUCT HUB')}
    `),
  },
  payment_receipt: {
    subject: 'CloudCast receipt — Video Mixer Pro',
    html: layout('Payment receipt', `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">Hi ${name},</p>
      <p style="margin:0 0 4px;font-size:14px;line-height:1.65;color:#bbb;">
        Thank you for your CloudCast subscription. This email confirms your payment to Quantum Regal Digital Labs.
      </p>
      ${receiptTable([
        ['Receipt', '<span style="font-family:monospace;">CC-2025-0612-A1B2C3D4</span>'],
        ['Date', 'June 12, 2025'],
        ['Product', 'Video Mixer'],
        ['Plan', 'Pro'],
        ['Amount', `<strong style="color:#e11d48;font-size:15px;">${formatMoney(2900)}</strong>`],
        ['Billing', 'Monthly'],
        ['Renews', 'July 12, 2025'],
        ['Status', '<span style="color:#22c55e;">Paid</span>'],
      ])}
      <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#666;">
        Questions about billing? Contact support@cloudcast.regal.
      </p>
      ${btn(`${base}/profile`, 'VIEW BILLING')}
    `),
  },
  plan_changed: {
    subject: 'Your CloudCast plan was updated',
    html: layout('Plan updated', `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">Your CloudCast subscription has been updated.</p>
      <p style="margin:0 0 12px;font-size:13px;color:#888;">Product: <strong style="color:#fff;">Video Mixer</strong></p>
      <p style="margin:0;font-size:14px;line-height:1.65;color:#bbb;">
        <strong style="color:#fff;">Free</strong> → <strong style="color:#e11d48;">Pro</strong>
      </p>
      ${btn(`${base}/profile`, 'VIEW ACCOUNT')}
    `),
  },
  storage_warning_75: {
    subject: 'CloudCast storage at 80%',
    html: layout('Cloud storage 80%', `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">
        Your Regal Cloud storage is at <strong style="color:#fff;">80%</strong> (${formatBytes(40e9)} of ${formatBytes(50e9)}).
      </p>
      ${btn(`${base}/profile`, 'MANAGE STORAGE')}
    `),
  },
  recording_uploaded: {
    subject: 'PGM recording saved to Regal Cloud',
    html: layout('Recording uploaded', `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#bbb;">
        <strong style="color:#fff;">Sunday Service PGM.mp4</strong> (${formatBytes(1.2e9)}) was saved to your Regal Cloud library.
      </p>
      ${btn(`${base}/profile`, 'VIEW RECORDINGS')}
    `),
  },
};

mkdirSync(outDir, { recursive: true });

const indexLinks = [];

for (const [id, { subject, html }] of Object.entries(templates)) {
  const file = `${id}.html`;
  writeFileSync(join(outDir, file), html, 'utf8');
  indexLinks.push({ id, file, subject });
  console.log(`✓ public/email/previews/${file}`);
}

const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>CloudCast email previews</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #060606; color: #eee; padding: 2rem; max-width: 640px; margin: 0 auto; }
    h1 { font-size: 1.25rem; }
    a { color: #e11d48; text-decoration: none; }
    li { margin: 0.5rem 0; color: #aaa; }
    li strong { color: #fff; }
  </style>
</head>
<body>
  <h1>CloudCast email previews <span style="color:#888;font-weight:400;">by Quantum Regal</span></h1>
  <p style="color:#888;font-size:14px;">Static previews — every template includes logo + Regal byline.</p>
  <ul>
    ${indexLinks.map(({ id, file, subject }) => `<li><strong>${id}</strong> — <a href="./${file}">${subject}</a></li>`).join('\n    ')}
  </ul>
</body>
</html>`;

writeFileSync(join(outDir, 'index.html'), indexHtml, 'utf8');
console.log('✓ public/email/previews/index.html');
