import { DenseGrid } from '../../core/vox.js';
import { model } from '../kit.js';
export const fireWandModel=()=>model('fire-wand',()=>{
  const g=new DenseGrid(12,26,10);g.box(5,0,4,8,20,7,0x885a42);g.box(4,5,3,9,8,8,0xd7b45c);
  g.box(2,17,3,11,21,8,0xb0844a);g.box(4,19,2,9,24,9,0xef6c36);g.box(5,21,3,8,26,8,0xffd869);return g;
});
export const fireBoltModel=()=>model('fire-bolt',()=>{
  const g=new DenseGrid(8,10,14);g.ellipsoid(4,5,7,4,5,7,0xe85d35);g.ellipsoid(4,5,9,2,3,5,0xffe39a);return g;
},{origin:[4,5,7]});
export const iceGateModel=()=>model('tideglass-ice',()=>{
  const g=new DenseGrid(16,20,16);g.box(0,0,0,16,18,16,0x6ba7bc);g.box(2,18,2,14,20,14,0xc3eff1);
  for(let i=2;i<14;i++)g.box(i,Math.min(17,i+2),15,i+2,Math.min(19,i+4),16,0xe9fbf2);return g;
});
export const dryTreeModel=()=>model('dry-tree',()=>{
  const g=new DenseGrid(28,36,22);g.box(11,0,8,17,29,14,0x756255);g.box(2,18,8,14,23,14,0x756255);
  g.box(2,22,8,6,32,12,0x756255);g.box(17,13,9,26,18,14,0x756255);g.box(22,17,9,26,28,13,0x756255);return g;
});
