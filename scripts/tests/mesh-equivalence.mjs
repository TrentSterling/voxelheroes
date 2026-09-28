// The fast meshVoxels must match the reference mesher (mesh-ref.mjs) exactly: every attribute and
// index, on hero poses with boxel faces and on random grids through every option. Also times both.
//   node scripts/tests/mesh-equivalence.mjs
import { DenseGrid, meshVoxels, hash3 } from '../../src/core/vox.js';
import { meshVoxelsRef } from './mesh-ref.mjs';
import { heroGrid, HERO_POSES } from '../../src/models/hero.js';

let fail = 0, cases = 0;
function same(label, grid, opts) {
  cases++;
  const a = meshVoxelsRef(grid, opts), b = meshVoxels(grid, opts);
  for (const k of ['position', 'normal', 'color', 'faceUv']) {
    const x = a.getAttribute(k).array, y = b.getAttribute(k).array;
    if (x.length !== y.length) { fail++; console.log(`FAIL ${label} ${k} length ${x.length} vs ${y.length}`); return; }
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) { fail++; console.log(`FAIL ${label} ${k}[${i}] ${x[i]} vs ${y[i]}`); return; }
  }
  const x = a.index.array, y = b.index.array;
  if (x.constructor !== y.constructor || x.length !== y.length || x.some((v, i) => v !== y[i])) { fail++; console.log(`FAIL ${label} index`); }
}

for (const p of HERO_POSES) {
  const g = heroGrid(p);
  same(`hero ${p}`, g, {});
  g.setFace(7, 3, 9, 2, 0xffe070).setFace(4, 5, 9, 4, 0x223344);
  same(`hero ${p} faces`, g, {});
}

const rand = (sx, sy, sz, fill, seed) => {
  const g = new DenseGrid(sx, sy, sz);
  for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++)
    if (hash3(x, y, z, seed) < fill) g.set(x, y, z, Math.floor(hash3(x, y, z, seed + 1) * 8) * 0x1f2f3f);
  for (let i = 0; i < 40; i++) g.setFace(i % sx, (i * 3) % sy, (i * 7) % sz, i % 6, 0x10a0f0);
  return g;
};
const nb = (x, y, z) => hash3(x, y, z, 99) < 0.5;
for (const [i, fill] of [0.2, 0.5, 0.8].entries()) {
  const g = rand(24, 12, 20, fill, i * 10);
  same(`rand${i}`, g, {});
  same(`rand${i} nb`, g, { neighbors: nb });
  same(`rand${i} region`, g, { region: [3, 1, 2, 19, 10, 17], neighbors: nb });
  same(`rand${i} faces`, g, { faces: 1 | 4 | 16 });
  same(`rand${i} skip`, g, { skipBottom: 3, scale: 1 / 8, origin: [0, 0, 0] });
  same(`rand${i} skipAll noAO`, g, { skipBottom: true, ao: false });
}
same('thin', rand(1, 30, 1, 0.9, 5), { neighbors: nb });
same('big (Uint32 index)', rand(64, 40, 64, 0.35, 7), {});

// Timing on a terrain-like grid.
const T = new DenseGrid(128, 24, 96);
for (let z = 0; z < 96; z++) for (let x = 0; x < 128; x++) {
  const h = 4 + Math.floor(hash3(x >> 2, 0, z >> 2, 3) * 10);
  for (let y = 0; y < h; y++) T.set(x, y, z, 0x3a8a3a + (y << 8));
}
const time = (fn) => { fn(); const t = performance.now(); for (let i = 0; i < 5; i++) fn(); return (performance.now() - t) / 5; };
const ref = time(() => meshVoxelsRef(T, { skipBottom: true }));
const fast = time(() => meshVoxels(T, { skipBottom: true }));
same('terrain', T, { skipBottom: true });
console.log(`terrain 128x24x96: ref ${ref.toFixed(1)} ms, fast ${fast.toFixed(1)} ms (${(ref / fast).toFixed(1)}x)`);
console.log(fail ? `${fail} of ${cases} cases FAILED` : `all ${cases} cases identical`);
process.exit(fail ? 1 : 0);
