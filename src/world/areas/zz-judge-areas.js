// SCRATCH ONLY (never committed): the look lab's comparison maps (art bible section 13) as overworld
// areas, registered only with ?judge=1, so the look can be measured beside the lab renders and the
// references. Lab legend -> game tiles.
import { registerArea } from '../areas.js';

const on = typeof location !== 'undefined' && new URLSearchParams(location.search).has('judge');

const grid = (W, D, c = '.') => Array.from({ length: D }, () => Array(W).fill(c));
const rect = (m, x0, z0, x1, z1, c) => { for (let z = Math.max(0, z0); z < Math.min(m.length, z1); z++) for (let x = Math.max(0, x0); x < Math.min(m[0].length, x1); x++) m[z][x] = c; };
const hsh = (x, z, s = 0) => Math.abs(Math.sin(x * 12.9898 + z * 78.233 + s * 37.719) * 43758.5453) % 1;
const rowsOf = (m) => m.map((r) => r.join(''));
function map29() {
  const W = 44, D = 64, m = grid(W, D);
  rect(m, 0, 0, W, 8, 'w'); rect(m, 0, 8, W, 24, 't');
  for (let z = 8; z < 24; z++) for (let x = 0; x < W; x++) if (hsh(x, z) < 0.25) m[z][x] = '2';
  rect(m, 0, 24, 18, D, '1'); rect(m, 29, 24, W, D, '1');
  rect(m, 0, 24, W, 27, '2');
  rect(m, 18, 30, 25, 34, '1');
  rect(m, 3, 33, 9, 36, ';'); rect(m, 6, 40, 12, 42, ';'); rect(m, 31, 30, 36, 33, ';');
  for (let z = 27; z < D; z++) for (let x = 0; x < W; x++) if (m[z][x] === '1' && hsh(x, z, 1) < 0.08) m[z][x] = ';';
  rect(m, 0, 27, 6, 31, 'u'); rect(m, 38, 27, W, 31, 'u');
  return rowsOf(m);
}
function map28() {
  const W = 44, D = 64, m = grid(W, D);
  rect(m, 0, 0, W, 8, 'w'); rect(m, 0, 8, W, 22, 't');
  rect(m, 0, 22, 14, D, '2'); rect(m, 0, 22, 10, 30, 't');
  for (let z = 0; z < D; z++) {
    const bx = Math.round(23.5 + 0.32 * (z - 45));
    for (let x = bx; x < bx + 5; x++) if (x >= 0 && x < W && z >= 20) m[z][x] = '~';
    if (z >= 20) for (let x = bx + 5; x < W; x++) if (x > bx + 7 && hsh(x, z) < 0.5) m[z][x] = 'T';
    if (z >= 20 && bx + 6 < W) m[z][bx + 6] = z > 30 && z < 44 ? 'F' : m[z][bx + 6];
  }
  for (let z = 47; z < 49; z++) for (let x = 0; x < W; x++) if (m[z][x] === '~') m[z][x] = 'b';
  rect(m, 17, 30, 20, 44, '='); rect(m, 20, 34, 22, 38, '='); rect(m, 15, 40, 18, 44, '=');
  return rowsOf(m);
}
const LEGEND = { '.': '.', 1: '#', 2: '2', 4: '4', w: 'w', t: 't', u: 'u', ';': '#', '=': 'd', '~': '~', b: '=', F: 'f', T: 'T', B: 'B', R: 'R', C: 'D', ':': '^' };
const PAD = 16;
function area(id, origin, rows) {
  const padded = rows.map((r) => r[0].repeat(PAD) + r + r[r.length - 1].repeat(PAD));
  const W = 80, H = 66;
  const full = [];
  for (let z = 0; z < H; z++) {
    const r = padded[Math.min(z, padded.length - 1)];
    let s = '';
    for (let x = 0; x < W; x++) s += LEGEND[r[Math.min(x, r.length - 1)]] ?? '.';
    full.push(s);
  }
  const screens = {};
  for (let sy = 0; sy < H / 11; sy++)
    for (let sx = 0; sx < W / 16; sx++)
      screens[`${sx},${sy}`] = { name: `${id} ${sx},${sy}`, rows: full.slice(sy * 11, sy * 11 + 11).map((r) => r.slice(sx * 16, sx * 16 + 16)) };
  registerArea({ id, name: id, tileset: 'overworld', lighting: 'day', origin, start: [2, 4], screens });
}
if (on) {
  area('judge29', [100, 0], map29()); // hero at global tile (100*16 + 38.8, 46.5): screen 2,4 local 6.8, 2.5
  area('judge28', [110, 0], map28()); // hero at (37.5, 46.0): screen 2,4 local 5.5, 2.0
}
