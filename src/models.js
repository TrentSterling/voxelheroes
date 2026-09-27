import * as THREE from 'three';
import { VoxelGrid, buildGeometry, voxelMaterial, rng } from './core/voxel.js';

// Character voxels are finer than terrain voxels.
export const MV = 1 / 14;

// A part is meshed so its pivot (in voxel coords) sits at the mesh origin,
// letting us rotate limbs around shoulders and hips.
function part(fill, pivot = [0, 0, 0], material = voxelMaterial, seed = 1) {
  const g = new VoxelGrid(rng(seed));
  fill(g);
  const geo = buildGeometry(g, MV, [-pivot[0], -pivot[1], -pivot[2]]);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set((pivot[0] - 0.5) * MV, pivot[1] * MV, (pivot[2] - 0.5) * MV);
  mesh.castShadow = true;
  return mesh;
}

const HERO = {
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
  swordPivot.add(sword);
  body.add(swordPivot);

  return { root, body, legL, legR, armL, armR, swordPivot, sword };
}

export function makeSlime(color = 0xe0404a, light = 0xff8088) {
  const g = new VoxelGrid(rng(11));
  g.ellipsoid(0, 0, 0, 5.4, 7.5, 5.4, (x, y) => {
    if (y < 0) return null;
    if (y > 4 && x < 1) return light;
    return color;
  });
  // eyes on the front surface
  for (const ex of [-3, -2, 2, 3])
    for (const ey of [3, 4]) {
      const ze = Math.floor(Math.sqrt(Math.max(0, 5.4 ** 2 * (1 - ey ** 2 / 7.5 ** 2) - ex ** 2)));
      const pupil = (ex === -2 || ex === 2) && ey === 3;
      g.set(ex, ey, ze + 1, pupil ? 0x1d1d2b : 0xffffff, 0);
    }
  return buildGeometry(g, MV, [-0.5, 0, -0.5]);
}

export function makeSpitter() {
  const body = 0x8e4fd0;
  const dark = 0x5d2e94;
  const g = new VoxelGrid(rng(12));
  g.ellipsoid(0, 6, 0, 4.6, 4.6, 4.6, (x, y) => (y > 8 && x < 1 ? 0xb07ae8 : body));
  // snout
  g.box(-1, 1, 4, 6, 4, 8, dark);
  g.set(0, 5, 8, 0x1d1d2b, 0);
  // eyes
  for (const ex of [-3, 3]) {
    g.box(ex - (ex < 0 ? 0 : 1), ex + (ex < 0 ? 1 : 0), 8, 9, 4, 4, 0xffffff, 0);
    g.set(ex < 0 ? ex + 1 : ex - 1, 8, 5, 0x1d1d2b, 0);
  }
  // stubby legs
  for (const lx of [-3, 2])
    for (const lz of [-3, 2]) g.box(lx, lx + 1, 0, 2, lz, lz + 1, dark);
  return buildGeometry(g, MV, [-0.5, 0, -0.5]);
}

export function makeRock() {
  const g = new VoxelGrid(rng(13));
  g.ellipsoid(0, 0, 0, 2.4, 2.4, 2.4, (x, y) => (y > 0 ? 0xb4a894 : 0x8a7e6c));
  return buildGeometry(g, MV, [-0.5, -0.5, -0.5]);
}

export function makeHeart() {
  const rows = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
  const g = new VoxelGrid(rng(14));
  rows.forEach((row, i) =>
    row.split('').forEach((ch, x) => {
      if (ch !== 'X') return;
      const hi = i === 1 && x === 1;
      g.box(x - 3, x - 3, 5 - i, 5 - i, 0, 1, hi ? 0xffb0bc : 0xe8364a, 0.03);
    })
  );
  return buildGeometry(g, MV, [-0.5, 0, -1]);
}

export function makeGem(color) {
  const g = new VoxelGrid(rng(15));
  for (let y = -4; y <= 4; y++) {
    const hw = y >= 0 ? 2 - Math.floor(y / 2) : 2 - Math.floor(-y / 2);
    for (let x = -hw; x <= hw; x++) g.box(x, x, y + 4, y + 4, 0, 1, x === -hw && y >= 0 ? 0xffffff : color, 0.05);
  }
  return buildGeometry(g, MV, [-0.5, 0, -1]);
}

export function makeKey() {
  const gold = 0xf1c232;
  const g = new VoxelGrid(rng(16));
  for (let x = -2; x <= 2; x++)
    for (let y = 8; y <= 12; y++) {
      const hole = Math.abs(x) <= 1 && y >= 9 && y <= 11;
      if (!hole) g.box(x, x, y, y, 0, 1, x === -2 && y > 9 ? 0xfff0b0 : gold, 0.04);
    }
  g.box(0, 0, 1, 7, 0, 1, gold, 0.04);
  g.box(1, 2, 1, 2, 0, 1, gold, 0.04);
  g.box(1, 1, 4, 4, 0, 1, gold, 0.04);
  return buildGeometry(g, MV, [-0.5, 0, -1]);
}
