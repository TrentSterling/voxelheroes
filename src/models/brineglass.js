import { DenseGrid } from '../core/vox.js';
import { model } from './kit.js';

export const tideSkaterModel = (pose = 'closed') => model(`tideglass-skater-${pose}`, () => {
  const g = new DenseGrid(24, 24, 26), glass = 0x91d5dc, blue = 0x497d9d, brass = 0xe0b876;
  for (const x of [3, 17]) { g.box(x, 0, 2, x + 4, 3, 25, blue); g.box(x + 1, 3, 7, x + 3, 7, 19, brass); }
  g.box(5, 7, 6, 19, 17, 20, 0x59506f); g.box(8, 17, 9, 16, 21, 18, brass);
  g.box(9, 11, 20, 15, 16, 24, pose === 'open' ? 0xffb46d : 0x76e7e1);
  if (pose === 'open') {
    for (const x of [1, 19]) g.box(x, 8, 5, x + 4, 20, 17, glass);
  } else {
    g.box(4, 8, 4, 20, 21, 8, glass); g.box(2, 8, 8, 6, 19, 21, blue); g.box(18, 8, 8, 22, 19, 21, blue);
    g.box(5, 17, 8, 19, 23, 21, glass); g.box(6, 8, 21, 18, 19, 25, glass);
    g.box(10, 12, 25, 14, 16, 26, pose === 'tell' ? 0xffcb75 : 0x4b648b);
  }
  return g;
});
export const emberLensModel = () => model('item-ember-lens', () => {
  const g = new DenseGrid(16, 24, 12);
  g.box(3, 0, 2, 13, 4, 10, 0x4c5877); g.box(6, 4, 4, 10, 8, 8, 0xe0b876);
  g.box(1, 8, 1, 15, 21, 11, 0xe0b876); g.box(3, 10, 0, 13, 19, 12, 0x78cbd8);
  g.box(6, 12, 0, 10, 17, 12, 0xffba6b); g.box(5, 21, 3, 11, 24, 9, 0x4c5877);
  return g;
});
export const shoreBeaconModel = (lit = false) => model(`shore-beacon-${lit}`, () => {
  const g = new DenseGrid(24, 44, 24), brass = 0xc99c68;
  g.box(1, 0, 1, 23, 4, 23, 0x6c8097); g.box(5, 4, 5, 19, 9, 19, brass);
  g.box(7, 9, 7, 17, 25, 17, 0x55778e); g.box(4, 25, 4, 20, 29, 20, brass);
  for (const x of [4, 18]) for (const z of [4, 18]) g.box(x, 29, z, x + 2, 39, z + 2, brass);
  g.box(7, 29, 7, 17, 39, 17, lit ? 0xffd38b : 0x517e91);
  g.box(2, 39, 2, 22, 41, 22, brass); g.box(7, 41, 7, 17, 44, 17, 0x6c8097);
  return g;
});
