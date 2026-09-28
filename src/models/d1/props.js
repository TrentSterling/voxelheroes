// Dungeon kit props of the dungeon stream (D1 and later temples), at
// character resolution (16 voxels a tile), built with look's kit. Every
// model faces +z (into the room for a door in the north wall).
//   barsModel()        a shutter: iron bars filling a doorway tile, 2 tiles tall
//   bossDoorModel(r)   one leaf of the boss door (r: the right leaf), with a skull boss
//   colorDoorModel(c)  one leaf of a colored lock ('red', 'blue', 'green')
//   switchModel(on)    a wall switch: a round stone eye on a plate, lit when on
//   tabletModel()      a stone tablet on a low base
//   portalModel(open)  a flat ring set in the floor, glowing when open
import { DenseGrid } from '../../core/vox.js';
import { model, jitter } from '../kit.js';

const IRON = 0x3a3a44;
const IRON_LO = 0x2a2a32;
const STONE = 0x8e8a80;
const STONE_LO = 0x6a6760;
const GOLD = 0xe6b43a;

function bars() {
  const g = new DenseGrid(16, 32, 3);
  for (let x = 1; x < 16; x += 3) g.box(x, 0, 1, x + 2, 32, 2, (X, Y) => jitter(IRON, X, Y, 1, 0.05));
  for (const y of [6, 18, 29]) g.box(0, y, 0, 16, y + 2, 3, IRON_LO);
  return g;
}
export const barsModel = () => model('d1-bars', bars, { origin: [8, 0, 1.5] });

function leaf(right, face, trim) {
  const g = new DenseGrid(16, 32, 4);
  g.box(0, 0, 0, 16, 32, 3, (X, Y, Z) => jitter(face, X, Y, Z, 0.05));
  for (const y of [4, 15, 26]) g.box(0, y, 3, 16, y + 2, 4, trim);
  const ex = right ? 0 : 13; // the leaves meet in the middle: the lock plate sits at the inner edge
  g.box(ex, 12, 3, ex + 3, 20, 4, GOLD);
  return g;
}
export const bossDoorModel = (right) =>
  model(`d1-boss-door:${right ? 'r' : 'l'}`, () => {
    const g = leaf(right, 0x4a2a2a, IRON);
    // a horned mark across both leaves
    const cx = right ? 0 : 16;
    g.box(Math.min(cx, cx - 6), 22, 3, Math.max(cx, cx + 6) - 0, 25, 4, 0xd8c8a8);
    return g;
  }, { origin: [8, 0, 0] });

const LOCK = { red: 0xb83a30, blue: 0x3a5ab8, green: 0x3a9a4a };
export const colorDoorModel = (color, right) => model(`d1-color-door:${color}:${right ? 'r' : 'l'}`, () => leaf(right, LOCK[color] ?? LOCK.red, IRON_LO), { origin: [8, 0, 0] });

function eye(on) {
  const g = new DenseGrid(10, 10, 3);
  g.box(0, 0, 0, 10, 10, 2, (X, Y, Z) => jitter(STONE_LO, X, Y, Z, 0.05));
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 10; x++) {
      const d = Math.hypot(x - 4.5, y - 4.5);
      if (d < 3.6) g.set(x, y, 2, d < 1.6 ? (on ? 0xfff0a0 : 0x2a2a2a) : on ? 0xe8a030 : 0x5a5650);
    }
  return g;
}
export const switchModel = (on) => model(`d1-switch:${on ? 1 : 0}`, () => eye(on), { origin: [5, 0, 0] });

function tablet() {
  const g = new DenseGrid(14, 14, 6);
  g.box(0, 0, 0, 14, 2, 6, STONE_LO);
  g.box(1, 2, 1, 13, 14, 4, (X, Y, Z) => jitter(STONE, X, Y, Z, 0.05));
  for (const y of [5, 8, 11]) g.box(3, y, 4, 11, y + 1, 5, 0x4a4640);
  return g;
}
export const tabletModel = () => model('d1-tablet', tablet);

function portal(open) {
  const g = new DenseGrid(16, 1, 16);
  for (let z = 0; z < 16; z++)
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, z - 7.5);
      if (d > 4.5 && d < 7) g.set(x, 0, z, open ? 0x7ad8ff : 0x4a5a6a);
      else if (d <= 4.5 && open) g.set(x, 0, z, 0x2a6a9a);
    }
  return g;
}
export const portalModel = (open) => model(`d1-portal:${open ? 1 : 0}`, () => portal(open));
