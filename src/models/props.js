// Prop models (art bible sections 8, 9 and 10). Character resolution (16 voxels per tile) unless a
// model says otherwise; every model faces +z (south, toward the camera) and stands on y = 0.
// Builders return a DenseGrid; the cached accessors at the bottom return models from kit.js
// ({ grid, geometry, colors }). Tile code places them as props (world/tilekit.js) or stamps the
// static ones into a screen's detail layer (VoxelLayer.stamp in world/terrain.js).
import { DenseGrid, hash3, shadeHex } from '../core/vox.js';
import { TP, GOLD, PROP } from '../world/palette.js';
import { model, jitter } from './kit.js';

// Mirror a grid left to right (x -> sx - 1 - x).
export function flipX(g) {
  const out = new DenseGrid(g.sx, g.sy, g.sz);
  for (let z = 0; z < g.sz; z++)
    for (let y = 0; y < g.sy; y++)
      for (let x = 0; x < g.sx; x++) {
        const v = g.get(x, y, z);
        if (v) out.data[out.i(g.sx - 1 - x, y, z)] = v;
      }
  return out;
}

// ---------------------------------------------------------------- overworld
// Bush: a leafy lump at terrain resolution (8 blocks across, 5 tall; mesh it at 1/8 with the
// terrain material). r in [0, 1) swells it a little; the lab's world8 bush.
export function bush(r = 0) {
  const g = new DenseGrid(8, 5, 8);
  for (let z = -4; z < 4; z++)
    for (let y = 0; y < 5; y++)
      for (let x = -4; x < 4; x++) {
        const d = Math.hypot(x + 0.5, (y - 1.2) * 1.2, z + 0.5);
        if (d > 3.9 + r * 0.3) continue;
        const n = hash3(x, y, z, 71 + Math.round(r * 16));
        g.set(x + 4, y, z + 4, y < 1 ? TP.leafDark : n > 0.88 ? TP.leafLight : TP.leaf);
      }
  return g;
}

// Clay pot, 12 x 12 x 12: round belly, neck and a dark mouth.
export function pot() {
  const g = new DenseGrid(12, 12, 12);
  g.ellipsoid(6, 4, 6, 5.5, 5, 5.5, (x, y, z) => (y === 5 ? PROP.potClayLo : jitter(PROP.potClay, x, y, z, 0.04, 5)));
  g.box(3, 8, 3, 9, 11, 9, PROP.potClay);
  g.box(4, 9, 4, 8, 11, 8, null);
  g.box(4, 9, 4, 8, 10, 8, PROP.potInside);
  g.box(2, 10, 2, 10, 11, 10, PROP.potClayLo);
  g.box(3, 10, 3, 9, 11, 9, null);
  g.box(4, 10, 4, 8, 11, 8, null);
  return g;
}

// Signpost, 14 x 14 x 6: a post and a board with two ink strokes (no letters).
export function signpost() {
  const g = new DenseGrid(14, 14, 6);
  g.box(6, 0, 2, 8, 8, 4, PROP.signPost);
  g.box(1, 7, 2, 13, 14, 4, (x, y, z) => jitter(PROP.signWood, x, y, z, 0.04, 7));
  g.box(1, 7, 3, 13, 8, 4, PROP.signWoodLo);
  g.box(3, 11, 4, 11, 12, 5, PROP.signInk);
  g.box(3, 9, 4, 9, 10, 5, PROP.signInk);
  return g;
}

// Gravestone, 14 x 16 x 8: rounded top, a carved cross-bar mark, a base slab.
export function gravestone() {
  const g = new DenseGrid(14, 16, 8);
  g.box(2, 0, 1, 12, 13, 6, (x, y, z) => jitter(PROP.stone, x, y, z, 0.05, 9));
  g.box(3, 13, 1, 11, 15, 6, PROP.stone);
  g.box(5, 15, 1, 9, 16, 6, PROP.stone);
  g.box(6, 5, 6, 8, 12, 7, PROP.stoneDark);
  g.box(4, 9, 6, 10, 10, 7, PROP.stoneDark);
  g.box(1, 0, 0, 13, 1, 7, PROP.stoneLo);
  return g;
}

