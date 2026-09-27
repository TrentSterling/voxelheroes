// The hero: a rig of voxel parts (legs, torso and head, arms with the shield,
// and a sword on a pivot at the body centre) posed by entities/player.js.
// The same rig dressed in another palette makes a townsperson:
//
//   makeHero(voxelMaterial, { tunic: 0x9a5b2e, tunicLight: 0xb8773f, cap: 0x6b4a8e, blade: null, shield: null })
//
// Palette keys are HERO's; missing ones fall back to HERO. `blade: null`
// leaves out the sword (hero.sword is then null), `shield: null` the shield.
import * as THREE from 'three';
import { voxelMaterial } from '../core/voxel.js';
import { MV, part } from './part.js';

export const HERO = {
  tunic: 0x3c9a3f,
  tunicLight: 0x56b456,
  cap: 0x3c9a3f,
  skin: 0xf4c39a,
  hair: 0xe6b83c,
  eye: 0x1d1d2b,
  belt: 0x6b4423,
  gold: 0xf1c232,
  boot: 0x5a3a22,
  leg: 0xe9dcb4,
  shield: 0x2e5fd0,
  shieldRim: 0xd9a21e,
  emblem: 0xd8334a,
  blade: 0xe3e8ef,
  bladeEdge: 0xffffff,
  grip: 0x5a3a22,
};

// The starting sword, pointing along +z from its grip. The sword system can
// build other blades and swap them in with hero.setSword(mesh).
export function makeSwordMesh(material = voxelMaterial, palette = HERO) {
  const P = { ...HERO, ...palette };
  const sword = part((g) => {
    g.set(0, 0, -1, P.gold, 0.02);
    g.box(0, 0, 0, 0, 0, 2, P.grip);
    g.box(-2, 2, 0, 0, 3, 3, P.gold, 0.03);
    g.box(0, 0, -1, 1, 3, 3, P.gold, 0.03);
    g.box(0, 0, 0, 0, 4, 16, P.blade, 0.03);
    g.box(0, 0, 1, 1, 4, 15, P.bladeEdge, 0.02);
    g.set(0, 0, 17, P.bladeEdge, 0);
  }, [0, 0, 0], material, 7);
  sword.position.set(0, 0, 0.28);
  return sword;
}

// Facing +z. The hero's right hand (sword) is on -x, the shield on +x.
export function makeHero(material = voxelMaterial, palette = HERO) {
  const P = { ...HERO, ...palette }; // this figure's colours
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const legR = part((g) => {
    g.box(-3, -1, 0, 1, -1, 1, P.boot);
    g.box(-3, -1, 2, 3, -1, 1, P.leg);
  }, [-2, 4, 0], material, 2);
  const legL = part((g) => {
    g.box(1, 3, 0, 1, -1, 1, P.boot);
    g.box(1, 3, 2, 3, -1, 1, P.leg);
  }, [2, 4, 0], material, 3);

  const torso = part((g) => {
    g.box(-4, 4, 4, 8, -2, 2, P.tunic);
    g.box(-5, 5, 4, 4, -3, 3, P.tunic);
    g.box(-4, 4, 8, 8, -2, 2, P.tunicLight);
    g.box(-4, 4, 5, 5, -2, 2, P.belt);
    g.set(0, 5, 2, P.gold, 0);
    // head
    g.box(-4, 4, 9, 15, -3, 3, P.skin, 0.03);
    // cap
    g.box(-4, 4, 14, 15, -3, 3, P.cap);
    g.box(-3, 3, 16, 16, -2, 2, P.cap);
    g.box(-1, 1, 12, 14, -5, -4, P.cap);
    g.box(0, 0, 10, 12, -6, -6, P.cap);
    // hair
    g.box(-4, 4, 13, 13, 3, 3, P.hair);
    g.box(-4, -4, 10, 13, -3, 0, P.hair);
    g.box(4, 4, 10, 13, -3, 0, P.hair);
    g.box(-4, 4, 10, 13, -3, -3, P.hair);
    g.box(-3, -2, 12, 12, 3, 3, P.hair);
    // eyes
    g.box(-2, -2, 10, 11, 3, 3, P.eye, 0);
    g.box(2, 2, 10, 11, 3, 3, P.eye, 0);
    // ears
    g.box(-5, -5, 11, 12, 0, 1, P.skin, 0.02);
    g.box(5, 5, 11, 12, 0, 1, P.skin, 0.02);
    g.set(-6, 12, 0, P.skin, 0.02);
    g.set(6, 12, 0, P.skin, 0.02);
  }, [0, 0, 0], material, 4);

  const armR = part((g) => {
    g.box(-6, -5, 7, 8, -1, 0, P.tunic);
    g.box(-6, -5, 5, 6, -1, 0, P.skin, 0.03);
  }, [-5, 8, 0], material, 5);

  const armL = part((g) => {
    g.box(5, 6, 7, 8, -1, 0, P.tunic);
    g.box(5, 6, 5, 6, -1, 0, P.skin, 0.03);
    if (P.shield === null) return;
    // shield
    g.box(7, 7, 2, 9, -3, 2, P.shieldRim, 0.03);
    g.box(7, 7, 3, 8, -2, 1, P.shield);
    g.box(8, 8, 5, 6, -1, 0, P.emblem, 0.02);
    g.box(8, 8, 4, 7, -1, 0, P.emblem, 0.02);
    g.box(8, 8, 5, 6, -2, 1, P.emblem, 0.02);
  }, [5, 8, 0], material, 6);

  body.add(legR, legL, torso, armR, armL);

  // Sword pivot sits at the body centre so the swing sweeps an arc.
  const swordPivot = new THREE.Group();
  swordPivot.position.set(0, 6 * MV, 0);
  swordPivot.rotation.order = 'YXZ';
  const sword = P.blade === null ? null : makeSwordMesh(material, P);
  if (sword) swordPivot.add(sword);
  body.add(swordPivot);

  const hero = { root, body, legL, legR, armL, armR, swordPivot, sword };
  hero.setSword = (mesh) => {
    if (hero.sword) swordPivot.remove(hero.sword);
    hero.sword = mesh;
    if (mesh) swordPivot.add(mesh);
  };
  return hero;
}
