import { VoxelGrid, buildGeometry, rng } from '../core/voxel.js';
import { MV } from './part.js';
import { cached } from './cache.js';

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

// Colour variants: body, highlight, and the particle colours it bursts into.
export const SLIME_VARIANTS = {
  red: { body: 0xe0404a, light: 0xff8088, burst: [0xe0404a, 0xff8088, 0xb02a36] },
  blue: { body: 0x3f7fe0, light: 0x8ab8ff, burst: [0x3f7fe0, 0x8ab8ff, 0x2a55a8] },
};

export const slimeGeometry = (variant = 'red') =>
  cached(`slime:${variant}`, () => makeSlime(SLIME_VARIANTS[variant].body, SLIME_VARIANTS[variant].light));