// A patch of five small flowers (for placing as a model; overworld ',' tiles draw their own).
export function flowerPatch(seed = 0) {
  const g = new DenseGrid(16, 2, 16);
  for (let i = 0; i < 5; i++) {
    const x = 2 + Math.floor(hash3(i, seed, 1, 41) * 11);
    const z = 2 + Math.floor(hash3(i, seed, 2, 41) * 11);
    const col = [PROP.flowerRed, PROP.flowerYellow, PROP.flowerWhite][Math.floor(hash3(i, seed, 3, 41) * 3)];
    g.set(x, 0, z, PROP.stem);
    g.set(x, 1, z, PROP.flowerCenter);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.set(x + dx, 1, z + dz, col);
  }
  return g;
}

// ---------------------------------------------------------------- chest, brazier, flame
// Treasure chest, 14 wide, 12 deep: base (y 0-6) and lid (y 7-11) as separate grids so the lid can
// swing open on its back edge. Gold corner bands and a lock plate.
export function chestBase() {
  const g = new DenseGrid(14, 7, 12);
  g.box(0, 0, 0, 14, 7, 12, (x, y, z) => {
    const side = x === 0 || x === 13;
    if (side && (y === 0 || y === 6)) return PROP.chestGold;
    return side ? PROP.chestWoodLo : jitter(PROP.chestWood, x, y, z, 0.04, 13);
  });
  g.box(6, 5, 11, 8, 7, 12, PROP.chestGold); // lock plate, lower half
  g.box(1, 6, 1, 13, 7, 11, PROP.chestDark); // the inside, seen when the lid is up
  return g;
}

export function chestLid() {
  const g = new DenseGrid(14, 5, 12);
  g.box(0, 0, 0, 14, 4, 12, (x) => (x === 0 || x === 13 ? PROP.chestGold : x % 4 === 1 ? PROP.chestWoodLo : PROP.chestWood));
  g.box(0, 4, 1, 14, 5, 11, (x) => (x === 0 || x === 13 || x === 4 || x === 9 ? PROP.chestGold : PROP.chestWood));
  g.box(6, 0, 11, 8, 2, 12, PROP.chestGold); // lock plate, upper half
  g.set(6, 0, 11, PROP.chestDark);
  g.set(7, 0, 11, PROP.chestDark);
  return g;
}

// Stone brazier stand, 10 x 11 x 10; the flame is a separate glowing model on top (FLAME_Y).
export function brazier() {
  const g = new DenseGrid(10, 11, 10);
  g.box(2, 0, 2, 8, 2, 8, PROP.brazier);
  g.box(3, 2, 3, 7, 8, 7, shadeHex(PROP.brazier, 1.15));
  g.box(1, 8, 1, 9, 11, 9, PROP.brazier);
  g.box(2, 10, 2, 8, 11, 8, PROP.brazierInside);
  return g;
}
export const FLAME_Y = 10; // voxels: the flame's base sits in the brazier's bowl

// Flame, two frames (swap them for the flicker), 8 x 11 x 8.
export function flame(frame = 0) {
  const g = new DenseGrid(8, 11, 8);
  const lick = frame % 2;
  g.box(1, 0, 1, 7, 3, 7, PROP.flameOuter);
  g.box(2, 3, 2, 6, 6, 6, PROP.flame);
  g.box(1 + lick, 3, 3, 2 + lick, 5, 5, PROP.flameOuter);
  g.box(3, 6, 3, 5, 9 - lick, 5, PROP.flame);
  g.box(3, 1, 3, 5, 5, 5, PROP.flameCore);
  g.box(3 + lick, 9 - lick, 3, 4 + lick, 11 - lick, 4, PROP.flameOuter);
  return g;
}

