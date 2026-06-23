// Seed the existing curated balloon-garland photos into the gallery R2 bucket,
// so Hannah can manage/remove them on /upload just like new uploads.
//
// It reads the current GALLERY list out of store.html (so it stays in sync),
// then POSTs each image to the gallery-upload endpoint — newest-last so the
// original curated order is preserved (first item ends up showing first).
//
// Usage:
//   Local (against `wrangler pages dev`, default http://localhost:8788):
//     node tools/seed-gallery.mjs
//   Production:
//     GALLERY_BASE_URL=https://your-site GALLERY_UPLOAD_PASSWORD=... node tools/seed-gallery.mjs
//
// Env:
//   GALLERY_BASE_URL          default http://localhost:8788
//   GALLERY_UPLOAD_PASSWORD   default "hooray-local-dev" (the .dev.vars value)

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.GALLERY_BASE_URL || 'http://localhost:8788';
const PASSWORD = process.env.GALLERY_UPLOAD_PASSWORD || 'hooray-local-dev';

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

async function getCuratedList() {
  const html = await readFile(path.join(ROOT, 'store.html'), 'utf8');
  const m = html.match(/const GALLERY = \[([\s\S]*?)\];/);
  if (!m) throw new Error('Could not find the GALLERY array in store.html');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

async function seed() {
  const list = await getCuratedList();
  console.log(`Found ${list.length} curated photos. Seeding ${BASE} …`);
  // Reverse: upload the last curated photo first so the first one gets the
  // newest timestamp and leads the gallery (gallery-list sorts newest-first).
  let ok = 0, fail = 0;
  for (const rel of [...list].reverse()) {
    const abs = path.join(ROOT, rel);
    try {
      const buf = await readFile(abs);
      const ext = path.extname(rel).toLowerCase();
      const type = TYPES[ext] || 'image/jpeg';
      const fd = new FormData();
      fd.append('password', PASSWORD);
      fd.append('photos', new Blob([buf], { type }), path.basename(rel));
      const res = await fetch(`${BASE}/api/gallery-upload`, { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      ok++; process.stdout.write('.');
    } catch (e) {
      fail++; console.warn(`\n  ✗ ${rel}: ${e.message}`);
    }
  }
  console.log(`\nDone. ${ok} uploaded, ${fail} failed.`);
}

seed().catch((e) => { console.error(e); process.exit(1); });
