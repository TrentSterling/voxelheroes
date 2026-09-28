// Enemy and NPC models (art bible section 10), 16 voxels per tile, facing +z, standing on y = 0.
// Animation frames are whole models (see PoseMesh in kit.js). Sizes: small enemies 0.6 to 1 tile,
// medium about 1.5, large 2.5 and up. Every design here is our own.
import * as THREE from 'three';
import { DenseGrid, hash3 } from '../core/vox.js';
import { getMaterial, makeGlowMaterial } from '../core/materials.js';
import { CP } from './palette.js';
import { model, modelGeometry, jitter } from './kit.js';

// ---------------------------------------------------------------- slime (small)
// A hopping jelly, two frames: 0 tall (in the air, 12 across, 9 tall), 1 squashed (on the ground,
// 14 across, 7 tall). White eyes with dark pupils on the front.
export const SLIME_COLORS = {
  green: { body: CP.slime, lo: CP.slimeLo, hi: CP.slimeHi },
  red: { body: CP.slimeRed, lo: CP.slimeRedLo, hi: CP.slimeRedHi },
  blue: { body: CP.slimeBlue, lo: CP.slimeBlueLo, hi: CP.slimeBlueHi },
};

export function slime(frame = 0, variant = 'green') {
  const P = SLIME_COLORS[variant] ?? SLIME_COLORS.green;
  const h = frame ? 7 : 9;
  const rx = frame ? 7 : 6;
  const g = new DenseGrid(16, 11, 16);
  g.ellipsoid(8, 0, 8, rx, h, rx, (x, y, z) => (y > h - 3 ? P.hi : y < 2 ? P.lo : jitter(P.body, x, y, z, 0.05)));
  const ey = frame ? 3 : 4;
  g.stampFront(5, ey + 1, ['WW..WW', 'KW..KW'], { W: CP.eyeHi, K: CP.eye });
  return g;
}
export const slimeModel = (frame, variant = 'green') => model(`slime:${variant}:${frame}`, () => slime(frame, variant));

// ---------------------------------------------------------------- spitter (small)
// A squat purple toad (ours) that spits pebbles: a round body with a pale belly, a short snout
// tube with a dark mouth, two eye bumps on top and four stubby feet. Frame 1 puffs the cheeks and
// pushes the snout out (aiming). 14 x 12 x 14, 0.875 tile across.
export function spitter(frame = 0) {
  const g = new DenseGrid(14, 12, 14);
  g.ellipsoid(7, 4.5, 6.5, 6, 4.5, 5.5, (x, y, z) => {
    if (y < 2) return CP.toadLo;
    if (y > 6 && hash3(x, y, z, 31) > 0.6) return CP.toadHi;
    return jitter(CP.toad, x, y, z, 0.05, 33);
  });
  g.paint(3, 1, 9, 11, 5, 12, CP.toadBelly); // pale belly on the front
  const puff = frame ? 1 : 0;
  g.box(5 - puff, 3, 10, 9 + puff, 7 + puff, 12 + puff, CP.toadLo); // snout
  g.box(6, 4, 11 + puff, 8, 6 + puff, 12 + puff, CP.toadMouth); // mouth
  for (const x0 of [3, 9]) {
    g.box(x0, 8, 6, x0 + 2, 11, 9, CP.toad); // eye bumps
    g.box(x0, 9, 9, x0 + 2, 11, 10, CP.eyeHi);
    g.set(x0 + (x0 < 7 ? 1 : 0), 9, 9, CP.eye);
  }
  for (const [x, z] of [[2, 3], [10, 3], [2, 9], [10, 9]]) g.box(x, 0, z, x + 2, 1, z + 2, CP.toadLo); // feet
  return g;
}
export const spitterModel = (frame) => model(`spitter:${frame}`, () => spitter(frame));

