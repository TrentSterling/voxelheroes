import { DenseGrid } from '../../core/vox.js';
import { model } from '../kit.js';

export const barrowHourstoneModel = () => model('barrow-hourstone', () => {
  const g=new DenseGrid(22,28,22);
  g.box(2,0,2,20,3,20,0x596c78);
  g.box(4,3,4,18,5,18,0xc49b63);
  g.box(6,5,6,16,7,16,0x42566a);
  for (let y=7; y<25; y++) {
    const r=2+Math.floor(Math.abs(y-15)/3);
    g.box(11-r,y,11-r,11+r,y+1,11+r,y<15?0x79c7c5:0xb3e9d3);
    for (const [x,z] of [[5,5],[16,5],[5,16],[16,16]]) g.set(x,y,z,0xb68a59);
  }
  g.box(4,25,4,18,27,18,0xd6b67b);
  return g;
}, {origin:[11,0,11]});
