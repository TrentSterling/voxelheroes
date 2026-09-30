import { DenseGrid } from '../core/vox.js';
import { model } from './kit.js';

export const rootStumpModel = () => model('tobin-root-stump', () => {
  const g = new DenseGrid(16, 11, 16);
  g.box(1, 0, 6, 15, 3, 10, 0x61402b);
  g.box(6, 0, 1, 10, 3, 15, 0x61402b);
  for (let y = 1; y < 10; y++) for (let z = 2; z < 14; z++) for (let x = 2; x < 14; x++) {
    const r = Math.hypot(x - 7.5, z - 7.5);
    if (r > 5.6) continue;
    const bark = (x + z * 3) % 4 === 0 ? 0x513523 : 0x80543a;
    g.set(x, y, z, y === 9 ? (Math.floor(r) % 2 ? 0xc99559 : 0xe0b578) : bark);
  }
  g.box(7, 9, 6, 9, 10, 10, 0x61402b);
  return g;
});

export const potSupplyModel = () => model('cellar-pot-supply', () => {
  const g = new DenseGrid(16, 20, 16);
  g.box(1, 0, 1, 15, 8, 15, (x, y, z) => y === 0 || y === 6 || x === 1 || x === 14 || z === 1 || z === 14 ? 0x805b37 : 0x4a3325);
  g.ellipsoid(8, 12, 8, 5, 5, 5, 0xb5653e);
  g.box(4, 15, 4, 12, 19, 12, 0xb5653e);
  g.box(5, 16, 5, 11, 19, 11, null);
  g.box(5, 16, 5, 11, 17, 11, 0x493026);
  return g;
});

export const tobinKeepsakeModel = () => model('tobin-keepsake', () => {
  const g = new DenseGrid(14, 20, 4);
  for (let y = 8; y < 20; y++) for (let x = 1; x < 13; x++) {
    const r = Math.hypot(x - 6.5, y - 13.5);
    if (r >= 4 && r <= 5.6) g.box(x, y, 1, x + 1, y + 1, 3, 0xc59a47);
  }
  g.box(3, 1, 0, 11, 10, 4, 0xe7bf5c);
  g.box(4, 2, 0, 10, 9, 4, 0x60845a);
  g.box(6, 3, 0, 8, 8, 1, 0xd1e18b);
  return g;
});
