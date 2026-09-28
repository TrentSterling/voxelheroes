// The title's key art: "VOXEL HEROES" as a boxel logo standing in the courtyard. A 5 x 7 pixel face
// extruded 3 voxels deep, gold on the front, bright on top, amber on the sides, over a dark outline
// plate one voxel wider all round (per-face colour: the boxel look).
import { DenseGrid } from '../core/vox.js';
import { model, modelMesh } from './kit.js';

const FONT = {
  V: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  X: ['10001', '01010', '01010', '00100', '01010', '01010', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  ' ': ['000', '000', '000', '000', '000', '000', '000'],
};
const GOLD = 0xf2c14e, TOP = 0xffe79a, SIDE = 0x8a5418, UNDER = 0x5a3610, OUTLINE = 0x2a1a0c, OUT_TOP = 0x5a3a1a;
const PX = 0, NX = 1, PY = 2, NY = 3, PZ = 4;

function logoGrid(text) {
  const glyphs = [...text].map((c) => FONT[c] ?? FONT[' ']);
  const W = glyphs.reduce((w, g) => w + g[0].length + 1, 1) + 2;
  const H = 7 + 4;
  const D = 4; // outline plate at z 0..1, letters at z 2..3
  const g = new DenseGrid(W, H, D);
  // letters: z 1..3 (3 deep), x from 2, y from 2 (a margin for the outline)
  const on = new Set();
  let x0 = 2;
  for (const rows of glyphs) {
    rows.forEach((row, r) => [...row].forEach((c, i) => c === '1' && on.add(`${x0 + i},${2 + 6 - r}`)));
    x0 += rows[0].length + 1;
  }
  for (const k of on) {
    const [x, y] = k.split(',').map(Number);
    g.box(x, y, 2, x + 1, y + 1, 4, GOLD); // 2 deep: shallow sides keep the strokes crisp
  }
  // the outline plate at z 0: the letters dilated by one voxel
  for (const k of on) {
    const [x, y] = k.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) g.box(x + dx, y + dy, 0, x + dx + 1, y + dy + 1, 2, OUTLINE);
  }
  // per-face shading
  for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!g.has(x, y, z)) continue;
    const letter = z > 1;
    if (!g.has(x, y + 1, z)) g.setFace(x, y, z, PY, letter ? TOP : OUT_TOP);
    if (!g.has(x, y - 1, z)) g.setFace(x, y, z, NY, letter ? UNDER : OUTLINE);
    if (letter) {
      if (!g.has(x + 1, y, z)) g.setFace(x, y, z, PX, SIDE);
      if (!g.has(x - 1, y, z)) g.setFace(x, y, z, NX, SIDE);
      if (z === 3 && (x + y) % 7 === 0) g.setFace(x, y, z, PZ, 0xfff4c8); // a glint here and there
    }
  }
  return g;
}

// A mesh standing on its bottom edge, centred on x, facing +z (towards the camera).
export function makeLogo(text = 'VOXEL HEROES', voxel = 0.13) {
  const m = model(`logo:${text}`, () => logoGrid(text), { scale: voxel });
  const mesh = modelMesh(m);
  mesh.name = 'title-logo';
  return mesh;
}
