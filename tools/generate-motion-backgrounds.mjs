#!/usr/bin/env node
/**
 * generate-motion-backgrounds.mjs
 * ---------------------------------------------------------------------------
 * Builds the real-footage background pack for the 3D Motion Graphics feature.
 *
 *   - Downloads public-domain space / Earth imagery (NASA Image & Video Library,
 *     NASA Visible Earth, ESO public archives) with a proper User-Agent.
 *   - Tries MULTIPLE fallback URLs per asset so one dead link never fails a run.
 *   - Verifies every download (HTTP 200, > 20 KB, sharp can read it).
 *   - Normalizes stills with sharp, then encodes seamless-looping 6 s Ken Burns
 *     clips (zoompan + fade-in/out to black) at 1280x720 / 30 fps.
 *   - Writes posters, the 2048x1024 equirectangular Earth texture,
 *     `public/motion/bg/CREDITS.md` and the typed manifest
 *     `src/lib/prism/motionAssets.generated.ts`.
 *
 * Usage:
 *   node tools/generate-motion-backgrounds.mjs           # fill in what is missing
 *   node tools/generate-motion-backgrounds.mjs --force   # regenerate everything
 *
 * Idempotent: any output that already exists is skipped unless --force is given.
 * Downloads are cached in the OS temp dir so re-runs stay fast and offline-safe.
 * ---------------------------------------------------------------------------
 */
import { mkdir, readFile, writeFile, stat, readdir, unlink, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// ---------------------------------------------------------------- constants --

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'motion', 'bg');
const MANIFEST_PATH = path.join(ROOT, 'src', 'lib', 'prism', 'motionAssets.generated.ts');
const CREDITS_PATH = path.join(OUT_DIR, 'CREDITS.md');
const CACHE_DIR = path.join(os.tmpdir(), 'cloudcast-motion-assets');

const USER_AGENT = 'CloudCastMotionAssets/1.0 (contact: dev@cloudcast.app)';

const FORCE = process.argv.includes('--force');

const OUT_W = 1280;
const OUT_H = 720;
const FPS = 30;
const SRC_W = 2560; // normalized still (>= 1920px wide, exact 16:9)
const SRC_H = 1440;
const POSTER_W = 640;
const POSTER_QUALITY = 72;
const MIN_DOWNLOAD_BYTES = 20 * 1024;
const MAX_CLIP_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const MAX_CANDIDATES = 14; // bounds worst-case retry storms per asset

/** crf / duration ladder applied while a clip is over the 5 MB budget. */
const ENCODE_LADDER = [
  { crf: 26, seconds: 6 },
  { crf: 28, seconds: 6 },
  { crf: 30, seconds: 6 },
  { crf: 28, seconds: 5 },
  { crf: 30, seconds: 5 },
];

function firstBinary(candidates) {
  for (const c of candidates) {
    if (!c) continue;
    if (c.includes('/')) return existsSync(c) ? c : null;
    return c; // bare command name — trust PATH
  }
  return null;
}

const FFMPEG = firstBinary([process.env.FFMPEG, '/opt/homebrew/bin/ffmpeg', 'ffmpeg']);
const FFPROBE = firstBinary([process.env.FFPROBE, '/opt/homebrew/bin/ffprobe', 'ffprobe']);

// ------------------------------------------------------------------ assets ---
/**
 * Every asset declares at least four candidate sources: a NASA images-API
 * search (which expands to several CDN links) plus literal fallback URLs on
 * images-assets.nasa.gov, eoimages.gsfc.nasa.gov, eso.org and
 * raw.githubusercontent.com, so a single dead link never fails the run.
 */
