// The far distance around overworld areas (art bible section 8, "The far distance"). The world
// continues past the play area, so the top of the frame in camera A shows distant plateaus and
// tree lines, with sky only in the corners. With distance from the play area the land steps up in
// terraces: the edge tiles continue for a tile, then forest on the ground, then plateaus two and
// four levels high with clumps of trees set back from their edges, so their tan cliff faces show
// between green tops (refs 28, 29, 30, 40: 27-51% tan in the top band), then a tree line on the
// four levels. Four levels plus a tree (5.6 tiles) stand taller than camera A (4.56 tiles), so they
// close the top of the frame. Seen over the play area's own border trees (1.5 tiles tall, about 19
// tiles from the camera), ground less than about 3 tiles high is hidden up to 10 tiles behind
// them, which is why the terraces rise to two levels at once and to four by 10 tiles out.
// The band reaches 12 tiles past the area's east, west and south edges (gameplay spec 4.2: cameras
// A and D follow the hero unclamped, and no void may show). South of the area it stays forest on
// the ground: the camera stands about 9 tiles south of the hero, above that band.
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

// Terraces by distance (tiles) from the play area: the level, how many rows of trees front it, the
// share of trees behind the front, and `clump`: trees stand in clumps (value noise over 3 tiles
// above a threshold, about 30% of the tiles) at least `back` tiles behind the terrace's edge.
const TERRACES = [
  { from: 2, level: 0, front: 1, share: 0.3 },
  { from: 5, level: 2, front: 0, clump: 0.62, back: 2 },
  { from: 10, level: 4, front: 0, clump: 0.62, back: 2 },
  { from: 16, level: 4, front: 3, share: 0.5 },
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
  south: 12,
  side: 12,
  sideMax: 28,
  charAt(tx, tz, { d, ds, edge }) {
    if (d <= 1) return continuation(edge);
    const w = d + (noise(tx, tz, 6, 17) - 0.5) * 4;
    let t = 0;
    if (ds === 0) while (t + 1 < TERRACES.length && w >= TERRACES[t + 1].from) t++;
    const T = TERRACES[t];
    const level = Math.max(T.level, levelOf(edge?.def));
    const [plain, tree] = BY_LEVEL[level];
    const into = w - T.from;
    if (into < T.front) return tree;
    if (T.clump !== undefined) return into >= T.back && noise(tx, tz, 3, 29 + t) > T.clump ? tree : plain;
    return hash3(tx, 5, tz, 23) < T.share ? tree : plain;
  },
});
