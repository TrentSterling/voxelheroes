import { DenseGrid } from '../../core/vox.js';
import { model } from '../kit.js';
const stone=0xab8a62, dark=0x66523e, trim=0x3f7786, glow=0x8fe8e0;
export const colossusModel=(core=false)=>model(`colossus:${core}`,()=>{
  const g=new DenseGrid(40,40,26);
  if(!core){
    g.box(4,2,3,36,24,23,stone);g.box(2,18,2,38,25,24,dark);
    g.box(8,25,5,32,29,22,trim);g.box(11,29,7,29,38,23,stone);
    g.box(13,32,22,18,35,25,glow);g.box(22,32,22,27,35,25,glow);
    for(const x of [8,29])g.box(x,2,3,x+3,18,24,trim);
  }else{
    g.ellipsoid(20,12,13,10,11,10,stone);
    g.box(12,8,21,28,16,24,trim);g.box(16,10,23,24,14,26,glow);
    g.box(15,22,9,25,25,17,0xdcc17b);
  }
  return g;
},{origin:[20,0,13]});
export const colossusPartModel=(arm=false)=>model(`colossus-part:${arm}`,()=>{
  const g=new DenseGrid(20,24,24);
  g.box(3,0,3,17,arm?20:13,21,stone);
  g.box(1,0,5,19,5,24,dark);
  g.box(2,arm?13:7,3,18,arm?17:10,22,trim);
  g.box(7,arm?17:10,21,13,arm?21:14,24,glow);
  return g;
});
export const colossusShotModel=(wave=false)=>model(`colossus-shot:${wave}`,()=>{
  const g=new DenseGrid(wave?16:4,6,wave?6:24);
  g.box(0,1,0,g.sx,4,g.sz,wave?0xdcc18e:0xa5e9ef);
  g.box(wave?3:1,2,1,wave?13:3,5,g.sz-1,wave?0x9c7853:0xf4fbef);
  return g;
},{origin:[wave?8:2,3,wave?3:12]});
