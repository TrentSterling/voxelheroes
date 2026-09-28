// The hero (art bible section 10, the measured body plan): 16 x 16 x 16 voxels at 1/16 tile, so
// one tile tall. Whole-model poses swapped like sprite cels, never bent:
//   stand | walk1 | walk2 | cheer (item get, victory) | swordOut (sword hand straight forward)
// plus windUp, a spare (the sword hand raised behind the head) kept for later sword moves.
// attack, attack1 and attack2 are aliases of swordOut (the lab's latest body plan).
//
// Front view, rows counted from the top (y = 15 - row): head rows 0-7, 10 wide and 8 deep, face 8
// wide on rows 5-7 with 1 x 2 eyes at columns 6 and 9; torso rows 8-11, 8 wide; 2 x 2 hands under
// a sleeve on rows 9-11 at its sides; belt and hem rows 12-13; legs rows 14-15, 2 wide with a
// 2-voxel gap. Seven colour slots. The shield is part of every pose but cheer. The sword is a
// separate rigid model (swordGrid) that the sword system turns on swordPivot.
//
//   const hero = makeHero();
//   hero.setPose('walk1');           // any of HERO_POSES or an alias
//   hero.setSword(mesh);             // another blade (the sword feature)
//   hero.root                        // add to the scene; feet at y = 0, faces +z at yaw 0
// sword.js writes swordPivot.rotation (y: sweep angle, x: tilt), body.rotation.y (twist) and
// armR.rotation (kept as an inert handle; arms are part of the poses).
//
// The same body in other colours makes a townsperson (entities/npcs/npc.js):
//
//   makeHero(getMaterial('character'), { tunic: 0x9a6a44, cap: 0x5a6f9c, blade: null, shield: null })
//
// Palette keys are the seven slots (hair, band, tunic, leather, skin, eye, gold) or M1's names
// (cap for the band, belt for leather); `blade: null` leaves out the sword (hero.sword is then
// null) and `shield: null` the shield.
import * as THREE from 'three';
import { DenseGrid } from '../core/vox.js';
import { getMaterial } from '../core/materials.js';
import { CP } from './palette.js';
import { model, modelMesh, PoseMesh, contactShadow } from './kit.js';

export const V = 1 / 16;
export const HERO_POSES = ['stand', 'walk1', 'walk2', 'cheer', 'swordOut', 'windUp'];
export const HERO_ALIASES = { idle: 'stand', walkA: 'walk1', walkB: 'walk2', raise: 'cheer', attack: 'swordOut', attack1: 'swordOut', attack2: 'swordOut' };
export const HERO_SLOTS = {
  hair: CP.heroHair,
  band: CP.heroBand,
  tunic: CP.heroTunic,
  leather: CP.heroLeather,
  skin: CP.skin,
  eye: CP.eye,
  gold: CP.heroGold,
};

// M1 palette names for the slots.
const SLOT_ALIASES = { cap: 'band', belt: 'leather' };

// The seven colour slots for a palette (slot names or M1 names; missing ones stay the hero's).
export function heroSlots(palette = {}) {
  const S = { ...HERO_SLOTS };
  for (const [k, v] of Object.entries(palette)) {
    const slot = SLOT_ALIASES[k] ?? k;
    if (slot in S && v != null) S[slot] = v;
  }
  return S;
}

// The hero in one pose (faces +z). S: the seven colour slots. opts.shield: false leaves it out.
export function heroGrid(frame = 'stand', S = HERO_SLOTS, opts = {}) {
  frame = HERO_ALIASES[frame] ?? frame;
  const g = new DenseGrid(16, 16, 16);
  const F = 11; // the face's front layer (z); the head spans z 4..11
  const step = frame === 'walk1' ? 1 : frame === 'walk2' ? -1 : 0;
  g.box(5, 0, 6 + step, 7, 2, 9 + step, S.leather); // legs, rows 14-15
  g.box(9, 0, 6 - step, 11, 2, 9 - step, S.leather);
  g.box(4, 2, 5, 12, 3, 10, S.tunic); // hem, row 13
  g.box(4, 3, 5, 12, 4, 10, S.leather); // belt, row 12
  g.box(7, 3, 9, 9, 4, 10, S.gold); // buckle
  g.box(4, 4, 5, 12, 8, 10, S.tunic); // torso, rows 8-11
  const hand = (x0, z0) => {
    g.box(x0, 6, z0, x0 + 2, 7, z0 + 3, S.tunic);
    g.box(x0, 4, z0, x0 + 2, 6, z0 + 3, S.skin);
  };
  if (frame === 'cheer') {
    // both hands above the head
    for (const x0 of [1, 13]) {
      g.box(x0, 6, 6, x0 + 2, 13, 9, S.tunic);
      g.box(x0, 13, 6, x0 + 2, 15, 9, S.skin);
    }
  } else if (frame === 'swordOut') {
    // sword hand straight forward at hand height
    g.box(2, 5, 6, 4, 7, 12, S.tunic);
    g.box(2, 5, 12, 4, 7, 14, S.skin);
    hand(12, 6);
  } else if (frame === 'windUp') {
    // sword hand raised beside and behind the head
    g.box(1, 6, 4, 3, 13, 7, S.tunic);
    g.box(1, 13, 3, 3, 15, 6, S.skin);
    hand(12, 6);
  } else {
    hand(2, 6 - step); // hands swing against the legs
    hand(12, 6 + step);
  }
  g.box(3, 8, 4, 13, 15, 12, S.hair); // head, rows 1-7 (hair all round)
  for (const [x0, z0] of [[3, 5], [6, 4], [9, 6], [11, 4]]) g.box(x0, 15, z0, x0 + 2, 16, z0 + 4, S.hair); // spiky top, row 0
  g.box(3, 12, 4, 13, 13, 12, S.band); // headband, row 3
  g.box(6, 10, 3, 8, 12, 4, S.band); // band tails at the back
  g.box(8, 9, 3, 10, 11, 4, S.band);
  g.box(4, 8, F, 12, 11, F + 1, S.skin); // face, rows 5-7, 8 wide
  g.box(6, 9, F, 7, 11, F + 1, S.eye); // eyes, rows 5-6
  g.box(9, 9, F, 10, 11, F + 1, S.eye);
  if (frame !== 'cheer' && opts.shield !== false) {
    // shield on the off hand, torso height, toward the camera
    g.box(10, 2, 10, 16, 8, 12, CP.shieldRim);
    g.box(11, 3, 11, 15, 7, 12, CP.shieldWood);
    g.box(12, 4, 11, 14, 6, 12, CP.shieldMark);
  }
  return g;
}

