// Foes v2: the overworld roster and D1's gazer rebuilt as boxels (per-face colour, Boxel's
// model), same silhouettes and sizes as src/models/foes/foes.js so gameplay (hitboxes, pose
// keys) is unchanged. Writes assets/models/foes-v2.boxel, one matrix per '<foe>:<frame>' key.
// src/models/foes/foes.js loads this by default; ?foes=old falls back to the hand-coded models.
//
//   node scripts/art/foes-v2.mjs
//
// The game camera looks down from high, so the boxel pass leans on TOP and FRONT (+z) faces for
// the read: lit tops, a darker back/underside for weight, and a few bespoke glints and markings
// per creature (eyes, coin shine, iris ring, brow shadow). Coordinates as foes.js: x east, y up,
// z toward the camera; every model faces +z.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DenseGrid, mulHex } from '../../src/core/vox.js';
import { toBoxel, parseBoxel } from '../../src/core/boxel.js';
import { CP } from '../../src/models/palette.js';
import { C } from '../../src/models/foes/foes.js';

const PX = 0, NX = 1, PY = 2, NY = 3, PZ = 4, NZ = 5;
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// foes.js dithers its bodies with per-voxel hash noise (kit.js's jitter); a boxel's palette is
// capped at 255 colours, so this build keeps each material flat and lets paintGeneric's per-face
// shading (below) carry the texture instead. Same call signature so the shapes below read the
// same as foes.js's originals.
const jitter = (base) => base;

const isEye = (c) => c === CP.eye || c === CP.eyeHi || c === 0xffffff;

// The boxel pass: lit tops and fronts, a darker back and footing shadow. `skip` keeps a colour
// (eyes, a glow) out of the generic tint so a bespoke touch can shape it instead.
function paintGeneric(g, { top = 1.3, front = 1.12, shadow = 0.78, skip = () => false } = {}) {
  const open = (x, y, z, f) => !g.has(x + DIRS[f][0], y + DIRS[f][1], z + DIRS[f][2]);
  for (let z = 0; z < g.sz; z++) for (let y = 0; y < g.sy; y++) for (let x = 0; x < g.sx; x++) {
    if (!g.has(x, y, z)) continue;
    const c = g.color(x, y, z);
    if (skip(c, x, y, z)) continue;
    if (open(x, y, z, PY)) g.setFace(x, y, z, PY, mulHex(c, top));
    if (open(x, y, z, PZ)) g.setFace(x, y, z, PZ, mulHex(c, front));
    if (open(x, y, z, NZ)) g.setFace(x, y, z, NZ, mulHex(c, shadow));
    if (y === 0) for (const f of [PX, NX]) if (open(x, y, z, f)) g.setFace(x, y, z, f, mulHex(c, shadow));
  }
}

// ---------------------------------------------------------------- hopper
function hopper(frame = 0) {
  const g = new DenseGrid(14, 15, 14);
  const low = frame ? 1 : 0;
  g.ellipsoid(7, 4.5 - low, 6.5, 5, 4.5 - low, 5.5, (x, y, z) => (y < 2 ? C.furLo : jitter(C.fur, x, y, z, 0.05, 41)));
  g.ellipsoid(7, 8 - low, 9, 4, 3.5, 3.5, (x, y, z) => jitter(C.fur, x, y, z, 0.04, 43));
  g.box(5, 5 - low, 11, 9, 8 - low, 13, C.furHi);
  g.box(6, 7 - low, 12, 8, 8 - low, 13, C.nose);
  g.box(4, 8 - low, 11, 6, 10 - low, 12, CP.eyeHi);
  g.box(8, 8 - low, 11, 10, 10 - low, 12, CP.eyeHi);
  g.set(5, 8 - low, 12, CP.eye);
  g.set(8, 8 - low, 12, CP.eye);
  const ear = frame ? 3 : 5;
  g.box(4, 11 - low, 8, 6, 11 - low + ear, 10, C.fur);
  g.box(8, 11 - low, 8, 10, 11 - low + ear, 10, C.fur);
  g.box(4, 11 - low, 9, 5, 11 - low + ear, 10, C.nose);
  g.box(9, 11 - low, 9, 10, 11 - low + ear, 10, C.nose);
  g.box(6, 3, 0, 8, 5, 2, C.furHi);
  paintGeneric(g, { skip: isEye });
  g.setFace(6, 7 - low, 12, PZ, mulHex(C.nose, 1.4)).setFace(7, 7 - low, 12, PZ, mulHex(C.nose, 1.4));
  return g;
}

