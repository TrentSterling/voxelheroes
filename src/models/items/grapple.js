import { DenseGrid } from '../../core/vox.js';
import { model } from '../kit.js';

export const grappleModel = () => model('item-grapple', () => {
  const g = new DenseGrid(12, 6, 16);
  g.box(5, 2, 2, 7, 4, 14, 0xa9becb);
  g.box(2, 1, 12, 10, 5, 15, 0xd7a954);
  g.box(1, 2, 7, 3, 4, 14, 0xdbe8ed);
  g.box(9, 2, 7, 11, 4, 14, 0xdbe8ed);
  g.box(3, 2, 1, 9, 4, 4, 0x586b7a);
  return g;
}, { origin: [6, 3, 8] });

export const grapplePostModel = () => model('grapple-post', () => {
  const g = new DenseGrid(12, 20, 12);
  g.box(1, 0, 1, 11, 3, 11, 0x786d61);
  g.box(3, 3, 3, 9, 17, 9, 0xb18354);
  g.box(2, 11, 2, 10, 14, 10, 0x3c7489);
  g.box(1, 17, 1, 11, 20, 11, 0xf0d283);
  g.box(4, 18, 4, 8, 20, 8, 0xdff1ed);
  return g;
});
