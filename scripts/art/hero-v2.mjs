// Hero v2: the hero rebuilt as boxels (per-face colour, Boxel's model) on the art bible's body plan
// (section 10: 16 x 16 x 16, head rows 0-7, face 8 wide, 1 x 2 eyes at columns 6 and 9, legs 2 wide
// with a 2-voxel gap). Writes assets/models/hero-v2.boxel, which Boxel opens for editing.
//
//   node scripts/art/hero-v2.mjs
//
// Per-face shades are named '<slot>*<k>' in the palette so a recoloured townsperson re-derives
// them from its own slot colours (src/core/boxel.js). Coordinates as src/models/hero.js: x east,
// y up, z toward the camera; the hero faces +z.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DenseGrid, mulHex, mixHex } from '../../src/core/vox.js';
import { toBoxel, parseBoxel } from '../../src/core/boxel.js';
import { HERO_POSES, HERO_SLOTS } from '../../src/models/hero.js';
import { CP } from '../../src/models/palette.js';

const PX = 0, NX = 1, PY = 2, NY = 3, PZ = 4, NZ = 5;
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

const base = { ...HERO_SLOTS, shieldRim: CP.shieldRim, shieldWood: CP.shieldWood, shieldMark: CP.shieldMark };
const names = { ...base };
// A shade of a slot (channels scaled, hue kept), recorded in the palette names so recolours follow it.
const sh = (slot, k) => {
  const c = mulHex(base[slot], k);
  names[`${slot}*${k}`] = c;
  return c;
};
const BLUSH = mixHex(base.skin, 0xf07a6a, 0.35);

function heroV2(frame) {
  const S = base;
  const g = new DenseGrid(16, 16, 16);
  const F = 11; // the face's front layer
  const step = frame === 'walk1' ? 1 : frame === 'walk2' ? -1 : 0;

  // Legs with a one-voxel toe cap forward.
  for (const [x0, s] of [[5, step], [9, -step]]) {
    g.box(x0, 0, 6 + s, x0 + 2, 2, 9 + s, S.leather);
    g.box(x0, 0, 9 + s, x0 + 2, 1, 10 + s, S.leather);
  }
  g.box(4, 2, 5, 12, 3, 10, S.tunic); // hem
  g.box(4, 3, 5, 12, 4, 10, S.leather); // belt
  g.box(4, 4, 5, 12, 8, 10, S.tunic); // torso
  g.box(7, 3, 9, 9, 4, 11, S.gold); // buckle, one voxel proud

  // Head: hair all round, spiky top, sideburn tufts (12 wide), headband ring and tails.
  g.box(3, 8, 4, 13, 15, 12, S.hair);
  for (const [x0, z0] of [[3, 5], [6, 4], [9, 6], [11, 4]]) g.box(x0, 15, z0, x0 + 2, 16, z0 + 4, S.hair);
  g.box(2, 8, 8, 3, 11, 11, S.hair);
  g.box(13, 8, 8, 14, 11, 11, S.hair);
  g.box(3, 12, 4, 13, 13, 12, S.band);
  g.box(6, 10, 3, 8, 12, 4, S.band);
  g.box(8, 9, 3, 10, 11, 4, S.band);
  g.box(4, 8, F, 12, 11, F + 1, S.skin); // face rows 5-7
  g.box(4, 10, F, 5, 11, F + 1, S.hair); // fringe points at the face's top corners
  g.box(11, 10, F, 12, 11, F + 1, S.hair);
  g.box(6, 9, F, 7, 11, F + 1, S.eye);
  g.box(9, 9, F, 10, 11, F + 1, S.eye);

  const hand = (x0, z0) => {
    g.box(x0, 6, z0, x0 + 2, 7, z0 + 3, S.tunic);
    g.box(x0, 4, z0, x0 + 2, 6, z0 + 3, S.skin);
  };
  if (frame === 'cheer') {
    for (const x0 of [1, 13]) {
      g.box(x0, 6, 6, x0 + 2, 13, 9, S.tunic);
      g.box(x0, 13, 6, x0 + 2, 15, 9, S.skin);
    }
  } else if (frame === 'swordOut') {
    g.box(2, 5, 6, 4, 7, 12, S.tunic);
    g.box(2, 5, 12, 4, 7, 14, S.skin);
    hand(12, 6);
  } else if (frame === 'item') {
    g.box(2, 7, 6, 4, 9, 12, S.tunic);
    g.box(2, 7, 12, 4, 10, 14, S.skin);
    hand(12, 6);
  } else if (frame === 'windUp') {
    g.box(1, 6, 4, 3, 13, 7, S.tunic);
    g.box(1, 13, 3, 3, 15, 6, S.skin);
    hand(12, 6);
  } else {
    hand(2, 6 - step);
    hand(12, 6 + step);
  }

  if (frame !== 'cheer') {
    g.box(10, 2, 10, 16, 8, 12, S.shieldRim);
    g.box(11, 3, 11, 15, 7, 12, S.shieldWood);
    g.box(12, 4, 11, 14, 6, 12, S.shieldMark);
  }

  paint(g);
  return g;
}

// The boxel pass: colour faces by what they are and which way they look.
function paint(g) {
  const open = (x, y, z, f) => !g.has(x + DIRS[f][0], y + DIRS[f][1], z + DIRS[f][2]);
  const S = base;
  for (let z = 0; z < 16; z++) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!g.has(x, y, z)) continue;
    const c = g.color(x, y, z);
    const face = (f, col) => { if (open(x, y, z, f)) g.setFace(x, y, z, f, col); };
    if (c === S.hair) {
      if (y === 15) face(PY, sh('hair', 1.3)); // spike tops pop against the crown from above
    } else if (c === S.tunic) {
      face(PY, sh('tunic', 1.18)); // shoulders and raised arms
      if (y === 2) for (const f of [PX, NX, PZ, NZ]) face(f, sh('tunic', 0.72)); // hem trim
    } else if (c === S.leather && y === 0 && z >= 9) {
      face(PY, sh('leather', 1.3)); // toe cap shine
    } else if (c === S.gold) {
      face(PY, sh('gold', 1.35));
    } else if (c === S.shieldRim) {
      face(PY, sh('shieldRim', 1.3));
    } else if (c === S.shieldWood && x % 2 === 0) {
      face(PZ, sh('shieldWood', 0.85)); // plank lines
    }
  }
  // Cheeks blush under the eyes.
  g.setFace(5, 8, 11, PZ, BLUSH).setFace(10, 8, 11, PZ, BLUSH);
  // Headband emblem and the V of the neckline.
  g.setFace(7, 12, 12 - 1, PZ, S.gold).setFace(8, 12, 11, PZ, S.gold);
  g.setFace(7, 7, 9, PZ, S.skin).setFace(8, 7, 9, PZ, S.skin);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const grids = Object.fromEntries(HERO_POSES.map((p) => [p, heroV2(p)]));
const text = toBoxel(grids, { names });
mkdirSync(join(root, 'assets', 'models'), { recursive: true });
writeFileSync(join(root, 'assets', 'models', 'hero-v2.boxel'), text);
const back = parseBoxel(text);
const faces = Object.values(back.grids).reduce((n, g) => n + (g.faces?.size ?? 0), 0);
console.log(`hero-v2.boxel: ${HERO_POSES.length} poses, ${grids.stand.count()} voxels (stand), ${faces} face overrides, ${Object.keys(names).length} named colours`);