// The pebble a spitter spits: a lumpy ball 5 voxels across, lighter on top.
export function pebble() {
  const g = new DenseGrid(6, 6, 6);
  g.ellipsoid(3, 3, 3, 2.6, 2.5, 2.6, (x, y, z) => (y > 2 ? CP.pebble : hash3(x, y, z, 7) < 0.5 ? CP.pebbleLo : CP.pebble));
  return g;
}
export const pebbleModel = () => model('pebble', pebble, { origin: [3, 3, 3] }); // centred

// ---------------------------------------------------------------- more enemies (ported from the lab)
// Thornbug (small, ~1 tile): a round shelled beetle with a horn.
export function thornbug() {
  const g = new DenseGrid(16, 11, 16);
  g.ellipsoid(8, 1, 7.5, 7, 8, 7, (x, y, z) => (y > 6 ? CP.beetle : jitter(CP.beetleLo, x, y, z, 0.05)));
  g.clear(0, 0, 0, 16, 1, 16);
  g.box(7, 7, 2, 9, 9, 13, CP.beetleLo); // shell seam
  g.box(5, 1, 12, 11, 5, 15, CP.beetleFace);
  g.box(6, 3, 14, 7, 4, 15, CP.beetleEye);
  g.box(9, 3, 14, 10, 4, 15, CP.beetleEye);
  g.box(7, 4, 15, 9, 5, 16, CP.beetleHorn);
  g.box(7, 5, 15, 9, 7, 16, CP.beetleHorn);
  for (const [x, z] of [[2, 4], [2, 8], [2, 11], [13, 4], [13, 8], [13, 11]]) g.box(x, 0, z, x + 1, 2, z + 1, CP.beetleFace); // legs
  return g;
}

// Skeleton (small, 1 tile tall) with a rusty buckler.
export function skeleton() {
  const g = new DenseGrid(16, 16, 12);
  g.box(4, 0, 5, 7, 2, 8, CP.boneLo);
  g.box(9, 0, 5, 12, 2, 8, CP.boneLo);
  g.box(5, 2, 5, 6, 5, 7, CP.bone);
  g.box(10, 2, 5, 11, 5, 7, CP.bone);
  g.box(4, 5, 4, 12, 9, 8, (x, y) => (y % 2 ? CP.bone : CP.boneLo)); // ribs
  g.box(7, 5, 4, 9, 9, 8, CP.bone);
  g.box(2, 5, 5, 4, 9, 7, CP.bone);
  g.box(12, 5, 5, 14, 9, 7, CP.bone);
  g.box(3, 9, 2, 13, 16, 10, (x, y, z) => jitter(CP.bone, x, y, z, 0.04)); // skull
  g.box(4, 10, 9, 7, 13, 10, CP.socket);
  g.box(9, 10, 9, 12, 13, 10, CP.socket);
  g.box(5, 11, 9, 6, 12, 10, CP.redEye);
  g.box(10, 11, 9, 11, 12, 10, CP.redEye);
  g.box(6, 9, 9, 10, 10, 10, 0x2a2a30);
  g.box(12, 2, 8, 16, 9, 10, CP.rust); // buckler
  g.box(13, 3, 9, 15, 8, 10, CP.rustHi);
  return g;
}

// Bat (small, flying), two wing frames.
export function bat(frame = 0) {
  const g = new DenseGrid(20, 8, 8);
  g.box(7, 2, 2, 13, 7, 7, CP.bat);
  g.box(7, 7, 3, 9, 8, 5, CP.bat); // ears
  g.box(11, 7, 3, 13, 8, 5, CP.bat);
  g.box(8, 4, 6, 9, 5, 7, CP.beetleEye);
  g.box(11, 4, 6, 12, 5, 7, CP.beetleEye);
  const up = frame ? 2 : 0;
  g.box(0, 3 + up, 3, 7, 5 + up, 5, CP.batWing);
  g.box(13, 3 + up, 3, 20, 5 + up, 5, CP.batWing);
  g.box(1, 2 + up, 3, 3, 3 + up, 5, CP.batLo);
  g.box(17, 2 + up, 3, 19, 3 + up, 5, CP.batLo);
  return g;
}

