// Enemy, trap and boss models for the items-and-foes stream (art bible
// section 10): 16 voxels per tile, facing +z, standing on y = 0, 2 to 4 hues
// each (a body hue with its shade, an accent, an eye colour). Frames are
// whole models swapped like cels. Every design here is our own.
//
//   hopperModel(frame)   a long-eared field critter (frame 1: crouched to spring)
//   buzzerModel(frame)   a round striped flier with flat wing plates
//   stumpModel(awake)    a tree stump; awake it opens its eyes and stands on roots
//   archerModel(frame)   a hooded bowman (frame 1: drawing)
//   leaperModel(frame)   a long-legged cricket (frame 1: legs folded)
//   guardianModel()      a squat stone sentinel with a round shield face
//   goldBlobModel(frame) the treasure-slime: a gold jelly with a coin on top
//   wyrmModel(frame)     a heavy horned lizard
//   gazerModel(open)     a floating eye in a stone lid
//   arrowTrapModel()     a wall slot with a carved mouth
//   serpentHead(), serpentSegment(glow)  boss-serpent's parts
//   tombstoneModel()     the re-fight stone
//   crownModel()         the crowned-elite marker: a floating ring of gold points
import { DenseGrid, hash3 } from '../../core/vox.js';
import { CP } from '../palette.js';
import { model, jitter } from '../kit.js';

const C = {
  fur: 0xc98b4e, furLo: 0x9a6232, furHi: 0xf0d2a4, nose: 0xe86a7a,
  wasp: 0xf2c43c, waspLo: 0x2e2a2a, wing: 0xdfeefa,
  bark: 0x8a5d34, barkLo: 0x5e3d20, ring: 0xd9b27a, leaf: 0x5aa84a,
  hood: 0x3e7a44, hoodLo: 0x2a5530, bow: 0x8a5a30, string: 0xeeeeee,
  cricket: 0x7cc04a, cricketLo: 0x4e8a2e,
  stone: 0x9a9488, stoneLo: 0x6e695f, stoneHi: 0xc4bfb2, rune: 0x5ad8ff,
  gold: 0xf6c93c, goldLo: 0xc8961e, goldHi: 0xfff0a0,
  wyrm: 0x7a4ab0, wyrmLo: 0x4e2e7a, wyrmBelly: 0xe8c890, horn: 0xf2e6c8,
  lid: 0x6a6a7a, lidLo: 0x46465a, iris: 0xe84a3a,
  scale: 0x2f8f7a, scaleLo: 0x1d5e50, scaleHi: 0x6fd0b0, fang: 0xf4f0e0, glow: 0xfff08a,
  crown: 0xffd84a, crownGem: 0xff4a6a,
};

// ---------------------------------------------------------------- hopper
export function hopper(frame = 0) {
  const g = new DenseGrid(14, 15, 14);
  const low = frame ? 1 : 0;
  g.ellipsoid(7, 4.5 - low, 6.5, 5, 4.5 - low, 5.5, (x, y, z) => (y < 2 ? C.furLo : jitter(C.fur, x, y, z, 0.05, 41)));
  g.ellipsoid(7, 8 - low, 9, 4, 3.5, 3.5, (x, y, z) => jitter(C.fur, x, y, z, 0.04, 43)); // head
  g.box(5, 5 - low, 11, 9, 8 - low, 13, C.furHi); // muzzle
  g.box(6, 7 - low, 12, 8, 8 - low, 13, C.nose);
  g.box(4, 8 - low, 11, 6, 10 - low, 12, CP.eyeHi);
  g.box(8, 8 - low, 11, 10, 10 - low, 12, CP.eyeHi);
  g.set(5, 8 - low, 12, CP.eye);
  g.set(8, 8 - low, 12, CP.eye);
  const ear = frame ? 3 : 5; // ears flatten as it crouches
  g.box(4, 11 - low, 8, 6, 11 - low + ear, 10, C.fur);
  g.box(8, 11 - low, 8, 10, 11 - low + ear, 10, C.fur);
  g.box(4, 11 - low, 9, 5, 11 - low + ear, 10, C.nose);
  g.box(9, 11 - low, 9, 10, 11 - low + ear, 10, C.nose);
  g.box(6, 3, 0, 8, 5, 2, C.furHi); // tail
  return g;
}
export const hopperModel = (f) => model(`foe-hopper:${f}`, () => hopper(f));

