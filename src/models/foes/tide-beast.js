import { DenseGrid } from '../../core/vox.js';
import { model } from '../kit.js';

export function tideBeastModel() {
  return model('tide-beast', () => {
    const g=new DenseGrid(44,36,44);
    g.ellipsoid(22,15,22,15,12,14,0x397d88);
    g.ellipsoid(22,24,21,11,9,10,0x6da7a4);
    g.ellipsoid(22,27,20,8,5,7,0xa6cec3);
    for(const x of [9,17,25,33]) {
      g.box(x-3,2,18,x+3,9,39,0x315864);
      g.box(x-2,2,34,x+2,5,42,0xd2b6a0);
      for(const z of [24,31,37])g.box(x-1,7,z,x+1,10,z+2,0xd2b6a0);
    }
    for(const x of [14,27]) {
      g.box(x,18,33,x+4,23,35,0xf0e7bd);
      g.box(x+1,19,35,x+3,22,36,0x242e4e);
      g.box(x+1,22,34,x+3,23,36,0xffffff);
    }
    g.box(19,13,35,25,17,37,0x293a4d);
    for(const x of [16,21,26])g.box(x,32,17,x+2,35,23,0xf0d7a8);
    return g;
  });
}

export function tideTentacleModel() {
  return model('tide-tentacle',()=>{
    const g=new DenseGrid(16,32,24);
    g.ellipsoid(8,4,11,7,4,8,0x315864);
    g.box(4,3,8,12,21,16,0x397d88);
    g.box(5,19,12,11,29,21,0x6da7a4);
    g.box(5,25,17,11,29,24,0xa6cec3);
    for(const y of [7,13,19])g.box(6,y,16,10,y+3,18,0xf0d7a8);
    return g;
  });
}

export function tideInkModel() {
  return model('tide-ink',()=>{
    const g=new DenseGrid(10,10,10);
    g.ellipsoid(5,5,5,5,5,5,0x3f3569);
    g.ellipsoid(5,6,7,3,3,3,0x8470a5);
    g.box(4,7,8,6,9,10,0xc7b9d8);
    return g;
  });
}