// ---------------------------------------------------------------- dungeon
// Door leaf, one tile wide and the full wall height (16 x 32 x 4): upright planks, two iron bands
// with rivets, a gold lock plate on the edge that meets the other leaf. `right` mirrors it for the
// east leaf of a pair. Its front (+z) face goes flush with the wall's inner face.
export function doorLeaf(right = false) {
  const g = new DenseGrid(16, 32, 4);
  g.box(0, 0, 0, 16, 32, 3, (x, y, z) => {
    if (x % 4 === 0) return PROP.doorWoodDark;
    return jitter(PROP.doorWood, x >> 2, y >> 3, z, 0.05, 17);
  });
  for (const y0 of [5, 24]) {
    g.box(0, y0, 3, 16, y0 + 3, 4, PROP.doorIron);
    for (const x of [2, 7, 12]) g.set(x, y0 + 1, 3, shadeHex(PROP.doorIron, 1.6));
  }
  g.box(11, 12, 3, 16, 20, 4, PROP.doorGold);
  g.set(13, 16, 3, PROP.doorWoodDark);
  g.set(13, 15, 3, PROP.doorWoodDark);
  g.set(13, 14, 3, PROP.doorWoodDark);
  return right ? flipX(g) : g;
}

// Guardian statue on a plinth, 16 x 18 x 16 (our own squat owl-headed idol in dark stone).
export function statue() {
  const g = new DenseGrid(16, 18, 16);
  g.box(0, 0, 0, 16, 3, 16, GOLD.plinth);
  g.box(3, 3, 4, 13, 10, 12, GOLD.statue);
  g.box(2, 10, 3, 14, 17, 13, GOLD.statueLight);
  g.box(2, 17, 3, 5, 18, 6, GOLD.statueLight);
  g.box(11, 17, 3, 14, 18, 6, GOLD.statueLight);
  g.box(4, 13, 12, 7, 15, 13, GOLD.statueEye);
  g.box(9, 13, 12, 12, 15, 13, GOLD.statueEye);
  g.box(7, 11, 12, 9, 13, 14, GOLD.statueDark);
  g.box(1, 4, 5, 3, 9, 11, GOLD.statueDark);
  g.box(13, 4, 5, 15, 9, 11, GOLD.statueDark);
  return g;
}

// Spike ball (hazard), 16 x 14 x 16: a dark navy voxel sphere with short studs.
export function spikeBall() {
  const g = new DenseGrid(16, 14, 16);
  g.ellipsoid(8, 6.5, 8, 6, 6, 6, (x, y, z) => jitter(GOLD.spike, x, y, z, 0.05, 19));
  for (const [x, y, z] of [[8, 13, 8], [1, 6, 8], [14, 6, 8], [8, 6, 1], [8, 6, 14], [3, 11, 3], [12, 11, 12], [3, 2, 12], [12, 2, 3]])
    g.set(x, y, z, GOLD.spikeStud);
  return g;
}

// Push block, one tile (16 x 16 x 16 plus studs): olive stone with a darker bottom course, bevelled
// top edge and four raised studs on top.
export function pushBlock() {
  const g = new DenseGrid(16, 17, 16);
  g.box(0, 0, 0, 16, 16, 16, (x, y, z) => {
    if (y < 2) return GOLD.blockDark;
    const edge = (x === 0 || x === 15) + (z === 0 || z === 15);
    if (y === 15 && edge) return GOLD.blockDark;
    return jitter(GOLD.block, x >> 1, y >> 1, z >> 1, 0.05, 23);
  });
  for (const [x0, z0] of [[3, 3], [10, 3], [3, 10], [10, 10]]) g.box(x0, 16, z0, x0 + 3, 17, z0 + 3, GOLD.blockStud);
  return g;
}

// ---------------------------------------------------------------- cached models
export const bushModel = (v) => model(`bush:${v}`, () => bush(v / 3), { scale: 1 / 8 });
export const potModel = () => model('pot', pot);
export const signModel = () => model('sign', signpost);
export const graveModel = () => model('grave', gravestone);
export const chestBaseModel = () => model('chest:base', chestBase);
export const chestLidModel = () => model('chest:lid', chestLid, { origin: [7, 0, 0] }); // hinge on the back edge
export const brazierModel = () => model('brazier', brazier);
export const flameModel = (frame) => model(`flame:${frame % 2}`, () => flame(frame));
export const doorModel = (right) => model(`door:${right ? 'r' : 'l'}`, () => doorLeaf(right), { origin: [8, 0, 4] }); // front face at z = 0
export const statueModel = () => model('statue', statue);
export const spikeBallModel = () => model('spike-ball', spikeBall);
export const pushBlockModel = () => model('push-block', pushBlock);
