#!/usr/bin/env node
/**
 * Generates public/sitemap.xml — keep routes in sync with src/config/seo.ts SITEMAP_ROUTES.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE_URL = (process.env.VITE_APP_URL ?? process.env.APP_PUBLIC_URL ?? 'https://cloudcast.live').replace(/\/$/, '');
const LASTMOD = new Date().toISOString().slice(0, 10);

const ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/products', changefreq: 'weekly', priority: '0.9' },
  { path: '/products/guide', changefreq: 'monthly', priority: '0.9' },
  { path: '/products/video-mixer', changefreq: 'weekly', priority: '0.85' },
  { path: '/products/audio-mixer', changefreq: 'weekly', priority: '0.85' },
  { path: '/products/symphony', changefreq: 'weekly', priority: '0.85' },
  { path: '/products/replay', changefreq: 'weekly', priority: '0.85' },
  { path: '/products/regal-display', changefreq: 'weekly', priority: '0.85' },
  { path: '/products/regal-prism', changefreq: 'weekly', priority: '0.85' },
  { path: '/for/churches', changefreq: 'monthly', priority: '0.8' },
  { path: '/for/sports', changefreq: 'monthly', priority: '0.8' },
  { path: '/for/news', changefreq: 'monthly', priority: '0.8' },
  { path: '/for/corporate', changefreq: 'monthly', priority: '0.8' },
  { path: '/pricing', changefreq: 'weekly', priority: '0.9' },
  { path: '/login', changefreq: 'monthly', priority: '0.5' },
  { path: '/legal/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/legal/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/legal/cookies', changefreq: 'yearly', priority: '0.3' },
  { path: '/legal/acceptable-use', changefreq: 'yearly', priority: '0.3' },
  { path: '/legal/security', changefreq: 'yearly', priority: '0.3' },
  { path: '/legal/sla', changefreq: 'yearly', priority: '0.3' },
  { path: '/legal/refunds', changefreq: 'yearly', priority: '0.3' },
  { path: '/legal/dpa', changefreq: 'yearly', priority: '0.3' },
  { path: '/legal/subprocessors', changefreq: 'yearly', priority: '0.3' },
];

const urls = ROUTES.map(({ path, changefreq, priority }) => {
  const loc = path === '/' ? SITE_URL : `${SITE_URL}${path}`;
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

const outPath = join(process.cwd(), 'public', 'sitemap.xml');
writeFileSync(outPath, xml, 'utf8');
console.log(`✓ Wrote ${outPath} (${ROUTES.length} URLs, lastmod ${LASTMOD})`);
