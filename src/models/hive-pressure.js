import { DenseGrid } from '../core/vox.js';
import { model } from './kit.js';

// Original quick voxel silhouettes; brass irrigation was swallowed by roots.
export const nurseryPumpModel = () => model('hive-nursery-pump', () => {
  const g = new DenseGrid(24, 32, 20), dark = 0x344e4c, brass = 0xcba26a, green = 0x74b58c;
  g.box(1, 0, 1, 23, 4, 19, dark); g.box(5, 4, 4, 19, 23, 16, brass);
  g.box(7, 7, 3, 17, 20, 17, dark);
  for (const y of [8, 13, 18]) g.box(4, y, 1, 20, y + 2, 19, brass);
  g.box(9, 22, 7, 15, 28, 13, 0x83d4c6); g.box(7, 28, 5, 17, 30, 15, brass);
  for (const [x, z] of [[2, 3], [19, 14], [3, 15]]) {
    g.box(x, 0, z, x + 3, 15, z + 3, 0x695e47);
    g.box(x - 1, 12, z - 1, x + 4, 16, z + 4, green);
  }
  return g;
});
export const nurseryValveModel = (open = false) => model(`hive-valve-${open ? 'open' : 'sealed'}`, () => {
  const g = new DenseGrid(16, 18, 16), brass = 0xcba26a;
  g.box(2, 0, 2, 14, 4, 14, 0x344e4c); g.box(5, 4, 5, 11, open ? 8 : 12, 11, brass);
  if (open) {
    g.box(2, 5, 3, 7, 7, 7, brass); g.box(9, 4, 10, 14, 6, 14, brass);
    g.box(5, 7, 5, 11, 9, 11, 0x83d4c6);
  } else {
    for (let x = 2; x < 14; x++) for (let y = 6; y < 18; y++) {
      const r = Math.hypot(x - 7.5, y - 11.5);
      if (r > 3 && r < 6) g.box(x, y, 6, x + 1, y + 1, 10, brass);
    }
    g.box(6, 10, 4, 10, 14, 12, 0xf0bd68);
  }
  return g;
});
