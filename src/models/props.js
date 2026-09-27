// Prop models that stand on tiles: bush, locked door, brazier flame, chest.
// Built in terrain voxels (8 per tile) so they match the ground.
import * as THREE from 'three';
import { VoxelGrid, buildGeometry, rng } from '../core/voxel.js';
import { TV } from '../core/constants.js';
import { C } from '../world/palette.js';
import { cached } from './cache.js';

// Flames glow: unlit, so the crypt's dim light does not darken them.
export const flameMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });

export function makeBushGeometry() {
  const g = new VoxelGrid(rng(42));
  g.ellipsoid(0, 2.5, 0, 3.6, 3.2, 3.6, (x, y, z) => {
    if (y < 0) return null;
    if ((x * 3 + y * 5 + z * 7) % 11 === 0 && y > 1) return C.berry;
    return y > 3 ? C.bushLight : C.bush;
  });
  return buildGeometry(g, TV, [-0.5, 0, -0.5]);
}

export function makeDoorGeometry() {
  const g = new VoxelGrid(rng(43));
  for (let x = 0; x < 8; x++)
    for (let y = 1; y <= 10; y++) {
      const band = y === 3 || y === 8;
      g.box(x, x, y, y, 3, 4, band ? C.iron : x % 2 ? C.wood : C.woodDark, 0.08);
    }
  g.box(3, 4, 5, 6, 5, 5, C.gold, 0.04);
  g.set(3, 5, 5, C.void, 0);
  g.set(4, 5, 5, C.void, 0);
  return buildGeometry(g, TV, [-4, 0, -4]);
}

export function makeFlameGeometry() {
  const g = new VoxelGrid(rng(44));
  g.box(-1, 1, 0, 0, -1, 1, 0xff5a1f, 0.1);
  g.box(-1, 1, 1, 1, -1, 1, 0xff8a1f, 0.1);
  g.box(-1, 0, 2, 2, -1, 0, 0xffb12e, 0.08);
  g.set(0, 2, 1, 0xffb12e, 0.08);
  g.set(0, 3, 0, 0xffe27a, 0.05);
  g.set(0, 4, 0, 0xfff4c4, 0.03);
  return buildGeometry(g, TV, [-0.5, 0, -0.5]);
}

export function makeChestGeometry() {
  const base = new VoxelGrid(rng(45));
  for (let x = -3; x <= 3; x++)
    for (let y = 1; y <= 4; y++)
      for (let z = -2; z <= 2; z++) {
        const trim = Math.abs(x) === 3 || y === 4;
        base.set(x, y, z, trim ? C.gold : C.wood, 0.06);
      }
  base.set(0, 3, 3, C.gold, 0);
  const lid = new VoxelGrid(rng(46));
  for (let x = -3; x <= 3; x++)
    for (let y = 0; y <= 1; y++)
      for (let z = 0; z <= 4; z++) {
        const trim = Math.abs(x) === 3 || z === 4 || x === 0;
        lid.set(x, y, z, trim ? C.gold : C.woodDark, 0.06);
      }
  return {
    base: buildGeometry(base, TV, [-0.5, 0, -0.5]),
    lid: buildGeometry(lid, TV, [-0.5, 0, 0]),
  };
}

export const bushGeometry = () => cached('prop:bush', makeBushGeometry);
export const doorGeometry = () => cached('prop:door', makeDoorGeometry);
export const flameGeometry = () => cached('prop:flame', makeFlameGeometry);
export const chestGeometry = () => cached('prop:chest', makeChestGeometry);
