// Tiny voxel models for ambient overworld life (src/systems/critters.js): a butterfly (two
// wing-flap poses), a ground bird (folded / wings-spread poses) and a chicken. All three are built
// far smaller than a character (kit.js's usual 1/16 tile voxel), share cached geometry through
// model() and use the shared character material, so spawning several per screen costs almost
// nothing: a handful of extra draw calls, no new materials, no shadows.
import { DenseGrid } from '../core/vox.js';
import { getMaterial } from '../core/materials.js';
import { model, modelMesh, PoseMesh } from './kit.js';

function noShadow(mesh, name) {
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.name = name;
  return mesh;
}

// ---------------------------------------------------------------- butterfly
const BUTTERFLY_SCALE = 1 / 36; // a 7-voxel wingspan is about 0.2 tile
const BUTTERFLY_BODY = 0x2a2018;
export const BUTTERFLY_COLORS = [0xe8b23a, 0xd8546a, 0x6aa0d8, 0xe8e8e8];

function butterflyGrid(color, up) {
  const g = new DenseGrid(7, 3, 3);
  const wy = up ? 1 : 0;
  g.box(0, wy, 0, 3, wy + 2, 3, color); // left wing
  g.box(4, wy, 0, 7, wy + 2, 3, color); // right wing
  g.box(3, 0, 1, 4, 3, 2, BUTTERFLY_BODY); // body, full height, one voxel deep
  return g;
}

export function makeButterfly(variant = 0) {
  const color = BUTTERFLY_COLORS[((variant % BUTTERFLY_COLORS.length) + BUTTERFLY_COLORS.length) % BUTTERFLY_COLORS.length];
  const up = model(`critter-butterfly-up:${color}`, () => butterflyGrid(color, true), { scale: BUTTERFLY_SCALE });
  const down = model(`critter-butterfly-down:${color}`, () => butterflyGrid(color, false), { scale: BUTTERFLY_SCALE });
  return noShadow(new PoseMesh({ up, down }, getMaterial('character'), 'up'), 'critter-butterfly');
}

// ---------------------------------------------------------------- bird
const BIRD_SCALE = 1 / 40; // a 9-voxel bird is about 0.22 tile
const BIRD_BODY = 0x8a6a4a;
const BIRD_WING = 0x6a4c34;
const BIRD_BEAK = 0xe8a030;

function birdGrid(spread) {
  const g = new DenseGrid(9, 6, 9);
  g.ellipsoid(4, 2, 4, 2.2, 1.7, 2.5, BIRD_BODY); // body
  g.ellipsoid(4, 3, 7, 1.2, 1.1, 1.2, BIRD_BODY); // head
  g.box(3, 3, 8, 6, 4, 9, BIRD_BEAK); // beak
  g.box(3, 0, 3, 4, 1, 5, BIRD_BEAK); // left leg
  g.box(5, 0, 3, 6, 1, 5, BIRD_BEAK); // right leg
  const wy = spread ? 3 : 2;
  const wx = spread ? 0 : 1;
  g.box(wx, wy, 2, wx + 2, wy + 1, 6, BIRD_WING); // left wing
  g.box(9 - wx - 2, wy, 2, 9 - wx, wy + 1, 6, BIRD_WING); // right wing
  return g;
}

export function makeBird() {
  const ground = model('critter-bird-ground', () => birdGrid(false), { scale: BIRD_SCALE });
  const spread = model('critter-bird-spread', () => birdGrid(true), { scale: BIRD_SCALE });
  return noShadow(new PoseMesh({ ground, spread }, getMaterial('character'), 'ground'), 'critter-bird');
}

// ---------------------------------------------------------------- chicken
const CHICKEN_SCALE = 1 / 28; // a 10-voxel chicken is about 0.4 tile, a little over half hero-height
const CHICKEN_COMB = 0xc23a2a;
const CHICKEN_BEAK = 0xe89a30;
const CHICKEN_LEG = 0xe0a838;
export const CHICKEN_VARIANTS = [
  { body: 0xf0ead8, tail: 0xd8cfae }, // white
  { body: 0x8a5a34, tail: 0x6a3f22 }, // brown
];

function chickenGrid(v) {
  const g = new DenseGrid(10, 11, 13);
  g.box(3, 5, 0, 7, 10, 2, v.tail); // tail feathers, at the back
  g.ellipsoid(5, 5, 6, 3.6, 3.4, 4.4, v.body); // body
  g.ellipsoid(5, 8, 10, 1.8, 1.7, 1.8, v.body); // head
  g.box(4, 9, 10, 6, 11, 12, CHICKEN_COMB); // comb, on top of the head
  g.box(4, 7, 11, 6, 8, 13, CHICKEN_BEAK); // beak, front of the head
  g.box(3, 0, 5, 5, 2, 7, CHICKEN_LEG); // left leg
  g.box(5, 0, 5, 7, 2, 7, CHICKEN_LEG); // right leg
  return g;
}

// Returns { mesh, colors }: colors is the chicken's own palette, weighted, for a burst() poof when
// it scatters (systems/particles.js).
export function makeChicken(variant = 0) {
  const v = CHICKEN_VARIANTS[((variant % CHICKEN_VARIANTS.length) + CHICKEN_VARIANTS.length) % CHICKEN_VARIANTS.length];
  const m = model(`critter-chicken:${variant}`, () => chickenGrid(v), { scale: CHICKEN_SCALE });
  return { mesh: noShadow(modelMesh(m, getMaterial('character')), 'critter-chicken'), colors: m.colors };
}
