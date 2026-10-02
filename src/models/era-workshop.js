import { DenseGrid } from '../core/vox.js';
import { model } from './kit.js';

// Small original boxel props. Color and silhouette carry the era before polish.
export const workshopProp=kind=>model(`era-workshop-${kind}`,()=>{
  const g=new DenseGrid(16,24,16),brass=0xd3a05e,teal=0x72cfc0,dark=0x344760,wood=0x906d74;
  if(kind==='bench'){
    g.box(1,6,3,15,9,13,wood);g.box(2,0,4,4,6,12,dark);g.box(12,0,4,14,6,12,dark);g.box(1,9,11,15,16,13,brass);
  }else if(kind==='crate'){
    g.box(2,0,2,14,12,14,wood);for(const x of[2,7,12])g.box(x,0,1,x+2,12,15,brass);g.box(1,3,1,15,5,15,dark);
  }else if(kind==='pipe'){
    g.box(5,0,0,11,6,16,brass);g.box(3,0,3,13,8,5,dark);g.box(3,0,11,13,8,13,dark);
  }else if(kind==='reeds'){
    for(const [x,z,y] of[[3,5,16],[8,9,22],[12,4,18]]){g.box(x,0,z,x+1,y,z+1,0x528f88);g.box(x-1,y-5,z-1,x+2,y,z+2,brass);}
  }else if(kind==='lamp'){
    g.box(4,0,4,12,3,12,dark);g.box(7,3,7,9,19,9,brass);g.box(4,17,4,12,23,12,teal);g.box(3,23,3,13,24,13,dark);
  }else if(kind==='console'){
    g.box(2,0,3,14,6,13,dark);g.box(3,6,5,13,16,12,brass);g.box(5,10,12,11,15,14,teal);g.box(4,6,1,12,8,5,wood);
  }else if(kind==='gear'){
    g.box(1,0,1,15,4,15,dark);
    for(let x=2;x<14;x++)for(let y=4;y<19;y++)if(Math.hypot(x-8,y-11)>3&&Math.hypot(x-8,y-11)<7)g.box(x,y,7,x+1,y+1,10,brass);
    g.box(7,8,5,10,14,12,teal);
  }else if(kind==='flowers'){
    for(const [x,z,c] of[[3,4,0xeaa6b9],[10,9,0xf0d689],[12,3,0xa9d9e0]]){g.box(x,0,z,x+1,7,z+1,0x629782);g.box(x-2,6,z-1,x+3,8,z+2,c);}
  }else if(kind==='salvage'){
    g.box(1,0,2,10,4,9,dark);g.box(4,4,4,14,7,11,wood);g.box(10,0,7,13,10,10,brass);g.box(3,7,6,8,10,8,teal);
  }else if(kind==='capacitor'){
    g.box(4,0,4,12,3,12,dark);g.box(5,3,5,11,15,11,teal);g.box(3,6,3,13,8,13,brass);g.box(3,12,3,13,14,13,brass);
  }
  return g;
});