const ASSETS = [
  {
    id: 'earth_orbit',
    name: 'Earth From Orbit',
    kind: 'video',
    credit: 'NASA',
    license: 'Public domain (NASA media usage guidelines)',
    tags: ['space', 'earth', 'orbit'],
    motion: { type: 'zoom', maxZoom: 1.12 },
    sourceTitle: 'Earth Observation from the International Space Station (iss045e013851)',
    sources: [
      { type: 'nasa', query: 'earth from space station', prefer: ['iss045e013851'] },
      { type: 'url', url: 'https://images-assets.nasa.gov/image/iss045e013851/iss045e013851~orig.jpg' },
      { type: 'nasa', query: 'earth limb sunrise', prefer: ['s66-38275', 'STS052-23-022'] },
      {
        type: 'url',
        url: 'https://images-assets.nasa.gov/image/s66-38275/s66-38275~large.jpg',
        title: "Earth's limb at sunrise as seen from the Gemini 9-A spacecraft",
      },
      {
        type: 'url',
        url: 'https://images-assets.nasa.gov/image/STS052-23-022/STS052-23-022~large.jpg',
        title: 'Sunrise, Earth Limb (STS-52)',
      },
      { type: 'nasa', query: 'blue marble earth from space' },
    ],
  },
  {
    id: 'galaxy_andromeda',
    name: 'Andromeda Galaxy',
    kind: 'video',
    credit: 'NASA / JPL-Caltech',
    license: 'Public domain (NASA media usage guidelines)',
    tags: ['space', 'galaxy', 'andromeda'],
    motion: { type: 'zoom', maxZoom: 1.14 },
    sourceTitle: 'Andromeda Galaxy (PIA04921, Spitzer Space Telescope)',
    sources: [
      { type: 'nasa', query: 'andromeda galaxy', prefer: ['PIA04921'] },
      { type: 'url', url: 'https://images-assets.nasa.gov/image/PIA04921/PIA04921~orig.jpg' },
      {
        type: 'url',
        url: 'https://images-assets.nasa.gov/image/PIA08787/PIA08787~large.jpg',
        title: 'Amazing Andromeda Galaxy (PIA08787)',
      },
      { type: 'nasa', query: 'spiral galaxy nasa' },
      {
        type: 'url',
        url: 'https://www.eso.org/public/archives/images/screen/eso1036a.jpg',
        title: 'The superwind galaxy NGC 4666',
        credit: 'ESO',
        license: 'CC BY 4.0 (ESO)',
      },
    ],
  },
  {
    id: 'nebula_deep',
    name: 'Carina Nebula',
    kind: 'video',
    credit: 'NASA / ESA / CSA / STScI',
    license: 'Public domain (NASA media usage guidelines)',
    tags: ['space', 'nebula', 'carina'],
    motion: { type: 'zoom', maxZoom: 1.12 },
    sourceTitle: 'JWST NIRCam image of the "Cosmic Cliffs" in the Carina Nebula',
    sources: [
      { type: 'nasa', query: 'carina nebula', prefer: ['carina_nebula'] },
      { type: 'url', url: 'https://images-assets.nasa.gov/image/carina_nebula/carina_nebula~large.jpg' },
      { type: 'nasa', query: 'pillars of creation', prefer: ['GSFC_20171208_Archive_e000842'] },
      {
        type: 'url',
        url: 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000842/GSFC_20171208_Archive_e000842~large.jpg',
        title: "Hubble's High-Definition View of the Pillars of Creation",
      },
      {
        type: 'url',
        url: 'https://images-assets.nasa.gov/image/PIA03515/PIA03515~large.jpg',
        title: 'All Pillars Point to Eta (PIA03515)',
      },
      {
        type: 'url',
        url: 'https://www.eso.org/public/archives/images/screen/eso0834a.jpg',
        title: 'Star-forming region NGC 346',
        credit: 'ESO',
        license: 'CC BY 4.0 (ESO)',
      },
    ],
  },
  {
    id: 'deep_field',
    name: 'Hubble Deep Field',
    kind: 'video',
    credit: 'NASA / ESA / STScI',
    license: 'Public domain (NASA media usage guidelines)',
    tags: ['space', 'deep field', 'galaxies'],
    motion: { type: 'pan', zoom: 1.08 },
    sourceTitle: 'Hubble eXtreme Deep Field — farthest-ever view of the universe',
    sources: [
      { type: 'nasa', query: 'hubble ultra deep field', prefer: ['GSFC_20171208_Archive_e001651'] },
      {
        type: 'url',
        url: 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001651/GSFC_20171208_Archive_e001651~large.jpg',
        title: 'Hubble eXtreme Deep Field (XDF)',
      },
      {
        type: 'url',
        url: 'https://images-assets.nasa.gov/image/NHQ202207120017/NHQ202207120017~large.jpg',
        title: "JWST's First Deep Field (SMACS 0723)",
      },
      { type: 'nasa', query: 'webb first deep field' },
      {
        type: 'url',
        url: 'https://www.eso.org/public/archives/images/screen/eso0934a.jpg',
        title: 'A 340-million pixel starscape from Paranal',
        credit: 'ESO',
        license: 'CC BY 4.0 (ESO)',
      },
    ],
  },
  {
    id: 'world_map',
    name: 'World Topography Map',
    kind: 'video',
    credit: 'NASA Visible Earth',
    license: 'Public domain (NASA media usage guidelines)',
    tags: ['earth', 'map', 'topography'],
    motion: { type: 'pan', zoom: 1.06 },
    sourceTitle: 'Blue Marble: Topography and Bathymetry of the Earth (world.topo.bathy)',
    sources: [
      {
        type: 'url',
        url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg',
      },
      {
        type: 'url',
        url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.jpg',
        title: 'Land Ocean Ice Global Projection 2048x1024',
      },
      {
        type: 'url',
        url: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
        title: 'Earth day texture (equirectangular)',
        credit: 'NASA / three.js examples',
        license: 'Public domain (NASA)',
      },
      { type: 'nasa', query: 'blue marble world map' },
    ],
  },
  {
    id: 'earth_equirect',
    name: 'Earth Equirectangular Map',
    kind: 'equirect',
    credit: 'NASA Visible Earth',
    license: 'Public domain (NASA media usage guidelines)',
    tags: ['earth', 'map', 'globe', 'equirectangular'],
    aspect: 2, // must be a full 360x180 equirectangular frame
    sourceTitle: 'Blue Marble: Topography and Bathymetry of the Earth (world.topo.bathy)',
    sources: [
      {
        type: 'url',
        url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg',
      },
      {
        type: 'url',
        url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.jpg',
        title: 'Land Ocean Ice Global Projection 2048x1024',
      },
      {
        type: 'url',
        url: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
        title: 'Earth day texture (equirectangular)',
        credit: 'NASA / three.js examples',
        license: 'Public domain (NASA)',
      },
      { type: 'nasa', query: 'equirectangular earth map' },
    ],
  },
];