// Sentry (medium, 1.5 tiles tall): a bucket-helmed guard with a plume, tabard and mace.
export function sentry() {
  const g = new DenseGrid(22, 26, 18);
  g.box(7, 0, 7, 10, 7, 10, CP.steelLo); // rod legs
  g.box(12, 0, 7, 15, 7, 10, CP.steelLo);
  g.box(6, 0, 7, 10, 1, 11, CP.steelLo); // feet
  g.box(12, 0, 7, 16, 1, 11, CP.steelLo);
  g.box(5, 7, 5, 17, 16, 13, CP.steel); // barrel torso
  g.box(8, 7, 13, 14, 14, 14, CP.tabard);
  g.box(3, 9, 7, 5, 15, 11, CP.steelLo); // arms
  g.box(17, 9, 7, 19, 15, 11, CP.steelLo);
  g.box(1, 12, 7, 5, 16, 11, CP.steel); // pauldrons
  g.box(17, 12, 7, 21, 16, 11, CP.steel);
  g.box(4, 16, 4, 18, 24, 14, CP.steel); // bucket helmet
  g.box(5, 19, 14, 17, 20, 15, CP.slit); // visor slit
  g.set(8, 19, 14, CP.redEye);
  g.set(13, 19, 14, CP.redEye);
  g.box(9, 24, 6, 13, 26, 12, CP.tabard); // plume
  g.box(2, 3, 12, 3, 12, 13, CP.heroLeather); // mace
  g.box(0, 11, 11, 5, 15, 15, CP.steelLo);
  return g;
}

// Golem (boss scale: 3 x 2 tiles footprint, about 3 tiles tall) with a glowing core weak point.
export function golem() {
  const g = new DenseGrid(48, 46, 32);
  const rock = (x, y, z) => {
    const n = hash3(x >> 1, y >> 1, z >> 1, 7);
    if (y > 30 && n > 0.72) return CP.golemMoss;
    return n < 0.3 ? CP.golemLo : jitter(CP.golem, x, y, z, 0.05, 3);
  };
  g.box(10, 0, 9, 20, 12, 21, rock); // legs
  g.box(28, 0, 9, 38, 12, 21, rock);
  g.box(8, 12, 6, 40, 34, 26, rock); // torso
  g.box(0, 14, 10, 10, 36, 20, rock); // arms
  g.box(38, 14, 10, 48, 36, 20, rock);
  g.box(0, 8, 9, 11, 16, 21, CP.golemLo); // fists
  g.box(37, 8, 9, 48, 16, 21, CP.golemLo);
  g.box(15, 34, 8, 33, 46, 24, rock); // head
  g.box(18, 38, 23, 22, 41, 24, CP.golemEye);
  g.box(26, 38, 23, 30, 41, 24, CP.golemEye);
  g.box(18, 35, 23, 30, 36, 24, 0x3a3630);
  g.box(20, 18, 25, 28, 28, 26, CP.golemCore); // core crystal (weak point)
  return g;
}

