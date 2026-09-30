import { DenseGrid } from '../../core/vox.js';
import { skeleton } from '../characters.js';
import { model } from '../kit.js';

// The same bones carry a readable weapon silhouette; the warden wears red steel.
export function barrowGuardModel(pose = 'idle', armored = false) {
  return model(`barrow-guard:${pose}:${armored}`, () => {
    const base = skeleton(), grid = new DenseGrid(20, 23, 24);
    for (let z = 0; z < base.sz; z++) for (let y = 0; y < base.sy; y++) for (let x = 0; x < base.sx; x++) {
      if (base.has(x, y, z)) grid.set(x + 2, y, z + 4, base.color(x, y, z));
    }
    if (armored) {
      grid.box(5, 14, 6, 15, 18, 13, 0x783c34);
      grid.box(7, 18, 8, 13, 20, 11, 0xbf9457);
      grid.box(6, 6, 7, 14, 9, 9, 0x8a4b42);
      grid.box(13, 3, 13, 19, 11, 15, 0x783c34);
      grid.box(15, 5, 14, 17, 10, 16, 0xd3a35b);
    }
    const steel = 0xc9d4d5, edge = 0xf3ecd2, grip = 0x614735;
    if (pose === 'aim') {
      grid.box(3, 8, 10, 5, 11, 12, grip);
      grid.box(1, 11, 10, 7, 12, 12, edge);
      grid.box(3, 12, 10, 5, 22, 12, steel);
    } else if (pose === 'rush') {
      grid.box(3, 6, 11, 5, 8, 14, grip);
      grid.box(1, 6, 14, 7, 8, 15, edge);
      grid.box(3, 6, 15, 5, 8, 23, steel);
    } else {
      grid.box(3, 3, 10, 5, 6, 12, grip);
      grid.box(1, 3, 10, 7, 4, 12, edge);
      grid.box(3, 0, 10, 5, 3, 12, steel);
    }
    return grid;
  }, { origin: [10, 0, 10] });
}
