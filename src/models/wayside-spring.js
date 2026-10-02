import {DenseGrid} from '../core/vox.js';
import {model} from './kit.js';
export const waysideSpringModel = () => model('wayside-spring', () => {
  const g=new DenseGrid(22,14,22);
  for(let z=1;z<21;z++) for(let x=1;x<21;x++) {
    const d=Math.hypot(x-10.5,z-10.5);
    if(d<9) for(let y=0;y<3;y++) g.set(x,y,z,0x677c79);
    if(d<8.7&&d>6.1) for(let y=3;y<9;y++) g.set(x,y,z,y===8?0xcbd2b7:((x+z+y)%5?0x9aab98:0x819887));
    if(d<6.1) g.set(x,4,z,(x+z)%5?0x69bfc0:0xb4e3cf);
  }
  for(let y=5;y<13;y++) for(let x=10;x<12;x++) for(let z=10;z<12;z++) g.set(x,y,z,y>10?0xd8b46a:0x91c8b9);
  return g;
}, {origin:[11,0,11]});
