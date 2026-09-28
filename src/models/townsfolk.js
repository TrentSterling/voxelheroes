// Accessories that make each townsperson their own on the shared hero body (16 x 16 x 16, faces +z;
// head x 3..12, y 8..14, z 4..11, face on z 11 rows y 8..10, spiky hair on y 15; torso x 4..11,
// y 2..7, z 5..9). dress(grid, extras, S) adds them to a copy of a pose grid, with per-face shading
// (boxels): lit tops, darker trims.
//
//   palette.extras: ['straw-hat', 'beard'], palette.kid: true   (see models/hero.js makeHero)
import { DenseGrid, mulHex } from '../core/vox.js';

const PY = 2, PZ = 4;
export const EXTRAS = ['straw-hat', 'hood', 'crown', 'helm', 'beard', 'apron', 'glasses', 'bun', 'scarf'];

function copy(g) {
  const c = new DenseGrid(g.sx, g.sy, g.sz);
  c.data.set(g.data);
  if (g.faces) c.faces = new Map(g.faces);
  return c;
}

// light the up-facing faces of every voxel of `col` (they read from the game camera)
function litTops(g, col, k = 1.25) {
  for (let z = 0; z < g.sz; z++) for (let y = 0; y < g.sy; y++) for (let x = 0; x < g.sx; x++)
    if (g.has(x, y, z) && g.color(x, y, z) === col && !g.has(x, y + 1, z)) g.setFace(x, y, z, PY, mulHex(col, k));
}

// keep the face (skin and eyes on the front layer) when a head covering goes over it
function keepFace(g, from) {
  for (let y = 8; y <= 10; y++) for (let x = 4; x <= 11; x++) g.data[g.i(x, y, 11)] = from.data[from.i(x, y, 11)];
}

const DRESS = {
  'straw-hat': (g, S, c = 0xd9b45a) => {
    g.clear(3, 15, 3, 13, 16, 12); // the spikes go under the hat
    g.box(1, 13, 2, 15, 14, 14, c); // brim
    g.box(4, 14, 4, 12, 16, 11, c); // crown
    g.box(4, 14, 4, 12, 15, 11, 0x8a4a2a); // band
    litTops(g, c, 1.2);
  },
  hood: (g, S, c = 0x5a6a4a, from) => {
    g.clear(3, 15, 3, 13, 16, 12);
    g.box(2, 8, 3, 14, 15, 12, c);
    g.box(3, 15, 4, 13, 16, 11, c);
    keepFace(g, from);
    litTops(g, c, 1.2);
  },
  crown: (g, S, c = 0xe6b43a) => {
    g.clear(3, 15, 3, 13, 16, 12);
    g.box(4, 14, 5, 12, 15, 11, c);
    for (const [x, z] of [[4, 5], [7, 5], [10, 5], [4, 10], [10, 10], [7, 10]]) g.box(x, 15, z, x + 2, 16, z + 1, c);
    g.setFace(7, 14, 10, PZ, 0xd0303a).setFace(8, 14, 10, PZ, 0xd0303a); // a ruby at the front
    litTops(g, c, 1.3);
  },
  helm: (g, S, c = 0x8a8e98) => {
    g.clear(3, 15, 3, 13, 16, 12);
    g.box(3, 12, 4, 13, 15, 12, c);
    g.box(4, 15, 5, 12, 16, 11, c);
    g.box(7, 11, 11, 9, 13, 12, c); // nose guard
    litTops(g, c, 1.35);
  },
  beard: (g, S, c = 0xd8d8d8) => {
    g.box(4, 6, 10, 12, 9, 11, c);
    g.box(5, 5, 10, 11, 6, 11, c);
    g.box(5, 7, 11, 11, 8, 12, c); // proud under the face
    g.box(4, 8, 11, 5, 9, 12, c);
    g.box(11, 8, 11, 12, 9, 12, c);
    litTops(g, c, 1.15);
  },
  apron: (g, S, c = 0xe8e0cc) => {
    g.box(5, 2, 10, 11, 7, 11, c);
    g.box(6, 7, 10, 7, 8, 11, c);
    g.box(9, 7, 10, 10, 8, 11, c);
    for (let x = 5; x < 11; x++) g.setFace(x, 4, 10, PZ, mulHex(c, 0.8)); // a pocket seam
    litTops(g, c, 1.1);
  },
  glasses: (g, S, c = 0x2a2a30) => {
    for (const x0 of [5, 8]) {
      g.box(x0, 9, 12, x0 + 3, 10, 13, c);
      g.box(x0, 10, 12, x0 + 1, 11, 13, c);
      g.box(x0 + 2, 10, 12, x0 + 3, 11, 13, c);
    }
    g.setFace(6, 10, 12, PZ, 0xbfe6ff).setFace(9, 10, 12, PZ, 0xbfe6ff);
  },
  bun: (g, S) => {
    const c = S.hair;
    g.box(6, 13, 1, 10, 16, 4, c);
    g.box(7, 12, 2, 9, 13, 4, c);
    litTops(g, c, 1.3);
  },
  scarf: (g, S, c = 0xc0503a) => {
    g.box(4, 7, 4, 12, 8, 11, c);
    g.box(9, 4, 10, 11, 7, 11, c); // the tail at the front
    litTops(g, c, 1.2);
  },
};

// extras: names from EXTRAS, or [name, colour] pairs
export function dress(grid, extras, S) {
  if (!extras?.length) return grid;
  const g = copy(grid);
  const from = copy(grid);
  for (const e of extras) {
    const [name, col] = Array.isArray(e) ? e : [e, undefined];
    DRESS[name]?.(g, S, col, from);
  }
  return g;
}
