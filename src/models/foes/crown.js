import { DenseGrid } from '../../core/vox.js';
import { model } from '../kit.js';

export const falseLightModel=()=>model('false-light',()=>{
  const g=new DenseGrid(28,44,26);
  g.box(5,0,5,23,5,21,0x393549);
  for(let y=4;y<26;y++)g.box(6+Math.floor(y/9),y,6,22-Math.floor(y/9),y+1,21,0x785f92);
  g.box(9,24,8,19,35,18,0xd8ccbd);
  g.box(6,31,5,22,38,20,0x594868);
  g.box(10,33,20,12,35,22,0xffecc1);g.box(16,33,20,18,35,22,0xffecc1);
  g.box(12,35,5,16,44,9,0xe7ba66);
  g.box(2,21,8,7,27,15,0x9d82af);g.box(21,21,8,26,27,15,0x9d82af);
  g.box(24,2,14,26,36,16,0xc8a567);g.box(22,34,12,28,40,18,0x89d8cf);
  g.box(12,5,21,16,25,22,0xc8a567);return g;
});
export const hollowCrownModel=()=>model('hollow-crown',()=>{
  const g=new DenseGrid(64,58,50);
  g.ellipsoid(32,22,24,21,19,16,0x594566);
  g.box(15,2,20,25,13,39,0x382e45);g.box(39,2,20,49,13,39,0x382e45);
  g.box(17,3,34,25,7,43,0xe1cdb2);g.box(39,3,34,47,7,43,0xe1cdb2);
  g.ellipsoid(32,40,27,15,11,12,0x887393);
  g.box(20,33,35,44,39,46,0x4c3a59);
  for(const x of[22,28,34,40])g.box(x,34,45,x+2,37,49,0xe8dfc5);
  for(const x of[22,38]){g.box(x,42,37,x+5,46,39,0xf7cb7a);g.box(x+2,43,39,x+4,45,40,0x261e35);}
  g.box(21,49,20,43,53,33,0xc99b47);
  for(const x of[21,30,40])g.box(x,52,22,x+3,58,28,0xf6d387);
  g.box(5,19,20,14,33,31,0x705479);g.box(50,19,20,59,33,31,0x705479);
  for(const x of[5,8,11,50,53,56])g.box(x,16,30,x+2,23,39,0xe1cdb2);
  g.box(23,17,39,41,29,41,0xc4a88c);return g;
});
export const crownTailModel=()=>model('crown-tail',()=>{
  const g=new DenseGrid(18,15,52);
  for(let z=0;z<52;z++){const r=Math.max(2,Math.floor((52-z)/9));g.box(9-r,3,z,9+r,3+r*2,z+1,z%10<2?0xb494b2:0x594566);}
  return g;
},{origin:[9,0,0]});
export const crownShotModel=(large=false)=>model('crown-shot-'+large,()=>{
  const d=large?18:10,g=new DenseGrid(d,d,d),r=d/2;
  g.ellipsoid(r,r,r,r,r,r,0x9e73b8);g.ellipsoid(r,r,r+1,r*.65,r*.65,r*.65,0xf2dca8);return g;
});
export const crownWispModel=()=>model('crown-wisp',()=>{
  const g=new DenseGrid(12,18,12);g.ellipsoid(6,10,6,5,7,5,0x85bdb9);
  g.box(3,11,10,5,13,12,0xffeed6);g.box(7,11,10,9,13,12,0xffeed6);return g;
});
export const fourLightGateModel=()=>model('four-light-gate',()=>{
  const g=new DenseGrid(64,76,36);
  g.box(0,0,2,22,64,34,0x5d6176);g.box(42,0,2,64,64,34,0x5d6176);
  g.box(16,44,2,48,64,34,0x758097);g.box(4,64,5,60,69,30,0xc5bc9c);
  for(const x of[4,18,32,46]){g.box(x,69,7,x+10,76,29,0x758097);g.box(x+3,51,35,x+7,56,36,[0xe8bd6b,0xafca79,0x88c0cf,0xceb0d8][Math.floor(x/14)]);}
  return g;
});