// ------------------------------------------------------------------ helpers --

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function warn(msg) {
  process.stderr.write(`WARNING: ${msg}\n`);
}

function bytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function sq(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function run(bin, args, timeoutMs = 15 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${path.basename(bin)} timed out`));
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${path.basename(bin)} exited ${code}: ${stderr.slice(-800)}`));
    });
  });
}

async function fileSize(file) {
  try {
    return (await stat(file)).size;
  } catch {
    return 0;
  }
}

async function nonEmpty(file) {
  return (await fileSize(file)) > 0;
}

async function moveFile(from, to) {
  try {
    await rename(from, to);
  } catch {
    const buf = await readFile(from);
    await writeFile(to, buf);
    await unlink(from).catch(() => {});
  }
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Verify a downloaded file: > 20 KB, sharp decodes it, aspect matches when required. */
async function verifyImage(file, aspect) {
  const size = await fileSize(file);
  if (size <= MIN_DOWNLOAD_BYTES) {
    await unlink(file).catch(() => {});
    throw new Error(`file too small (${size} bytes)`);
  }
  let meta;
  try {
    meta = await sharp(file).metadata();
  } catch (err) {
    await unlink(file).catch(() => {});
    throw new Error(`sharp could not read it: ${err.message}`);
  }
  if (!meta.width || !meta.height) {
    await unlink(file).catch(() => {});
    throw new Error('no image dimensions');
  }
  if (aspect) {
    const got = meta.width / meta.height;
    if (Math.abs(got - aspect) / aspect > 0.02) {
      await unlink(file).catch(() => {});
      throw new Error(`aspect ${got.toFixed(3)} is not ${aspect}:1`);
    }
  }
  return meta;
}

/** Download one URL with a User-Agent; throws unless HTTP 200 + > 20 KB + decodable. */
async function downloadVerified(url, dest, aspect) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000),
  });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length <= MIN_DOWNLOAD_BYTES) throw new Error(`body too small (${buf.length} bytes)`);
  await writeFile(dest, buf);
  return verifyImage(dest, aspect);
}

// ------------------------------------------------------- source resolution --

const URL_RANK = ['~orig', '~large', '~medium', '~small'];

function rankLink(a, b) {
  const ra = URL_RANK.findIndex((s) => a.includes(s));
  const rb = URL_RANK.findIndex((s) => b.includes(s));
  return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
}