// Stone brute (large, 2.5 tiles wide): rigid parts in a Group so they can move as blocks
// (torso, head, upper arms, forearms, fists, legs) and one amber glowing eye slit.
export function stoneBrute(material = getMaterial('character')) {
  const stone = 0x7a8466;
  const stoneLo = 0x59624a;
  const moss = 0x8fb04a;
  const rock = (x, y, z) => (y > 8 && hash3(x >> 1, y >> 1, z >> 1, 11) > 0.8 ? moss : hash3(x, y, z, 5) < 0.2 ? stoneLo : stone);
  const V = 1 / 16;
  const G = new THREE.Group();
  G.name = 'stone-brute';
  const part = (name, sx, sy, sz, fill, at) => {
    const m = new THREE.Mesh(
      model(`brute:${name}`, () => new DenseGrid(sx, sy, sz).box(0, 0, 0, sx, sy, sz, fill)).geometry,
      material
    );
    m.name = name;
    m.position.set(at[0] * V, at[1] * V, at[2] * V);
    m.castShadow = m.receiveShadow = true;
    m.userData.sharedGeometry = true;
    G.add(m);
    return m;
  };
  part('leg-l', 7, 10, 9, stoneLo, [-6, 0, 0]);
  part('leg-r', 7, 10, 9, stoneLo, [6, 0, 0]);
  part('torso', 22, 18, 14, rock, [0, 10, 0]);
  part('head', 12, 10, 10, rock, [0, 28, 1]);
  part('arm-l', 6, 10, 8, rock, [-14, 18, 0]);
  part('arm-r', 6, 10, 8, rock, [14, 18, 0]);
  part('forearm-l', 6, 8, 8, stoneLo, [-15, 10, 1]);
  part('forearm-r', 6, 8, 8, stoneLo, [15, 10, 1]);
  part('fist-l', 9, 8, 10, rock, [-15.5, 2, 2]);
  part('fist-r', 9, 8, 10, rock, [15.5, 2, 2]);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(8 * V, 1 * V, 0.5 * V), makeGlowMaterial(0xffb03a, 3));
  eye.name = 'eye';
  eye.position.set(0, 33.5 * V, 6.1 * V);
  eye.userData.noShadow = true;
  G.add(eye);
  return G;
}

// ---------------------------------------------------------------- NPCs
// Village elder, 16 tall, with a hood, a white beard and a staff with a blue gem.
export function elder() {
  const g = new DenseGrid(16, 16, 12);
  g.box(3, 0, 3, 13, 7, 9, (x, y, z) => jitter(CP.robe, x, y, z, 0.04)); // robe
  g.box(2, 0, 3, 14, 2, 9, CP.robeLo);
  g.box(3, 7, 2, 13, 14, 10, CP.robe); // hood
  g.box(5, 7, 8, 11, 12, 10, CP.skin);
  g.box(6, 9, 9, 7, 10, 10, CP.eye);
  g.box(9, 9, 9, 10, 10, 10, CP.eye);
  g.box(5, 5, 8, 11, 8, 10, CP.beard); // beard
  g.box(6, 4, 9, 10, 5, 10, CP.beard);
  g.box(14, 0, 6, 15, 15, 7, CP.staff); // staff and gem
  g.box(13, 14, 5, 16, 16, 8, CP.staffGem);
  return g;
}

// ---------------------------------------------------------------- markers
// Leader marker: a small floating violet gem, 5 voxels across; float it about 0.6 tile up.
export function leaderGem() {
  const g = new DenseGrid(5, 5, 5);
  for (let y = 0; y < 5; y++)
    for (let z = 0; z < 5; z++)
      for (let x = 0; x < 5; x++) if (Math.abs(x - 2) + Math.abs(y - 2) + Math.abs(z - 2) <= 2) g.set(x, y, z, y > 2 ? 0xd6a8ff : 0xa45ef0);
  return g;
}

// Alert marker: a red "!" to float about 1 tile above an enemy that has seen the hero.
export function alertMark() {
  const g = new DenseGrid(2, 8, 1);
  g.box(0, 3, 0, 2, 8, 1, 0xff2a2a);
  g.box(0, 0, 0, 2, 2, 1, 0xff2a2a);
  return g;
}

// Cached models of the ported characters, by name.
export const CHARACTER_MODELS = {
  thornbug: () => model('thornbug', thornbug),
  skeleton: () => model('skeleton', skeleton),
  bat0: () => model('bat:0', () => bat(0)),
  bat1: () => model('bat:1', () => bat(1)),
  sentry: () => model('sentry', sentry),
  golem: () => model('golem', golem),
  elder: () => model('elder', elder),
  leaderGem: () => model('leader-gem', leaderGem),
  alertMark: () => model('alert-mark', alertMark),
};

export { modelGeometry };
