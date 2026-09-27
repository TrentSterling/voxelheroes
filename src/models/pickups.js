// Pickup models: heart, gems and the small key.
import { VoxelGrid, buildGeometry, rng } from '../core/voxel.js';
import { MV } from './part.js';
import { cached } from './cache.js';

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

export const heartGeometry = () => cached('heart', makeHeart);
export const gemGeometry = (color) => cached(`gem:${color}`, () => makeGem(color));
export const keyGeometry = () => cached('key', makeKey);
