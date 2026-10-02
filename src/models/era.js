import { DenseGrid } from '../core/vox.js';
import { model } from './kit.js';

// Copper instruments, sea-glass lenses and long festival pennants give this
// story its own silhouette in the existing voxel world.
export const hourgateModel = () => model('hourgate', () => {
  const g=new DenseGrid(24,38,12);
  g.box(0,0,1,24,3,11,0x41455e);
  for(const x of [2,18]) {
    g.box(x,3,3,x+4,30,9,0xb87a48);
    g.box(x-1,8,2,x+5,11,10,0xe8bd70);
    g.box(x-1,24,2,x+5,27,10,0xe8bd70);
  }
  g.box(4,29,3,20,33,9,0xb87a48);
  g.box(8,32,3,16,37,9,0xf0cd84);
  g.box(10,33,2,14,36,10,0x80efdf);
  for(let y=5;y<29;y++)for(let x=7;x<17;x++) {
    if(x===7||x===16||(x+y)%7===0)g.set(x,y,6,0x6ce1df);
  }
  return g;
});
export const festivalPennantModel=()=>model('festival-pennant',()=>{
  const g=new DenseGrid(18,37,8);
  g.box(1,0,2,5,36,6,0xc89959);g.box(2,32,2,18,35,5,0xe8c87e);
  for(let y=12;y<32;y++)g.box(6,y,3,17-(y<16?16-y:0),y+1,5,y===19||y===28?0xf2ce82:0x923f70);
  g.box(10,21,2,13,26,6,0x77d8cc);return g;
});
export const waterEngineModel=()=>model('water-engine',()=>{
  const g=new DenseGrid(24,30,20);
  g.box(1,0,1,23,5,19,0x414e64);g.box(4,5,4,20,23,16,0x638589);
  for(let y=8;y<27;y++)for(let x=2;x<22;x++){
    const r=Math.hypot(x-11.5,y-17);
    if(r>6&&r<9)g.box(x,y,16,x+1,y+1,19,0xd7a359);
  }
  g.box(10,8,16,14,26,19,0xe7c584);g.box(3,15,16,21,19,19,0xe7c584);
  g.box(9,14,15,15,20,20,0x80efdf);
  g.box(1,24,8,23,28,14,0x414e64);return g;
});
export const dawnSeedModel=()=>model('dawn-seed',()=>{
  const g=new DenseGrid(14,19,10);
  g.ellipsoid(7,6,5,5,5,4,0xd5a255);
  g.box(6,8,4,8,18,6,0x67b694);
  g.box(2,12,4,7,15,6,0xa9e3b0);g.box(7,15,4,12,18,6,0x87d8c0);
  return g;
});
export const futureSpireModel=()=>model('future-spire',()=>{
  const g=new DenseGrid(16,34,16);
  g.box(1,0,1,15,5,15,0x30384f);g.box(4,5,4,12,28,12,0x556078);
  g.box(6,8,3,10,24,13,0x758caa);g.box(5,28,5,11,33,11,0x9cd6da);return g;
});
