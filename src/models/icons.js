// HUD icons as voxel models (our own designs, from the look lab): a heart that can be full, half
// or empty, a magic vial with a fill level, a coin and a small key. Faces +z; 16 voxels per tile
// like every model, scaled by whoever draws them.
import { DenseGrid } from '../core/vox.js';
import { CP } from './palette.js';
import { model } from './kit.js';

export function heartIcon(fill = 1) {
  const g = new DenseGrid(9, 8, 3);
  const rows = ['.XXX.XXX.', 'XHHXXXXXX', 'XHXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
  rows.forEach((r, i) =>
    [...r].forEach((c, x) => {
      if (c === '.') return;
      const filled = fill >= 1 || (fill > 0 && x < 5);
      const col = !filled ? (c === 'H' ? 0x6a5a66 : 0x4a3e48) : c === 'H' ? CP.heartHi : CP.heart;
      g.box(x, 7 - i, 0, x + 1, 8 - i, 3, col);
    })
  );
  return g;
}

export function vialIcon(fill = 1) {
  const g = new DenseGrid(7, 10, 5);
  g.box(2, 8, 1, 5, 10, 4, 0x9a6a3a); // cork
  g.box(2, 7, 1, 5, 8, 4, 0xcfe6f2); // neck
  g.box(1, 0, 0, 6, 7, 5, (x, y) => (y < Math.round(7 * fill) ? (y > 4 ? 0x7ad8ff : 0x2f9ae6) : 0xcfe6f2));
  g.box(1, 5, 4, 2, 6, 5, 0xffffff);
  return g;
}

export function coinIcon() {
  const g = new DenseGrid(8, 8, 2);
  g.box(2, 0, 0, 6, 8, 2, CP.coin);
  g.box(1, 1, 0, 7, 7, 2, CP.coin);
  g.box(0, 2, 0, 8, 6, 2, CP.coin);
  g.box(3, 2, 1, 5, 6, 2, CP.coinLo);
  g.box(2, 3, 1, 6, 5, 2, CP.coinLo);
  g.box(3, 3, 1, 5, 5, 2, CP.coinHi);
  return g;
}

export function keyIcon() {
  const g = new DenseGrid(10, 5, 2);
  g.box(0, 0, 0, 4, 5, 2, CP.keyGold);
  g.box(1, 1, 0, 3, 4, 2, null);
  g.box(4, 2, 0, 10, 3, 2, CP.keyGold);
  g.box(7, 0, 0, 8, 2, 2, CP.keyGold);
  g.box(9, 0, 0, 10, 2, 2, CP.keyGold);
  return g;
}

export const ICONS = {
  heart: (fill = 1) => model(`icon:heart:${fill}`, () => heartIcon(fill)),
  vial: (fill = 1) => model(`icon:vial:${fill}`, () => vialIcon(fill)),
  coin: () => model('icon:coin', coinIcon),
  key: () => model('icon:key', keyIcon),
};