// ---------------------------------------------------------------- buzzer
export function buzzer(frame = 0) {
  const g = new DenseGrid(18, 10, 12);
  g.ellipsoid(9, 4, 6, 4.5, 4, 5.5, (x, y, z) => (z % 3 === 0 ? C.waspLo : C.wasp));
  g.box(7, 3, 11, 11, 6, 12, C.waspLo); // face
  g.set(7, 5, 11, 0xffffff);
  g.set(10, 5, 11, 0xffffff);
  g.box(8, 0, 1, 10, 2, 3, C.waspLo); // stinger
  const up = frame ? 2 : 0;
  g.box(0, 6 + up, 3, 5, 7 + up, 9, C.wing);
  g.box(13, 6 + up, 3, 18, 7 + up, 9, C.wing);
  return g;
}
export const buzzerModel = (f) => model(`foe-buzzer:${f}`, () => buzzer(f));

// ---------------------------------------------------------------- stump
export function stump(awake = 0) {
  const g = new DenseGrid(16, 16, 16);
  const lift = awake ? 2 : 0;
  g.box(3, lift, 3, 13, 11 + lift, 13, (x, y, z) => jitter(x === 3 || x === 12 || z === 3 || z === 12 ? C.barkLo : C.bark, x, y >> 1, z, 0.08, 51));
  g.box(4, 11 + lift, 4, 12, 12 + lift, 12, (x, y, z) => ((Math.hypot(x - 7.5, z - 7.5) | 0) % 2 ? C.ring : C.barkLo));
  g.box(10, 12 + lift, 5, 12, 14 + lift, 7, C.leaf); // a sprout
  if (awake) {
    for (const [x, z] of [[2, 4], [12, 4], [2, 11], [12, 11]]) g.box(x, 0, z, x + 2, 2, z + 1, C.barkLo); // roots
    g.box(5, 7, 13, 7, 9, 14, C.glow);
    g.box(9, 7, 13, 11, 9, 14, C.glow);
    g.box(6, 4, 13, 10, 5, 14, C.barkLo);
  } else {
    g.box(5, 7, 13, 7, 8, 14, C.barkLo);
    g.box(9, 7, 13, 11, 8, 14, C.barkLo);
  }
  return g;
}
export const stumpModel = (a) => model(`foe-stump:${a ? 1 : 0}`, () => stump(a ? 1 : 0));

// ---------------------------------------------------------------- archer
export function archer(frame = 0) {
  const g = new DenseGrid(16, 16, 14);
  g.box(5, 0, 5, 7, 3, 8, C.hoodLo);
  g.box(9, 0, 5, 11, 3, 8, C.hoodLo);
  g.box(4, 3, 4, 12, 9, 9, (x, y, z) => jitter(C.hood, x, y, z, 0.05, 61)); // cloak
  g.ellipsoid(8, 12, 6.5, 4.5, 4, 4.5, C.hood); // hood
  g.box(5, 10, 10, 11, 13, 11, CP.skin);
  g.box(5, 11, 10, 7, 12, 11, CP.eye);
  g.box(9, 11, 10, 11, 12, 11, CP.eye);
  const draw = frame ? 2 : 0;
  g.box(1, 3, 9 + draw, 2, 12, 10 + draw, C.bow); // the bow held out front
  g.box(1, 2, 10 + draw, 2, 3, 11 + draw, C.bow);
  g.box(1, 12, 10 + draw, 2, 13, 11 + draw, C.bow);
  g.box(2, 3, 11 - draw, 3, 12, 12 - draw, C.string);
  return g;
}
export const archerModel = (f) => model(`foe-archer:${f}`, () => archer(f));

// ---------------------------------------------------------------- leaper
export function leaper(frame = 0) {
  const g = new DenseGrid(16, 12, 16);
  g.ellipsoid(8, 5, 8, 4, 3.5, 6, (x, y, z) => (y < 4 ? C.cricketLo : jitter(C.cricket, x, y, z, 0.05, 71)));
  g.ellipsoid(8, 6, 13, 3, 3, 2.5, C.cricket);
  g.box(6, 6, 15, 7, 8, 16, CP.eye);
  g.box(9, 6, 15, 10, 8, 16, CP.eye);
  g.box(7, 9, 13, 8, 12, 14, C.cricketLo); // feelers
  g.box(9, 9, 13, 10, 12, 14, C.cricketLo);
  const k = frame ? 3 : 0;
  for (const x of [2, 13]) {
    g.box(x, 4 + (frame ? 0 : 3), 3, x + 1, 9 - k, 5, C.cricketLo); // the big hind legs
    g.box(x, 0, 1 + k, x + 1, 5, 3 + k, C.cricketLo);
  }
  return g;
}
export const leaperModel = (f) => model(`foe-leaper:${f}`, () => leaper(f));

