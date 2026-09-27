import { VoxelGrid, buildGeometry, rng } from '../core/voxel.js';
import { MV } from './part.js';
import { cached } from './cache.js';

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

export const spitterGeometry = () => cached('spitter', makeSpitter);
