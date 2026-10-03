import { DenseGrid } from '../core/vox.js';
import { model } from './kit.js';

// Original brass observatory machinery, built as quick voxel silhouettes.
export const watchSentinelModel = (open = false) => model(`watch-sentinel-${open ? 'open' : 'closed'}`, () => {
  const g = new DenseGrid(24, 30, 22), brass = 0xd4a65d, dark = 0x455367;
  for (const x of [3, 15]) { g.box(x, 0, 4, x + 6, 5, 18, dark); g.box(x + 1, 5, 7, x + 5, 10, 15, brass); }
  g.box(4, 10, 5, 20, 24, 17, dark);
  g.box(6, 24, 7, 18, 28, 15, brass); g.box(9, 28, 8, 15, 30, 14, 0xf1cf85);
  g.box(9, 14, 16, 15, 21, 19, 0x7edbd9);
  for (const x of open ? [0, 20] : [4, 13]) {
    g.box(x, 10, 18, x + (open ? 4 : 7), 25, 21, brass);
    g.box(x + 1, 12, 21, x + (open ? 3 : 6), 23, 22, 0x8b6445);
  }
  g.box(1, 15, 7, 5, 22, 15, brass); g.box(19, 15, 7, 23, 22, 15, brass);
  return g;
});
export const watchBoltModel = () => model('watch-bolt', () => {
  const g = new DenseGrid(6, 6, 12);
  g.box(1, 1, 1, 5, 5, 9, 0x75d6db); g.box(2, 2, 0, 4, 4, 12, 0xffe1a1);
  return g;
}, { origin: [3, 3, 6] });
export const sunDialModel = () => model('item-sun-dial', () => {
  const g = new DenseGrid(20, 22, 8);
  for (let x = 1; x < 19; x++) for (let y = 2; y < 20; y++) {
    const d = Math.hypot(x - 9.5, y - 10.5);
    if (d < 9) g.box(x, y, 2, x + 1, y + 1, 6, d > 6.5 ? 0xe2b565 : 0x425c75);
  }
  g.box(9, 5, 6, 11, 12, 8, 0x8ae6df); g.box(10, 10, 6, 16, 12, 8, 0x8ae6df);
  return g;
});
export const watchRestClockModel = () => model('watch-rest-clock', () => {
  const g=new DenseGrid(24,26,18),brass=0xd4a65d,teal=0x426b79;
  g.box(1,0,1,23,3,17,0x586473);
  for(const x of[3,18])g.box(x,3,4,x+3,8,15,brass);
  g.box(2,8,5,22,11,17,teal);g.box(3,11,4,21,17,7,teal);
  g.box(7,15,2,17,25,6,brass);g.box(8,16,6,16,24,7,0x345268);
  g.box(11,17,7,13,22,8,0x9ae8db);g.box(12,20,7,15,22,8,0x9ae8db);
  g.box(2,10,14,22,12,16,0x87bcb3);return g;
},{origin:[12,0,9]});