// ---------------------------------------------------------------- buzzer
function buzzer(frame = 0) {
  const g = new DenseGrid(18, 10, 12);
  g.ellipsoid(9, 4, 6, 4.5, 4, 5.5, (x, y, z) => (z % 3 === 0 ? C.waspLo : C.wasp));
  g.box(7, 3, 11, 11, 6, 12, C.waspLo);
  g.set(7, 5, 11, 0xffffff);
  g.set(10, 5, 11, 0xffffff);
  g.box(8, 0, 1, 10, 2, 3, C.waspLo);
  const up = frame ? 2 : 0;
  g.box(0, 6 + up, 3, 5, 7 + up, 9, C.wing);
  g.box(13, 6 + up, 3, 18, 7 + up, 9, C.wing);
  paintGeneric(g, { skip: isEye, top: 1.4 }); // wing plates and the striped back both want a strong top pop
  g.setFace(8, 0, 1, PZ, mulHex(C.waspLo, 1.5)); // the stinger's tip
  return g;
}

// ---------------------------------------------------------------- stump
function stump(awake = 0) {
  const g = new DenseGrid(16, 16, 16);
  const lift = awake ? 2 : 0;
  g.box(3, lift, 3, 13, 11 + lift, 13, (x, y, z) => jitter(x === 3 || x === 12 || z === 3 || z === 12 ? C.barkLo : C.bark, x, y >> 1, z, 0.08, 51));
  g.box(4, 11 + lift, 4, 12, 12 + lift, 12, (x, y, z) => ((Math.hypot(x - 7.5, z - 7.5) | 0) % 2 ? C.ring : C.barkLo));
  g.box(10, 12 + lift, 5, 12, 14 + lift, 7, C.leaf);
  if (awake) {
    for (const [x, z] of [[2, 4], [12, 4], [2, 11], [12, 11]]) g.box(x, 0, z, x + 2, 2, z + 1, C.barkLo);
    g.box(5, 7, 13, 7, 9, 14, C.glow);
    g.box(9, 7, 13, 11, 9, 14, C.glow);
    g.box(6, 4, 13, 10, 5, 14, C.barkLo);
  } else {
    g.box(5, 7, 13, 7, 8, 14, C.barkLo);
    g.box(9, 7, 13, 11, 8, 14, C.barkLo);
  }
  paintGeneric(g, { skip: (c) => c === C.glow, top: 1.22, shadow: 0.7 });
  if (awake) {
    g.setFace(5, 7, 13, PZ, mulHex(C.glow, 1.35)).setFace(9, 7, 13, PZ, mulHex(C.glow, 1.35));
    g.setFace(5, 8, 13, PZ, mulHex(C.glow, 1.5)).setFace(9, 8, 13, PZ, mulHex(C.glow, 1.5)); // the eyes' glow, hottest on top
  }
  g.setFace(11, 12 + lift, 6, PY, mulHex(C.leaf, 1.35)); // the sprout's tip
  return g;
}

// ---------------------------------------------------------------- archer
function archer(frame = 0) {
  const g = new DenseGrid(16, 16, 14);
  g.box(5, 0, 5, 7, 3, 8, C.hoodLo);
  g.box(9, 0, 5, 11, 3, 8, C.hoodLo);
  g.box(4, 3, 4, 12, 9, 9, (x, y, z) => jitter(C.hood, x, y, z, 0.05, 61));
  g.ellipsoid(8, 12, 6.5, 4.5, 4, 4.5, C.hood);
  g.box(5, 10, 10, 11, 13, 11, CP.skin);
  g.box(5, 11, 10, 7, 12, 11, CP.eye);
  g.box(9, 11, 10, 11, 12, 11, CP.eye);
  const draw = frame ? 2 : 0;
  g.box(1, 3, 9 + draw, 2, 12, 10 + draw, C.bow);
  g.box(1, 2, 10 + draw, 2, 3, 11 + draw, C.bow);
  g.box(1, 12, 10 + draw, 2, 13, 11 + draw, C.bow);
  g.box(2, 3, 11 - draw, 3, 12, 12 - draw, C.string);
  paintGeneric(g, { skip: isEye });
  g.setFace(8, 15, 6, PY, mulHex(C.hood, 1.35)); // the hood's crown, the tallest point
  return g;
}