/** Expand one declared source into ordered concrete {url,title} candidates. */
async function expandSource(source, asset) {
  if (source.type === 'url') {
    return [{
      url: source.url,
      title: source.title ?? asset.sourceTitle,
      credit: source.credit,
      license: source.license,
    }];
  }
  if (source.type !== 'nasa') return [];
  try {
    const api = `https://images-api.nasa.gov/search?q=${encodeURIComponent(source.query)}&media_type=image`;
    const json = await fetchJson(api);
    const items = json?.collection?.items ?? [];
    const preferred = [];
    const rest = [];
    for (const item of items) {
      const datum = item?.data?.[0];
      if (!datum) continue;
      const hrefs = (item.links ?? [])
        .map((l) => l.href)
        .filter((h) => typeof h === 'string' && /\.(jpe?g|png)$/i.test(h))
        .sort(rankLink);
      if (!hrefs.length) continue;
      const entry = { url: hrefs[0], title: datum.title ?? asset.sourceTitle };
      if ((source.prefer ?? []).includes(datum.nasa_id)) preferred.push(entry);
      else if (rest.length < 5) rest.push(entry);
    }
    return [...preferred, ...rest];
  } catch (err) {
    warn(`${asset.id}: NASA images API search "${source.query}" failed (${err.message}) — using literal fallbacks`);
    return [];
  }
}

/**
 * Try every candidate for an asset until one downloads and verifies.
 * Returns { file, url, title, credit, license } or null when all sources fail.
 */
async function obtainSource(asset) {
  const cacheFile = path.join(CACHE_DIR, `${asset.id}.source.img`);
  const metaFile = `${cacheFile}.json`;

  if (!FORCE && (await nonEmpty(cacheFile))) {
    try {
      await verifyImage(cacheFile, asset.aspect);
      const saved = JSON.parse(await readFile(metaFile, 'utf8'));
      log(`  [${asset.id}] using cached source ${saved.url}`);
      return { file: cacheFile, ...saved };
    } catch {
      /* stale cache — download fresh */
    }
  }

  const candidates = [];
  for (const source of asset.sources) {
    for (const entry of await expandSource(source, asset)) {
      if (!candidates.some((c) => c.url === entry.url)) candidates.push(entry);
      if (candidates.length >= MAX_CANDIDATES) break;
    }
    if (candidates.length >= MAX_CANDIDATES) break;
  }

  const part = `${cacheFile}.part`;
  let n = 0;
  for (const candidate of candidates) {
    n += 1;
    try {
      log(`  [${asset.id}] download ${n}/${candidates.length}: ${candidate.url}`);
      const meta = await downloadVerified(candidate.url, part, asset.aspect);
      await unlink(cacheFile).catch(() => {});
      await moveFile(part, cacheFile);
      const info = {
        url: candidate.url,
        title: candidate.title ?? asset.sourceTitle,
        credit: candidate.credit ?? asset.credit,
        license: candidate.license ?? asset.license,
        width: meta.width,
        height: meta.height,
      };
      await writeFile(metaFile, JSON.stringify(info, null, 2));
      return { file: cacheFile, ...info };
    } catch (err) {
      warn(`${asset.id}: candidate rejected (${err.message})`);
    }
  }
  warn(`${asset.id}: all ${candidates.length} candidate sources failed — skipping this asset`);
  return null;
}

// ------------------------------------------------------------- transforms ---

/** Cover-crop / upscale the still to an exact 16:9 frame at least 1920 px wide. */
async function normalizeVideoStill(source, dest) {
  await sharp(source)
    .resize(SRC_W, SRC_H, { fit: 'cover', position: 'centre', withoutEnlargement: false })
    .jpeg({ quality: 92 })
    .toFile(dest);
}

/** Full-frame equirectangular texture, exactly 2048x1024. */
async function writeEquirect(source, dest) {
  const tmp = `${dest}.tmp.jpg`;
  await sharp(source).resize(2048, 1024, { fit: 'fill' }).jpeg({ quality: 88 }).toFile(tmp);
  await moveFile(tmp, dest);
}

