// Export the hand-built JS models to .boxel files that Boxel opens for editing, and check that
// each file reads back to the same grids (src/core/boxel.js).
//
//   node scripts/export-boxel.mjs          # writes assets/models/*.boxel, checks the round trip
//   node scripts/export-boxel.mjs --check  # also reads every Boxel gallery file as a reader test
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBoxel, toBoxel } from '../src/core/boxel.js';
import { heroGrid, HERO_POSES, HERO_SLOTS } from '../src/models/hero.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets', 'models');
mkdirSync(out, { recursive: true });

function sameGrid(a, b) {
  if (a.sx !== b.sx || a.sy !== b.sy || a.sz !== b.sz) return 'size';
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) return `voxel ${i}`;
  const fa = a.faces ?? new Map(), fb = b.faces ?? new Map();
  if (fa.size !== fb.size) return `faces ${fa.size} vs ${fb.size}`;
  for (const [k, c] of fa) if (fb.get(k) !== c) return `face ${k}`;
  return null;
}

let fail = 0;
function check(label, grids, text) {
  const back = parseBoxel(text).grids;
  for (const [name, g] of Object.entries(grids)) {
    const bad = back[name] ? sameGrid(g, back[name]) : 'missing';
    if (bad) { fail++; console.log(`FAIL ${label}/${name}: ${bad}`); }
  }
  console.log(`ok   ${label}: ${Object.keys(grids).length} matrices, ${text.length} bytes`);
}

// The hero, one matrix per pose, the seven colour slots named in the palette.
const hero = Object.fromEntries(HERO_POSES.map((p) => [p, heroGrid(p)]));
const heroText = toBoxel(hero, { names: HERO_SLOTS });
writeFileSync(join(out, 'hero.boxel'), heroText);
check('hero', hero, heroText);

// Face overrides survive the round trip (the stand pose with a gold top on the buckle).
const boxed = heroGrid('stand');
boxed.setFace(7, 3, 9, 2, 0xffe070).setFace(8, 3, 9, 2, 0xffe070).setFace(7, 3, 9, 4, 0x806020);
check('faces', { stand: boxed }, toBoxel({ stand: boxed }));

// Recolour by slot name, the way townspeople reuse the hero.
const npc = parseBoxel(heroText, { recolor: { tunic: 0x9a6a44 } }).grids.stand;
const want = heroGrid('stand', { ...HERO_SLOTS, tunic: 0x9a6a44 });
const bad = sameGrid(want, npc);
if (bad) { fail++; console.log(`FAIL recolor: ${bad}`); } else console.log('ok   recolor: tunic slot');

// Reader test against real Boxel files.
const gallery = 'C:/trontstack/boxel/gallery';
if (process.argv.includes('--check') && existsSync(gallery)) {
  let n = 0, faces = 0;
  for (const f of readdirSync(gallery).filter((f) => f.endsWith('.boxel'))) {
    try {
      const doc = parseBoxel(readFileSync(join(gallery, f), 'utf8'));
      for (const m of doc.matrices) { n++; faces += m.grid.faces?.size ?? 0; }
    } catch (e) { fail++; console.log(`FAIL gallery/${f}: ${e.message}`); }
  }
  console.log(`ok   gallery: ${n} matrices read, ${faces} face overrides`);
}

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