// ---------------------------------------------------------------- leaper
function leaper(frame = 0) {
  const g = new DenseGrid(16, 12, 16);
  g.ellipsoid(8, 5, 8, 4, 3.5, 6, (x, y, z) => (y < 4 ? C.cricketLo : jitter(C.cricket, x, y, z, 0.05, 71)));
  g.ellipsoid(8, 6, 13, 3, 3, 2.5, C.cricket);
  g.box(6, 6, 15, 7, 8, 16, CP.eye);
  g.box(9, 6, 15, 10, 8, 16, CP.eye);
  g.box(7, 9, 13, 8, 12, 14, C.cricketLo);
  g.box(9, 9, 13, 10, 12, 14, C.cricketLo);
  const k = frame ? 3 : 0;
  for (const x of [2, 13]) {
    g.box(x, 4 + (frame ? 0 : 3), 3, x + 1, 9 - k, 5, C.cricketLo);
    g.box(x, 0, 1 + k, x + 1, 5, 3 + k, C.cricketLo);
  }
  paintGeneric(g, { skip: isEye });
  g.setFace(7, 11, 13, PZ, mulHex(C.cricketLo, 1.3)).setFace(9, 11, 13, PZ, mulHex(C.cricketLo, 1.3)); // feeler tips
  return g;
}

// ---------------------------------------------------------------- guardian
function guardian(frame = 0) {
  const g = new DenseGrid(20, 20, 18);
  const s = frame ? 1 : 0;
  g.box(4, 0, 6 + s, 8, 4, 11 + s, C.stoneLo);
  g.box(12, 0, 6 - s, 16, 4, 11 - s, C.stoneLo);
  g.box(3, 4, 4, 17, 14, 14, (x, y, z) => jitter(C.stone, x >> 1, y >> 1, z >> 1, 0.06, 81));
  g.box(5, 14, 5, 15, 19, 13, C.stoneHi);
  g.box(6, 16, 13, 14, 17, 14, C.rune);
  g.ellipsoid(10, 9, 15, 5, 4.5, 1.5, C.stoneLo);
  g.box(9, 7, 16, 11, 11, 17, C.rune);
  g.box(0, 6, 7, 3, 12, 11, C.stoneLo);
  g.box(17, 6, 7, 20, 12, 11, C.stoneLo);
  paintGeneric(g, { skip: (c) => c === C.rune, front: 1.18 });
  g.setFace(9, 9, 17, PZ, mulHex(C.rune, 1.4)).setFace(10, 9, 17, PZ, mulHex(C.rune, 1.4)); // the shield's rune, lit from the front
  g.setFace(10, 17, 14, PZ, mulHex(C.rune, 1.35)); // the brow rune
  return g;
}

// ---------------------------------------------------------------- treasure-slime (gold blob)
function goldBlob(frame = 0) {
  const h = frame ? 7 : 9;
  const rx = frame ? 7 : 6;
  const g = new DenseGrid(16, 13, 16);
  g.ellipsoid(8, 0, 8, rx, h, rx, (x, y, z) => (y > h - 3 ? C.goldHi : y < 2 ? C.goldLo : jitter(C.gold, x, y, z, 0.06, 91)));
  g.stampFront(5, (frame ? 3 : 4) + 1, ['WW..WW', 'KW..KW'], { W: CP.eyeHi, K: CP.eye });
  g.box(6, h, 7, 10, h + 3, 9, C.goldLo);
  g.box(7, h + 1, 7, 9, h + 2, 9, C.goldHi);
  paintGeneric(g, { skip: isEye, top: 1.35 });
  g.setFace(7, h + 2, 7, PY, mulHex(C.goldHi, 1.45)).setFace(8, h + 2, 7, PY, mulHex(C.goldHi, 1.45)); // the coin's shine
  return g;
}