// ---------------------------------------------------------------- guardian
export function guardian(frame = 0) {
  const g = new DenseGrid(20, 20, 18);
  const s = frame ? 1 : 0;
  g.box(4, 0, 6 + s, 8, 4, 11 + s, C.stoneLo);
  g.box(12, 0, 6 - s, 16, 4, 11 - s, C.stoneLo);
  g.box(3, 4, 4, 17, 14, 14, (x, y, z) => jitter(C.stone, x >> 1, y >> 1, z >> 1, 0.06, 81));
  g.box(5, 14, 5, 15, 19, 13, C.stoneHi);
  g.box(6, 16, 13, 14, 17, 14, C.rune);
  g.ellipsoid(10, 9, 15, 5, 4.5, 1.5, C.stoneLo); // the round shield face
  g.box(9, 7, 16, 11, 11, 17, C.rune);
  g.box(0, 6, 7, 3, 12, 11, C.stoneLo);
  g.box(17, 6, 7, 20, 12, 11, C.stoneLo);
  return g;
}
export const guardianModel = (f = 0) => model(`foe-guardian:${f}`, () => guardian(f));

// ---------------------------------------------------------------- treasure-slime
export function goldBlob(frame = 0) {
  const h = frame ? 7 : 9;
  const rx = frame ? 7 : 6;
  const g = new DenseGrid(16, 13, 16);
  g.ellipsoid(8, 0, 8, rx, h, rx, (x, y, z) => (y > h - 3 ? C.goldHi : y < 2 ? C.goldLo : jitter(C.gold, x, y, z, 0.06, 91)));
  g.stampFront(5, (frame ? 3 : 4) + 1, ['WW..WW', 'KW..KW'], { W: CP.eyeHi, K: CP.eye });
  g.box(6, h, 7, 10, h + 3, 9, C.goldLo); // a coin on its head
  g.box(7, h + 1, 7, 9, h + 2, 9, C.goldHi);
  return g;
}
export const goldBlobModel = (f) => model(`foe-goldblob:${f}`, () => goldBlob(f));

// ---------------------------------------------------------------- wyrm
export function wyrm(frame = 0) {
  const g = new DenseGrid(24, 18, 30);
  const s = frame ? 1 : 0;
  g.ellipsoid(12, 7, 12, 8, 6, 10, (x, y, z) => (y < 4 ? C.wyrmBelly : jitter(C.wyrm, x, y, z, 0.06, 101)));
  g.ellipsoid(12, 10, 24, 6, 5, 5.5, C.wyrm); // head
  g.box(8, 6, 27, 16, 9, 30, C.wyrmLo); // jaw
  g.box(9, 8, 29, 10, 9, 30, C.fang);
  g.box(14, 8, 29, 15, 9, 30, C.fang);
  g.box(8, 11, 28, 10, 13, 29, C.glow);
  g.box(14, 11, 28, 16, 13, 29, C.glow);
  g.box(7, 14, 21, 9, 18, 23, C.horn);
  g.box(15, 14, 21, 17, 18, 23, C.horn);
  for (const [x, z] of [[4, 6], [18, 6], [4, 16], [18, 16]]) g.box(x, 0, z + (x < 12 ? s : -s), x + 3, 3, z + 3 + (x < 12 ? s : -s), C.wyrmLo);
  g.box(10, 4, 0, 14, 7, 4, C.wyrmLo); // tail
  for (let z = 4; z < 20; z += 3) g.box(11, 13, z, 13, 14, z + 2, C.horn); // back ridge
  return g;
}
export const wyrmModel = (f) => model(`foe-wyrm:${f}`, () => wyrm(f));

// ---------------------------------------------------------------- gazer
export function gazer(open = 1) {
  const g = new DenseGrid(14, 14, 14);
  g.ellipsoid(7, 7, 7, 6, 6, 6, (x, y, z) => (z > 9 ? CP.eyeHi : jitter(C.lid, x, y, z, 0.05, 111)));
  if (open) {
    g.box(5, 5, 12, 9, 9, 14, C.iris);
    g.box(6, 6, 13, 8, 8, 14, CP.eye);
  } else g.box(2, 3, 10, 12, 11, 14, (x, y) => (y === 7 ? C.lidLo : C.lid));
  g.box(3, 12, 5, 11, 14, 9, C.lidLo); // a brow ridge
  return g;
}
export const gazerModel = (o) => model(`foe-gazer:${o ? 1 : 0}`, () => gazer(o ? 1 : 0));

