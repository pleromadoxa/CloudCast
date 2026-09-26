#!/usr/bin/env node
/**
 * Fetches CC0 (public-domain) photoreal models from Poly Haven into
 * `public/models/<id>/` for the Regal Prism virtual-set elements library.
 *
 * Usage:
 *   node tools/fetch-ph-models.mjs           # download any missing models
 *   node tools/fetch-ph-models.mjs --force   # re-download everything
 *
 * Licensing: all Poly Haven models are CC0 — no attribution required.
 * Each model is stored as a 1k-texture glTF plus its external texture maps,
 * preserving the relative paths referenced inside the .gltf file.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Curated virtual-set essentials: [polyHavenId, targetHeightMetres] */
const MODELS = [
  // seating
  ['mid_century_lounge_chair', 0.78],
  ['modern_arm_chair_01', 0.82],
  ['ArmChair_01', 0.92],
  ['Sofa_01', 0.82],
  ['dining_chair_02', 0.84],
  ['bar_chair_round_01', 1.05],
  ['Ottoman_01', 0.44],
  ['wooden_stool_01', 0.45],
  // tables
  ['modern_coffee_table_01', 0.42],
  ['modern_coffee_table_02', 0.4],
  ['WoodenTable_01', 0.75],
  ['dining_table', 0.76],
  // plants
  ['potted_plant_01', 1.05],
  ['potted_plant_02', 0.9],
  ['fern_02', 0.75],
  ['pachira_aquatica_01', 1.6],
  // decor
  ['Television_01', 0.78],
  ['throw_pillows_01', 0.28],
  ['book_encyclopedia_set_01', 0.3],
  ['ornate_mirror_01', 1.35],
  ['marble_bust_01', 0.6],
  ['Shelf_01', 1.9],
  // lighting
  ['desk_lamp_arm_01', 0.55],
  ['modern_ceiling_lamp_01', 0.45],
  ['Chandelier_01', 0.9],
  // —— second wave: studio props, office gear, decor, plants, lighting ——
  // furniture
  ['Rockingchair_01', 0.95],
  ['SchoolChair_01', 0.82],
  ['SchoolDesk_01', 0.74],
  ['ClassicConsole_01', 0.85],
  ['ClassicNightstand_01', 0.68],
  ['drawer_cabinet', 1.1],
  ['modern_wooden_cabinet', 1.15],
  ['painted_wooden_bench', 0.85],
  ['metal_office_desk', 0.76],
  ['metal_stool_01', 0.72],
  ['WoodenTable_02', 0.75],
  ['coffee_table_round_01', 0.45],
  ['industrial_coffee_table', 0.45],
  ['chinese_sofa', 0.82],
  // decor
  ['ceramic_vase_02', 0.32],
  ['brass_vase_01', 0.3],
  ['fancy_picture_frame_01', 0.55],
  ['standing_picture_frame_01', 0.5],
  ['mantel_clock_01', 0.35],
  ['vintage_grandfather_clock_01', 2.1],
  ['wicker_basket_01', 0.35],
  ['planter_box_01', 0.5],
  ['chess_set', 0.18],
  ['horse_statue_01', 0.45],
  ['ceramic_pot', 0.28],
  ['wooden_crate_01', 0.3],
  // studio props & electronics
  ['Camera_01', 0.55],
  ['Megaphone_01', 0.3],
  ['alarm_clock_01', 0.2],
  ['american_football', 0.16],
  ['football', 0.22],
  ['gamepad', 0.07],
  ['classic_laptop', 0.25],
  ['vintage_video_camera', 0.5],
  ['vintage_radio_transceiver', 0.35],
  ['boombox', 0.3],
  ['binoculars', 0.14],
  ['gaming_console', 0.1],
  ['filmstrip_projector_8mm', 0.35],
  ['CoffeeCart_01', 1.2],
  // lighting
  ['Chandelier_02', 0.85],
  ['hanging_industrial_lamp', 0.5],
  ['industrial_wall_lamp', 0.35],
  // plants & nature
  ['potted_plant_04', 1.0],
  ['calathea_orbifolia_01', 0.8],
  ['anthurium_botany_01', 0.55],
  ['shrub_sorrel_01', 0.4],
  ['grass_medium_02', 0.25],
];

const FORCE = process.argv.includes('--force');
const ROOT = path.resolve(process.cwd(), 'public/models');

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return buf.length;
}

async function fetchModel(id) {
  const dir = path.join(ROOT, id);
  const metaUrl = `https://api.polyhaven.com/files/${id}`;
  const meta = await (await fetch(metaUrl)).json();
  const entry = meta?.gltf?.['1k']?.gltf;
  if (!entry?.url) throw new Error(`no 1k gltf for ${id}`);

  const gltfName = path.basename(entry.url);
  const gltfPath = path.join(dir, gltfName);
  let total = 0;

  if (!FORCE && existsSync(gltfPath)) {
    // verify the previous run completed — every referenced file must exist
    const parsed = JSON.parse(await readFile(gltfPath, 'utf8'));
    const refs = [
      ...(parsed.images ?? []).map((i) => i.uri),
      ...(parsed.buffers ?? []).map((b) => b.uri),
    ];
    const missing = refs.filter((r) => !existsSync(path.join(dir, r)));
    if (missing.length === 0) {
      console.log(`skip   ${id} (already downloaded)`);
      return;
    }
    console.log(`repair ${id} (${missing.length} missing files)`);
  }

  total += await download(entry.url, gltfPath);
  for (const [rel, file] of Object.entries(entry.include ?? {})) {
    total += await download(file.url, path.join(dir, rel));
  }
  console.log(`fetched ${id} — ${(total / 1e6).toFixed(1)}MB -> public/models/${id}/`);
}

let failed = 0;
for (const [id] of MODELS) {
  try {
    await fetchModel(id);
  } catch (err) {
    failed += 1;
    console.error(`FAILED ${id}: ${err.message}`);
  }
}
console.log(failed ? `done with ${failed} failures` : 'done — all models fetched');
process.exit(failed ? 1 : 0);