// ---------------------------------------------------------------- wyrm
function wyrm(frame = 0) {
  const g = new DenseGrid(24, 18, 30);
  const s = frame ? 1 : 0;
  g.ellipsoid(12, 7, 12, 8, 6, 10, (x, y, z) => (y < 4 ? C.wyrmBelly : jitter(C.wyrm, x, y, z, 0.06, 101)));
  g.ellipsoid(12, 10, 24, 6, 5, 5.5, C.wyrm);
  g.box(8, 6, 27, 16, 9, 30, C.wyrmLo);
  g.box(9, 8, 29, 10, 9, 30, C.fang);
  g.box(14, 8, 29, 15, 9, 30, C.fang);
  g.box(8, 11, 28, 10, 13, 29, C.glow);
  g.box(14, 11, 28, 16, 13, 29, C.glow);
  g.box(7, 14, 21, 9, 18, 23, C.horn);
  g.box(15, 14, 21, 17, 18, 23, C.horn);
  for (const [x, z] of [[4, 6], [18, 6], [4, 16], [18, 16]]) g.box(x, 0, z + (x < 12 ? s : -s), x + 3, 3, z + 3 + (x < 12 ? s : -s), C.wyrmLo);
  g.box(10, 4, 0, 14, 7, 4, C.wyrmLo);
  for (let z = 4; z < 20; z += 3) g.box(11, 13, z, 13, 14, z + 2, C.horn);
  paintGeneric(g, { skip: (c) => c === C.glow, top: 1.25, front: 1.1 });
  g.setFace(8, 12, 28, PZ, mulHex(C.glow, 1.4)).setFace(15, 12, 28, PZ, mulHex(C.glow, 1.4)); // eyes lit from the front
  g.setFace(7, 17, 22, PY, mulHex(C.horn, 1.4)).setFace(16, 17, 22, PY, mulHex(C.horn, 1.4)); // horn tips
  return g;
}

// ---------------------------------------------------------------- gazer
function gazer(open = 1) {
  const g = new DenseGrid(14, 14, 14);
  g.ellipsoid(7, 7, 7, 6, 6, 6, (x, y, z) => (z > 9 ? CP.eyeHi : jitter(C.lid, x, y, z, 0.05, 111)));
  if (open) {
    g.box(5, 5, 12, 9, 9, 14, C.iris);
    g.box(6, 6, 13, 8, 8, 14, CP.eye);
  } else g.box(2, 3, 10, 12, 11, 14, (x, y) => (y === 7 ? C.lidLo : C.lid));
  g.box(3, 12, 5, 11, 14, 9, C.lidLo);
  paintGeneric(g, { skip: (c) => c === CP.eyeHi || c === C.iris || c === CP.eye, top: 1.28 });
  if (open) g.setFace(7, 7, 14, PZ, mulHex(C.iris, 1.35)).setFace(6, 8, 14, PZ, mulHex(C.iris, 1.25)).setFace(8, 8, 14, PZ, mulHex(C.iris, 1.25)); // the iris ring, lit
  for (let x = 3; x < 11; x++) for (let z = 5; z < 9; z++) g.setFace(x, 13, z, PZ, mulHex(C.lidLo, 0.8)); // the brow ridge, shadowed
  return g;
}

// ---------------------------------------------------------------- write the file
const BUILDERS = { hopper, buzzer, stump, archer, leaper, guardian, goldblob: goldBlob, wyrm, gazer };
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const grids = {};
for (const [name, build] of Object.entries(BUILDERS)) {
  grids[`${name}:0`] = build(0);
  grids[`${name}:1`] = build(1);
}
const text = toBoxel(grids);
mkdirSync(join(root, 'assets', 'models'), { recursive: true });
writeFileSync(join(root, 'assets', 'models', 'foes-v2.boxel'), text);
const back = parseBoxel(text);
const faces = Object.values(back.grids).reduce((n, g) => n + (g.faces?.size ?? 0), 0);
console.log(`foes-v2.boxel: ${Object.keys(grids).length} matrices (${Object.keys(BUILDERS).length} foes x 2 frames), ${faces} face overrides, ${back.colors.length} palette colours`);
