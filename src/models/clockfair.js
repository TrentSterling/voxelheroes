import { DenseGrid } from '../core/vox.js';
import { model } from './kit.js';
export const fairModel=(kind,lit=false)=>model(`fair-${kind}-${lit}`,()=>{
  const g=new DenseGrid(24,28,16),wood=0x796479,gold=0xd8b779,green=lit?0xe5f7b4:0x88b6a7;
  if(kind==='arch'){
    g.box(1,0,3,5,24,12,wood);g.box(19,0,3,23,24,12,wood);g.box(1,23,3,23,27,12,gold);
    g.box(5,20,4,11,24,8,0xb589a6);g.box(13,20,4,19,24,8,0x78b5b0);
    if(lit)for(let x=4;x<22;x+=3)g.box(x,24,12,x+2,26,14,0xe5f7b4);
  }else if(kind==='board'){
    g.box(9,0,6,15,9,11,wood);g.box(1,8,3,23,24,12,gold);g.box(3,10,11,21,22,13,0x47405c);
    for(let y=13;y<21;y+=3)g.box(5,y,13,19,y+1,14,0xe5d4b1);
  }else if(kind==='clock'){
    g.box(3,0,2,21,4,14,wood);g.box(5,4,4,19,17,12,0x465872);g.box(4,16,3,20,19,13,gold);
    g.box(9,18,6,15,25,10,green);g.box(6,24,5,18,27,11,gold);
  }else{
    g.box(2,0,3,22,3,13,wood);g.box(3,3,5,6,24,11,gold);g.box(18,3,5,21,24,11,gold);g.box(3,23,5,21,26,11,wood);
    for(let y=7;y<21;y++){const half=y<10?8:y<17?6:4;g.box(12-half,y,5,12+half,y+1,12,green);}
    g.box(10,4,7,14,8,10,gold);
  }
  return g;
});