function buildVideoFilter(motion, seconds) {
  const frames = seconds * FPS;
  const last = frames - 1;
  let z;
  let x;
  let y;
  if (motion.type === 'pan') {
    const zoom = motion.zoom ?? 1.08;
    z = `'${zoom.toFixed(4)}'`;
    x = `'(iw-iw/zoom)*on/${last}'`;
    y = `'(ih-ih/zoom)/2'`;
  } else {
    const maxZoom = motion.maxZoom ?? 1.12;
    z = `'1+${(maxZoom - 1).toFixed(4)}*on/${last}'`;
    x = `'(iw/2-iw/zoom/2)'`;
    y = `'(ih/2-ih/zoom/2)'`;
  }
  // Start the fade-out 0.04 s early so the very last frame is fully black —
  // first and last frames then match exactly and the clip loops seamlessly.
  const fadeOutStart = (seconds - 0.44).toFixed(2);
  // Seamless loop: first and last 12 frames fade to/from black.
  return [
    `scale=${SRC_W}:${SRC_H}`,
    `zoompan=z=${z}:x=${x}:y=${y}:d=${frames}:s=${OUT_W}x${OUT_H}:fps=${FPS}`,
    'fade=t=in:st=0:d=0.4',
    `fade=t=out:st=${fadeOutStart}:d=0.4`,
    `scale=${OUT_W}:${OUT_H}`,
    'format=yuv420p',
  ].join(',');
}

async function encodeClip(still, dest, motion, { crf, seconds }) {
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', still,
    '-vf', buildVideoFilter(motion, seconds),
    '-r', String(FPS),
    '-t', String(seconds),
    '-c:v', 'libx264',
    '-crf', String(crf),
    '-preset', 'medium',
    '-movflags', '+faststart',
    '-an',
    dest,
  ];
  await run(FFMPEG, args);
}

async function probeClip(file) {
  const { stdout } = await run(FFPROBE, [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file,
  ]);
  const data = JSON.parse(stdout);
  const video = (data.streams ?? []).find((s) => s.codec_type === 'video');
  if (!video) throw new Error('no video stream');
  return {
    width: video.width,
    height: video.height,
    codec: video.codec_name,
    duration: Number(data.format?.duration ?? video.duration ?? 0),
  };
}

async function verifyClip(file, seconds) {
  const info = await probeClip(file);
  if (info.width !== OUT_W || info.height !== OUT_H) {
    throw new Error(`resolution ${info.width}x${info.height} != ${OUT_W}x${OUT_H}`);
  }
  if (!['h264', 'avc1'].includes(info.codec)) throw new Error(`codec ${info.codec}`);
  if (Math.abs(info.duration - seconds) > 0.5) {
    throw new Error(`duration ${info.duration}s != ~${seconds}s`);
  }
  if ((await fileSize(file)) < MIN_DOWNLOAD_BYTES) throw new Error('clip output is empty');
  return info;
}

/** Encode + verify, stepping through the crf/duration ladder until <= 5 MB. */
async function encodeWithinBudget(asset, still, dest) {
  let lastError = null;
  for (const attempt of ENCODE_LADDER) {
    try {
      await encodeClip(still, dest, asset.motion, attempt);
      await verifyClip(dest, attempt.seconds);
      const size = await fileSize(dest);
      log(`  [${asset.id}] encoded crf=${attempt.crf} ${attempt.seconds}s -> ${bytes(size)}`);
      if (size <= MAX_CLIP_BYTES) return { ...attempt, size };
      warn(`${asset.id}: clip is ${bytes(size)} (> 5 MB) — re-encoding with a higher crf`);
    } catch (err) {
      lastError = err;
      warn(`${asset.id}: encode crf=${attempt.crf}/${attempt.seconds}s failed (${err.message})`);
    }
  }
  if (lastError) throw lastError;
  return { crf: 30, seconds: 5, size: await fileSize(dest) };
}

async function writePoster(still, dest) {
  const tmp = `${dest}.tmp.jpg`;
  await sharp(still)
    .resize(POSTER_W, null, { fit: 'inside', withoutEnlargement: false })
    .jpeg({ quality: POSTER_QUALITY })
    .toFile(tmp);
  await moveFile(tmp, dest);
}

// ------------------------------------------------------------------ credits --

/** Reuse the source URLs recorded by a previous run when outputs are skipped. */
async function parsePreviousCredits() {
  const map = new Map();
  let raw;
  try {
    raw = await readFile(CREDITS_PATH, 'utf8');
  } catch {
    return map;
  }
  for (const line of raw.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length >= 7 && /^[a-z0-9_]+$/.test(cells[1]) && /^https?:\/\//.test(cells[3])) {
      map.set(cells[1], cells[3]);
    }
  }
  return map;
}