// Base sword: 3 grip + 1 guard + `length` blade + a 1-voxel chisel tip (20 voxels, 1.25 tiles, for
// the base blade), `width` voxels wide, the guard `width` + 4 wide. The blade runs along +z.
export function swordGrid(length = 15, width = 2) {
  const w = Math.max(2, width);
  const g = new DenseGrid(w + 4, 3, length + 5);
  const cx = 2;
  g.box(cx, 1, 0, cx + w, 2, 3, CP.hilt); // grip
  g.box(cx - 2, 1, 3, cx + w + 2, 2, 4, CP.guard); // cross guard
  g.box(cx, 0, 3, cx + w, 3, 4, CP.guard);
  g.box(cx, 1, 4, cx + w, 2, 4 + length, (x) => (x === cx ? CP.bladeHi : x === cx + w - 1 ? CP.bladeLo : CP.blade));
  g.box(cx, 1, 4 + length, cx + 1, 2, 5 + length, CP.bladeHi); // chisel tip
  return g;
}

// The poses as cached models (shared geometry). A palette or a shieldless figure gets its own
// cache entry.
export const heroModel = (pose, S = HERO_SLOTS, opts = {}) => {
  const p = HERO_ALIASES[pose] ?? pose;
  const tag = S === HERO_SLOTS && opts.shield !== false ? '' : `:${Object.values(S).join(',')}:${opts.shield !== false}`;
  return model(`hero:${p}${tag}`, () => heroGrid(p, S, opts));
};

// A sword mesh with its origin on the blade's centre line at the start of the grip.
export function makeSwordMesh(material = getMaterial('character'), length = 15, width = 2) {
  const m = model(`sword:${length}x${width}`, () => swordGrid(length, width), { origin: [2 + Math.max(2, width) / 2, 1.5, 0] });
  const mesh = modelMesh(m, material);
  mesh.name = 'sword';
  return mesh;
}

// Where the grip sits relative to the sword pivot (the pivot is at the body centre, hand height):
// in the forward hand of the swordOut pose when the pivot is not turned.
export const SWORD_GRIP = new THREE.Vector3(-5 * V, 0, 5.5 * V);
export const PIVOT_Y = 6 * V; // hand height, 0.375 tiles

export function makeHero(material = getMaterial('character'), palette = {}) {
  const S = heroSlots(palette);
  const shield = palette.shield !== null;
  const root = new THREE.Group();
  root.name = 'hero';
  const sway = new THREE.Group(); // rolls side to side while walking (the whole model, at the feet)
  const body = new THREE.Group(); // turned by the sword system during a swing
  root.add(sway);
  sway.add(body);
  const poses = {};
  for (const p of HERO_POSES) poses[p] = heroModel(p, S, { shield });
  const figure = new PoseMesh(poses, material, 'stand');
  figure.name = 'hero-figure';
  body.add(figure);

  const swordPivot = new THREE.Group();
  swordPivot.position.set(0, PIVOT_Y, 0);
  swordPivot.rotation.order = 'YXZ';
  const sword = palette.blade === null ? null : makeSwordMesh(material);
  if (sword) {
    sword.position.copy(SWORD_GRIP);
    swordPivot.add(sword);
  }
  body.add(swordPivot);

  const shadow = contactShadow(0.36);
  root.add(shadow);

  // Inert handles for code written against the M1 rig (arms and legs are part of the poses now).
  const armR = new THREE.Object3D();
  const armL = new THREE.Object3D();
  const legL = new THREE.Object3D();
  const legR = new THREE.Object3D();

  const hero = { root, sway, body, figure, swordPivot, sword, shadow, armR, armL, legL, legR };
  hero.setPose = (name) => {
    figure.setPose(HERO_ALIASES[name] ?? name);
    return hero;
  };
  hero.pose = () => figure.pose;
  hero.setSword = (mesh) => {
    if (hero.sword) swordPivot.remove(hero.sword);
    hero.sword = mesh;
    if (!mesh) return;
    if (mesh.position.lengthSq() === 0) mesh.position.copy(SWORD_GRIP);
    swordPivot.add(mesh);
  };
  return hero;
}
