// The hero: a rig of voxel parts (legs, torso and head, arms with the shield,
// and a sword on a pivot at the body centre) posed by entities/player.js.
import * as THREE from 'three';
import { voxelMaterial } from '../core/voxel.js';
import { MV, part } from './part.js';

export const HERO = {
  tunic: 0x3c9a3f,
  tunicLight: 0x56b456,
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
export function makeSwordMesh(material = voxelMaterial) {
  const sword = part((g) => {
    g.set(0, 0, -1, HERO.gold, 0.02);
    g.box(0, 0, 0, 0, 0, 2, HERO.grip);
    g.box(-2, 2, 0, 0, 3, 3, HERO.gold, 0.03);
    g.box(0, 0, -1, 1, 3, 3, HERO.gold, 0.03);
    g.box(0, 0, 0, 0, 4, 16, HERO.blade, 0.03);
    g.box(0, 0, 1, 1, 4, 15, HERO.bladeEdge, 0.02);
    g.set(0, 0, 17, HERO.bladeEdge, 0);
  }, [0, 0, 0], material, 7);
  sword.position.set(0, 0, 0.28);
  return sword;
}

// Facing +z. The hero's right hand (sword) is on -x, the shield on +x.
export function makeHero(material = voxelMaterial) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const legR = part((g) => {
    g.box(-3, -1, 0, 1, -1, 1, HERO.boot);
    g.box(-3, -1, 2, 3, -1, 1, HERO.leg);
  }, [-2, 4, 0], material, 2);
  const legL = part((g) => {
    g.box(1, 3, 0, 1, -1, 1, HERO.boot);
    g.box(1, 3, 2, 3, -1, 1, HERO.leg);
  }, [2, 4, 0], material, 3);

  const torso = part((g) => {
    g.box(-4, 4, 4, 8, -2, 2, HERO.tunic);
    g.box(-5, 5, 4, 4, -3, 3, HERO.tunic);
    g.box(-4, 4, 8, 8, -2, 2, HERO.tunicLight);
    g.box(-4, 4, 5, 5, -2, 2, HERO.belt);
    g.set(0, 5, 2, HERO.gold, 0);
    // head
    g.box(-4, 4, 9, 15, -3, 3, HERO.skin, 0.03);
    // cap
    g.box(-4, 4, 14, 15, -3, 3, HERO.tunic);
    g.box(-3, 3, 16, 16, -2, 2, HERO.tunic);
    g.box(-1, 1, 12, 14, -5, -4, HERO.tunic);
    g.box(0, 0, 10, 12, -6, -6, HERO.tunic);
    // hair
    g.box(-4, 4, 13, 13, 3, 3, HERO.hair);
    g.box(-4, -4, 10, 13, -3, 0, HERO.hair);
    g.box(4, 4, 10, 13, -3, 0, HERO.hair);
    g.box(-4, 4, 10, 13, -3, -3, HERO.hair);
    g.box(-3, -2, 12, 12, 3, 3, HERO.hair);
    // eyes
    g.box(-2, -2, 10, 11, 3, 3, HERO.eye, 0);
    g.box(2, 2, 10, 11, 3, 3, HERO.eye, 0);
    // ears
    g.box(-5, -5, 11, 12, 0, 1, HERO.skin, 0.02);
    g.box(5, 5, 11, 12, 0, 1, HERO.skin, 0.02);
    g.set(-6, 12, 0, HERO.skin, 0.02);
    g.set(6, 12, 0, HERO.skin, 0.02);
  }, [0, 0, 0], material, 4);

  const armR = part((g) => {
    g.box(-6, -5, 7, 8, -1, 0, HERO.tunic);
    g.box(-6, -5, 5, 6, -1, 0, HERO.skin, 0.03);
  }, [-5, 8, 0], material, 5);

  const armL = part((g) => {
    g.box(5, 6, 7, 8, -1, 0, HERO.tunic);
    g.box(5, 6, 5, 6, -1, 0, HERO.skin, 0.03);
    // shield
    g.box(7, 7, 2, 9, -3, 2, HERO.shieldRim, 0.03);
    g.box(7, 7, 3, 8, -2, 1, HERO.shield);
    g.box(8, 8, 5, 6, -1, 0, HERO.emblem, 0.02);
    g.box(8, 8, 4, 7, -1, 0, HERO.emblem, 0.02);
    g.box(8, 8, 5, 6, -2, 1, HERO.emblem, 0.02);
  }, [5, 8, 0], material, 6);

  body.add(legR, legL, torso, armR, armL);

  // Sword pivot sits at the body centre so the swing sweeps an arc.
  const swordPivot = new THREE.Group();
  swordPivot.position.set(0, 6 * MV, 0);
  swordPivot.rotation.order = 'YXZ';
  const sword = makeSwordMesh(material);
  swordPivot.add(sword);
  body.add(swordPivot);

  const hero = { root, body, legL, legR, armL, armR, swordPivot, sword };
  hero.setSword = (mesh) => {
    swordPivot.remove(hero.sword);
    hero.sword = mesh;
    swordPivot.add(mesh);
  };
  return hero;
}