async function writeCredits(records, previous) {
  const rows = records.map((r) => {
    const url = r.url ?? previous.get(r.id) ?? r.fallbackUrl ?? 'n/a';
    return `| ${r.id} | ${r.title} | ${url} | ${r.credit} | ${r.license} |`;
  });
  const md = [
    '# Motion background credits',
    '',
    'Generated by `tools/generate-motion-backgrounds.mjs`.',
    '',
    'Every clip and texture in this folder is built from public-domain or openly',
    'licensed imagery — attribution to the agencies below is required.',
    '',
    '| id | title | source URL | agency/author | license |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
  await writeFile(CREDITS_PATH, md, 'utf8');
}

// ----------------------------------------------------------------- manifest ---

function buildManifest(entries) {
  const body = entries
    .map((e) => {
      const poster = e.poster ? ` poster: '${e.poster}',` : '';
      return `  { id: '${sq(e.id)}', name: '${sq(e.name)}', kind: '${e.kind}', file: '${sq(e.file)}',${poster} credit: '${sq(e.credit)}', tags: [${e.tags.map((t) => `'${sq(t)}'`).join(', ')}] },`;
    })
    .join('\n');
  return `/** GENERATED by tools/generate-motion-backgrounds.mjs — do not edit by hand. */
export interface MotionAssetEntry {
  id: string;
  name: string;
  kind: 'video' | 'image' | 'equirect';
  /** Absolute site path, e.g. '/motion/bg/earth_orbit.mp4' */
  file: string;
  /** Poster/thumbnail path used by the picker UI. */
  poster?: string;
  credit: string;
  tags: string[];
}

export const MOTION_ASSETS: MotionAssetEntry[] = [
${body}
];
`;
}

// -------------------------------------------------------- size budget trim ---

async function enforceTotalBudget(encoded) {
  for (let guard = 0; guard < 8; guard += 1) {
    const sizes = await Promise.all(
      (await readdir(OUT_DIR))
        .filter((f) => f.endsWith('.mp4'))
        .map(async (f) => ({ file: path.join(OUT_DIR, f), size: await fileSize(path.join(OUT_DIR, f)) })),
    );
    const total = sizes.reduce((a, b) => a + b.size, 0);
    if (total <= MAX_TOTAL_BYTES || sizes.length === 0) return total;
    sizes.sort((a, b) => b.size - a.size);
    const victim = sizes[0];
    const id = path.basename(victim.file, '.mp4');
    const state = encoded.get(id);
    const asset = ASSETS.find((a) => a.id === id);
    const still = path.join(CACHE_DIR, `${id}.still.jpg`);
    if (!state || !asset || !(await nonEmpty(still))) break;
    const crf = Math.min((state.crf ?? 26) + 4, 32);
    const seconds = state.seconds ?? 6;
    log(`[budget] ${bytes(total)} > 25 MB — re-encoding ${id} at crf=${crf} (${seconds}s)`);
    try {
      await encodeClip(still, victim.file, asset.motion, { crf, seconds });
      await verifyClip(victim.file, seconds);
      state.crf = crf;
      state.seconds = seconds;
    } catch (err) {
      warn(`budget re-encode of ${id} failed: ${err.message}`);
      break;
    }
  }
  let total = 0;
  for (const f of await readdir(OUT_DIR)) total += await fileSize(path.join(OUT_DIR, f));
  if (total > MAX_TOTAL_BYTES) warn(`folder total ${bytes(total)} still exceeds the 25 MB budget`);
  return total;
}

// -------------------------------------------------------------------- main ---

function manifestEntry(asset) {
  const entry = {
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    file: `/motion/bg/${asset.id}.${asset.kind === 'video' ? 'mp4' : 'jpg'}`,
    credit: asset.credit,
    tags: asset.tags,
  };
  if (asset.kind === 'video') entry.poster = `/motion/bg/${asset.id}.jpg`;
  return entry;
}

function creditRecord(asset, source) {
  return {
    id: asset.id,
    title: source?.title ?? asset.sourceTitle,
    url: source?.url,
    credit: source?.credit ?? asset.credit,
    license: source?.license ?? asset.license,
    fallbackUrl: asset.sources.find((s) => s.type === 'url')?.url,
  };
}

async function main() {
  if (!FFMPEG || !FFPROBE) {
    warn('ffmpeg/ffprobe not found — set FFMPEG / FFPROBE to their paths');
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });

  const previous = await parsePreviousCredits();
  const creditsRecords = [];
  const manifestEntries = [];
  const encoded = new Map();

  for (const asset of ASSETS) {
    const isVideo = asset.kind === 'video';
    const outFile = path.join(OUT_DIR, `${asset.id}.${isVideo ? 'mp4' : 'jpg'}`);
    const posterFile = path.join(OUT_DIR, `${asset.id}.jpg`);

    const haveOut = await nonEmpty(outFile);
    const havePoster = !isVideo || (await nonEmpty(posterFile));

    if (!FORCE && haveOut && havePoster) {
      log(`[${asset.id}] up to date — skipping (pass --force to regenerate)`);
      creditsRecords.push(creditRecord(asset, null));
      manifestEntries.push(manifestEntry(asset));
      continue;
    }

    log(`[${asset.id}] building…`);
    const source = await obtainSource(asset);
    if (!source) {
      creditsRecords.push(creditRecord(asset, null));
      continue; // graceful skip — already warned
    }
    creditsRecords.push(creditRecord(asset, source));

    if (asset.kind === 'equirect') {
      if (FORCE || !haveOut) {
        await writeEquirect(source.file, outFile);
        const meta = await sharp(outFile).metadata();
        if (meta.width !== 2048 || meta.height !== 1024) {
          throw new Error(`${asset.id}: expected 2048x1024, got ${meta.width}x${meta.height}`);
        }
        log(`  [${asset.id}] wrote 2048x1024 equirect texture (${bytes(await fileSize(outFile))})`);
      }
      manifestEntries.push(manifestEntry(asset));
      continue;
    }

    if (asset.kind === 'image') {
      if (FORCE || !haveOut) {
        await sharp(source.file).jpeg({ quality: 90 }).toFile(outFile);
        log(`  [${asset.id}] wrote image (${bytes(await fileSize(outFile))})`);
      }
      if (FORCE || !havePoster) await writePoster(outFile, posterFile);
      manifestEntries.push(manifestEntry(asset));
      continue;
    }

    // video: normalize still -> Ken Burns clip -> poster -> ffprobe verify
    const still = path.join(CACHE_DIR, `${asset.id}.still.jpg`);
    if (FORCE || !(await nonEmpty(still))) {
      await normalizeVideoStill(source.file, still);
      const stillMeta = await sharp(still).metadata();
      if (stillMeta.width < 1920) {
        throw new Error(`${asset.id}: normalized still is only ${stillMeta.width}px wide`);
      }
    }

    if (FORCE || !haveOut) {
      const choice = await encodeWithinBudget(asset, still, outFile);
      encoded.set(asset.id, choice);
    } else {
      encoded.set(asset.id, { crf: 26, seconds: 6 });
    }

    if (FORCE || !havePoster) {
      await writePoster(still, posterFile);
      log(`  [${asset.id}] poster ${bytes(await fileSize(posterFile))}`);
    }

    try {
      const info = await verifyClip(outFile, encoded.get(asset.id).seconds ?? 6);
      log(`  [${asset.id}] verified ${info.codec} ${info.width}x${info.height} ${info.duration.toFixed(2)}s`);
    } catch (err) {
      warn(`${asset.id}: verification failed (${err.message}) — re-encoding`);
      const choice = await encodeWithinBudget(asset, still, outFile);
      encoded.set(asset.id, choice);
      const info = await verifyClip(outFile, choice.seconds);
      log(`  [${asset.id}] verified ${info.codec} ${info.width}x${info.height} ${info.duration.toFixed(2)}s`);
    }

    manifestEntries.push(manifestEntry(asset));
  }

  // keep manifest order identical to the ASSETS table
  const byId = new Map(manifestEntries.map((e) => [e.id, e]));
  const ordered = ASSETS.map((a) => byId.get(a.id)).filter(Boolean);
  await writeFile(MANIFEST_PATH, buildManifest(ordered), 'utf8');
  await writeCredits(creditsRecords, previous);

  const total = await enforceTotalBudget(encoded);

  log('');
  log('Generated outputs:');
  for (const f of (await readdir(OUT_DIR)).sort()) {
    log(`  ${f.padEnd(24)} ${bytes(await fileSize(path.join(OUT_DIR, f)))}`);
  }
  log(`  ${path.relative(ROOT, MANIFEST_PATH).padEnd(24)} ${bytes(await fileSize(MANIFEST_PATH))}`);
  log(`Total public/motion/bg: ${bytes(total)} (budget 25 MB)`);
  log(`Manifest ids: ${ordered.map((e) => e.id).join(', ')}`);
}

main().catch((err) => {
  warn(err.stack || err.message);
  process.exit(1);
});
