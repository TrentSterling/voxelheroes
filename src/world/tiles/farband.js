// The far distance around overworld areas (art bible section 8, "The far distance"). The world
// continues past the play area, so the top of the frame in camera A shows distant plateaus and
// tree lines, with sky only in the corners. With distance from the play area the land steps up in
// terraces: the edge tiles continue for a tile, then forest on the ground, then plateaus one,
// two and four levels high, each fronted by a tree line. Four levels plus a tree (5.6 tiles) stand
// taller than camera A (4.56 tiles), so they close the top of the frame.
//
// The backdrop is built from ordinary overworld tiles (world/tiles/overworld.js) by terrain.js,
// in chunks of 8 x 8 tiles, and nobody can walk there.
import { hash3 } from '../../core/vox.js';
import { registerBackdrop } from '../terrain.js';

// Smooth value noise in [0, 1] on a lattice of `cell` tiles.
function noise(tx, tz, cell, seed) {
  const fx = tx / cell;
  const fz = tz / cell;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  let ux = fx - ix;
  let uz = fz - iz;
  ux = ux * ux * (3 - 2 * ux);
  uz = uz * uz * (3 - 2 * uz);
  const h = (a, b) => hash3(a, 0, b, seed);
  const top = h(ix, iz) * (1 - ux) + h(ix + 1, iz) * ux;
  const bottom = h(ix, iz + 1) * (1 - ux) + h(ix + 1, iz + 1) * ux;
  return top * (1 - uz) + bottom * uz;
}

// Tiles by level: [plain, with a tree].
const BY_LEVEL = { 0: ['.', 'T'], 1: ['#', 'u'], 2: ['2', 't'], 4: ['4', 'w'] };

// Terraces by distance (tiles) from the play area: the level, how many rows of trees front it and
// the share of trees behind the front.
const TERRACES = [
  { from: 2, level: 0, front: 1, share: 0.3 },
  { from: 6, level: 1, front: 1, share: 0.15 },
  { from: 11, level: 2, front: 1, share: 0.15 },
  { from: 15, level: 4, front: 2, share: 0 },
];

const levelOf = (def) => Math.min(2, def?.level ?? 0);

// The edge tile carried on past the play area: trees stay trees, raised ground stays raised,
// water keeps flowing, open ground stays open.
function continuation(edge) {
  const d = edge?.def;
  if (!d) return 'T';
  if (d.water) return '~';
  const lv = levelOf(d);
  if (lv > 0) return BY_LEVEL[lv][0];
  return d.solid ? 'T' : '.';
}

registerBackdrop('overworld', {
  north: 19,
  south: 0,
  side: 3,
  sideMax: 16,
  charAt(tx, tz, { d, dn, ds, edge }) {
    if (d <= 1) return continuation(edge);
    const w = d + (noise(tx, tz, 6, 17) - 0.5) * 4;
    let t = 0;
    while (t + 1 < TERRACES.length && w >= TERRACES[t + 1].from) t++;
    const T = TERRACES[t];
    const level = Math.max(T.level, levelOf(edge?.def));
    const [plain, tree] = BY_LEVEL[level];
    if (w - T.from < T.front) return tree;
    return hash3(tx, 5, tz, 23) < T.share ? tree : plain;
  },
});
