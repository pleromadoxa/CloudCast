#!/usr/bin/env node
/**
 * Post-build: create per-route index.html snapshots with crawler-friendly
 * meta tags and noscript content for Cloudflare SPA asset serving.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SITE_URL = (process.env.VITE_APP_URL ?? process.env.APP_PUBLIC_URL ?? 'https://cloudcast.live').replace(/\/$/, '');

/** Mirrors src/config/seo.ts + product/solution landing pages */
const PAGES = [
  {
    path: '/',
    title: 'Professional Broadcast Tools in the Cloud | CloudCast by Quantum Regal',
    description:
      'CloudCast is a browser-based broadcast suite: video mixer, audio console, virtual production, instant replay, worship display, and online DAW. Stream to YouTube, Twitch, and RTMP.',
    body: 'CloudCast by Quantum Regal — professional multi-source video mixing, 16-channel audio console, Symphony DAW, instant replay, Regal Display worship presentation, and Regal Prism virtual production. Free tier with Regal Mesh. Pro from $29/mo.',
  },
  {
    path: '/products',
    title: 'Broadcast Products — Video, Audio, Virtual Production & More | CloudCast by Quantum Regal',
    description: 'Explore six CloudCast products: Video Mixer, Audio Mixer, Symphony DAW, Instant Replay, Regal Display, and Regal Prism.',
    body: 'CloudCast products: Video Mixer, Audio Mixer, Symphony, Replay, Regal Display, Regal Prism. CloudCast Universal bundle from $59/mo.',
  },
  {
    path: '/products/guide',
    title: 'Product Guide — How CloudCast Replaces Hardware OB Gear | CloudCast by Quantum Regal',
    description: 'In-depth guide to CloudCast for churches, sports, news, and live events.',
    body: 'Complete CloudCast product guide with workflows, cost comparisons, and step-by-step production scenarios.',
  },
  {
    path: '/pricing',
    title: 'Pricing — Free, Pro, Pro Master & Universal Plans | CloudCast by Quantum Regal',
    description: 'CloudCast pricing from $0/month. Universal bundle from $59/mo.',
    body: 'CloudCast pricing: Free, Pro $29/mo, Pro Master $79/mo. Universal Essential $59, Studio $99, Master $149.',
  },
  {
    path: '/products/video-mixer',
    title: 'CloudCast Video Mixer — Multi-channel video production switcher | CloudCast by Quantum Regal',
    description: 'Browser-based PST/PGM broadcast switcher with chroma key, multiview, device pairing, and RTMP streaming.',
    body: 'CloudCast Video Mixer — online broadcast switcher for YouTube, Twitch, and multi-camera live production.',
  },
  {
    path: '/products/audio-mixer',
    title: 'CloudCast Audio Mixer — Multi-channel broadcast audio console | CloudCast by Quantum Regal',
    description: '16-channel digital audio console with spectrum display, solo/mute, monitor bus, and mobile inputs.',
    body: 'CloudCast Audio Mixer — browser broadcast audio console for live events and church production.',
  },
  {
    path: '/products/symphony',
    title: 'CloudCast Symphony — Professional online music studio & DAW | CloudCast by Quantum Regal',
    description: 'Multi-track DAW with piano roll, synthesizers, loops, automation, and cloud project sync.',
    body: 'CloudCast Symphony — browser DAW for music production and mixdown export.',
  },
  {
    path: '/products/replay',
    title: 'CloudCast Replay — Instant replay & clip engine | CloudCast by Quantum Regal',
    description: 'Rolling buffer capture, slow-motion review, multi-angle sync, and one-click PGM push.',
    body: 'CloudCast Replay — instant replay software for sports and live events.',
  },
  {
    path: '/products/regal-display',
    title: 'Regal Display — Worship presentation & scripture engine | CloudCast by Quantum Regal',
    description: 'EasyWorship-style slides, scriptures, custom fields, and Display Feed for the Video Mixer.',
    body: 'Regal Display — church presentation software with scripture lookup and congregation display feed.',
  },
  {
    path: '/products/regal-prism',
    title: 'Regal Prism — Virtual production & AR studio | CloudCast by Quantum Regal',
    description: 'Live chroma keying, 3D virtual sets, AR compositing, and camera tracking in the browser.',
    body: 'Regal Prism — browser virtual production and green screen virtual studio.',
  },
  {
    path: '/for/churches',
    title: 'Church Live Streaming & Worship Production | CloudCast by Quantum Regal',
    description: 'Stream every service without a hardware truck. Video mixer, worship presentation, audio, and replay.',
    body: 'CloudCast for churches — volunteer-friendly live streaming and worship production.',
  },
  {
    path: '/for/sports',
    title: 'Sports Live Production & Instant Replay | CloudCast by Quantum Regal',
    description: 'Multi-cam sports without an OB truck. Instant replay, slow-motion, and RTMP streaming.',
    body: 'CloudCast for sports — instant replay and multi-camera live production.',
  },
  {
    path: '/for/news',
    title: 'News Desk & Remote Field Production | CloudCast by Quantum Regal',
    description: 'Breaking news switching from any laptop with Regal Cloud HD+ field feeds.',
    body: 'CloudCast for news — remote field production and news desk switching.',
  },
  {
    path: '/for/corporate',
    title: 'Corporate Events & Hybrid Conferences | CloudCast by Quantum Regal',
    description: 'Keynotes, panels, and hybrid events with a professional browser switcher.',
    body: 'CloudCast for corporate events — hybrid conference and town hall production.',
  },
];

const distIndex = join(process.cwd(), 'dist', 'index.html');
if (!existsSync(distIndex)) {
  console.error('dist/index.html not found — run vite build first');
  process.exit(1);
}

const template = readFileSync(distIndex, 'utf8');

function injectMeta(html, page) {
  const canonical = page.path === '/' ? SITE_URL : `${SITE_URL}${page.path}`;
  let out = html;

  out = out.replace(/<title>[^<]*<\/title>/, `<title>${page.title}</title>`);
  out = out.replace(
    /<meta name="description" content="[^"]*"/,
    `<meta name="description" content="${page.description.replace(/"/g, '&quot;')}"`,
  );
  out = out.replace(
    /<link rel="canonical" href="[^"]*"/,
    `<link rel="canonical" href="${canonical}"`,
  );
  out = out.replace(
    /<meta property="og:title" content="[^"]*"/,
    `<meta property="og:title" content="${page.title.replace(/"/g, '&quot;')}"`,
  );
  out = out.replace(
    /<meta property="og:description" content="[^"]*"/,
    `<meta property="og:description" content="${page.description.replace(/"/g, '&quot;')}"`,
  );
  out = out.replace(
    /<meta property="og:url" content="[^"]*"/,
    `<meta property="og:url" content="${canonical}"`,
  );

  const noscript = `<noscript><article style="max-width:720px;margin:2rem auto;padding:0 1.5rem;font-family:system-ui,sans-serif"><h1>${page.title.split(' | ')[0]}</h1><p>${page.body}</p><p><a href="${canonical}">Continue to CloudCast</a></p></article></noscript>`;
  out = out.replace('<div id="root"></div>', `${noscript}\n    <div id="root"></div>`);

  return out;
}

let count = 0;
for (const page of PAGES) {
  const dir = join(process.cwd(), 'dist', page.path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), injectMeta(template, page), 'utf8');
  count++;
}

console.log(`✓ Prerendered ${count} marketing HTML snapshots in dist/`);
