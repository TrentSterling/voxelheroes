import { VoxelGrid, buildGeometry, rng } from '../core/voxel.js';
import { MV } from './part.js';
import { cached } from './cache.js';

// The pebble a spitter spits.
export function makeRock() {
  const g = new VoxelGrid(rng(13));
  g.ellipsoid(0, 0, 0, 2.4, 2.4, 2.4, (x, y) => (y > 0 ? 0xb4a894 : 0x8a7e6c));
  return buildGeometry(g, MV, [-0.5, -0.5, -0.5]);
}

export const rockGeometry = () => cached('rock', makeRock);
