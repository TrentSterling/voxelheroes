import { DenseGrid } from '../core/vox.js';
import { model } from './kit.js';

export const echoBellModel = () => model('barrow-echo-bell', () => {
  const g = new DenseGrid(24,34,18);
  g.box(1,0,1,23,4,17,0x414e64);
  for(const x of [3,17]) { g.box(x,4,4,x+4,29,14,0x865743);g.box(x-1,24,3,x+5,28,15,0xdcb573); }
  g.box(3,28,4,21,32,14,0xdcb573);
  for(let y=11;y<24;y++) { const r=y<15?7:5;g.box(12-r,y,9-r,12+r,y+1,9+r,y<14?0xe8c885:0xb77c50); }
  g.box(10,8,7,14,17,11,0x4c4658);
  g.box(9,30,6,15,34,12,0x89dcd3);
  return g;
});
export const echoMemoryModel = () => model('barrow-echo-memory', () => {
  const g = new DenseGrid(16,22,12);
  g.box(2,0,2,14,4,10,0x866043);
  g.ellipsoid(8,11,6,5,8,4,0x80d8d2);
  g.box(1,7,4,15,10,8,0xe9c982);g.box(5,15,3,11,18,9,0xe9c982);
  return g;
});