// ---------------------------------------------------------------- arrow trap
export function arrowTrap() {
  const g = new DenseGrid(12, 12, 4);
  g.box(0, 0, 0, 12, 12, 4, (x, y, z) => jitter(C.stone, x, y, z, 0.05, 121));
  g.box(3, 4, 3, 9, 7, 4, CP.eye); // the slot
  g.box(2, 9, 3, 4, 10, 4, C.iris);
  g.box(8, 9, 3, 10, 10, 4, C.iris);
  return g;
}
export const arrowTrapModel = () => model('foe-arrow-trap', arrowTrap, { origin: [6, 0, 2] });

// ---------------------------------------------------------------- boss-serpent
// Head 1.6 tiles across (26 voxels), segments 1.2 (19 voxels). The glowing
// segment swaps its scales for pale gold.
export function serpentHead(frame = 0) {
  const g = new DenseGrid(26, 20, 28);
  const open = frame ? 2 : 0;
  g.ellipsoid(13, 9, 12, 12, 8, 11, (x, y, z) => (y < 4 ? C.scaleLo : hash3(x, y, z, 131) > 0.8 ? C.scaleHi : C.scale));
  g.box(6, 2 - open, 18, 20, 6 - open, 28, C.scaleLo); // lower jaw
  g.box(5, 7, 18, 21, 13, 28, C.scale); // snout
  for (const x of [7, 10, 15, 18]) g.box(x, 5 - open, 26, x + 1, 7, 27, C.fang);
  g.box(6, 13, 20, 10, 16, 23, CP.eyeHi);
  g.box(16, 13, 20, 20, 16, 23, CP.eyeHi);
  g.box(7, 13, 22, 9, 15, 23, C.iris);
  g.box(17, 13, 22, 19, 15, 23, C.iris);
  g.box(4, 16, 8, 7, 20, 12, C.fang); // swept horns
  g.box(19, 16, 8, 22, 20, 12, C.fang);
  return g;
}
export function serpentSegment(glow = 0) {
  const g = new DenseGrid(19, 16, 19);
  const body = glow ? C.goldHi : C.scale;
  const lo = glow ? C.gold : C.scaleLo;
  g.ellipsoid(9.5, 7.5, 9.5, 9, 7.5, 9, (x, y, z) => (y < 4 ? lo : (x + z) % 4 === 0 ? lo : body));
  g.box(8, 14, 4, 11, 16, 15, glow ? C.glow : C.scaleHi); // a dorsal fin
  return g;
}
export const serpentHeadModel = (f = 0) => model(`boss-serpent:head:${f}`, () => serpentHead(f));
export const serpentSegmentModel = (glow) => model(`boss-serpent:seg:${glow ? 1 : 0}`, () => serpentSegment(glow ? 1 : 0));

// ---------------------------------------------------------------- tombstone
export function tombstone() {
  const g = new DenseGrid(14, 18, 8);
  g.box(0, 0, 0, 14, 2, 8, C.stoneLo);
  g.box(2, 2, 2, 12, 15, 6, (x, y, z) => jitter(C.stone, x, y, z, 0.05, 141));
  g.box(3, 15, 2, 11, 17, 6, C.stone);
  g.box(5, 7, 6, 9, 12, 7, C.scale); // a coiled mark
  g.box(6, 8, 6, 8, 11, 7, C.stoneHi);
  return g;
}
export const tombstoneModel = () => model('boss-tombstone', tombstone);

// ---------------------------------------------------------------- crown
export function crown() {
  const g = new DenseGrid(7, 4, 7);
  g.box(0, 0, 0, 7, 1, 7, C.crown);
  g.clear(1, 0, 1, 6, 1, 6);
  for (const [x, z] of [[0, 0], [3, 0], [6, 0], [0, 3], [6, 3], [0, 6], [3, 6], [6, 6]]) g.box(x, 1, z, x + 1, 3, z + 1, C.crown);
  g.set(3, 1, 0, C.crownGem);
  g.set(3, 1, 6, C.crownGem);
  return g;
}
export const crownModel = () => model('foe-crown', crown);
