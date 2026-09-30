import { DenseGrid } from '../../core/vox.js';
import { model } from '../kit.js';

export const hunterBowModel = () => model('hunter-bow', () => {
  const g = new DenseGrid(12,24,4);
  for(let y=1;y<23;y++){
    const x=3+Math.round(Math.sin((y-1)/21*Math.PI)*6);
    g.box(x,y,1,x+2,y+1,3,0x9e713f);
    g.set(3,y,2,0xe2d4af);
  }
  g.box(8,9,1,11,15,3,0x493329);
  return g;
});

export const hunterArrowModel = () => model('hunter-arrow', () => {
  const g=new DenseGrid(5,4,20);
  g.box(2,1,3,3,3,17,0xb59256);
  g.box(1,1,16,4,3,19,0xc5d0cc);
  g.box(2,1,18,3,3,20,0xc5d0cc);
  g.box(0,1,1,5,2,5,0xb0483c);
  g.box(2,0,1,3,4,5,0xe8d8b4);
  return g;
});

export const arrowRackModel = () => model('hunter-arrow-rack', () => {
  const g=new DenseGrid(16,20,16);
  g.box(2,0,2,14,11,14,0x755331);
  g.box(3,8,3,13,11,13,0x392b21);
  for(const x of[4,8,12])for(const z of[4,9]){
    g.box(x,9,z,x+1,18,z+1,0xb59256);
    g.box(x-1,16,z,x+2,19,z+1,0xe8d8b4);
  }
  return g;
});

export const arrowTargetModel = lit => model('hunter-target-'+!!lit, () => {
  const g=new DenseGrid(16,24,6);
  g.box(6,0,2,10,9,5,0x755331);
  for(let y=6;y<24;y++)for(let x=0;x<16;x++){
    const r=Math.hypot(x-7.5,y-14.5);
    if(r>7.5)continue;
    g.box(x,y,1,x+1,y+1,5,r<2.5?(lit?0x80bf65:0xc54b35):r<5?0xe4d2a0:0x755331);
  }
  return g;
});

export const briarGateModel = () => model('briar-gate', () => {
  const g=new DenseGrid(16,24,8);
  for(const x of[1,5,10,14])g.box(x,0,3,x+1,24,5,0x755331);
  g.box(0,5,2,16,7,6,0x9e713f);
  g.box(0,18,2,16,20,6,0x9e713f);
  return g;
});

export const briarBridgeModel = () => model('briar-bridge', () => {
  const g=new DenseGrid(16,3,16);
  for(let z=0;z<16;z+=3)g.box(0,0,z,16,2,z+2,0x9e713f);
  g.box(1,1,0,3,3,16,0xd2bd88);g.box(13,1,0,15,3,16,0xd2bd88);
  return g;
});

export const luckyDiceModel = () => model('rook-lucky-dice', () => {
  const g=new DenseGrid(16,10,8);
  for(const x of[0,9]){
    g.box(x,0,0,x+7,7,7,0xe2d4af);
    g.box(x+2,2,0,x+4,4,1,0x4f382b);
    g.box(x+1,6,2,x+3,7,4,0x4f382b);
    g.box(x+4,6,4,x+6,7,6,0x4f382b);
  }
  return g;
});

export const trailQuiverModel = () => model('trail-quiver', () => {
  const g=new DenseGrid(10,24,10);
  g.box(1,0,1,9,16,9,0x805330);
  g.box(2,14,2,8,17,8,0x392b21);
  for(const x of[3,6])for(const z of[3,6]){g.box(x,12,z,x+1,22,z+1,0xb59256);g.box(x-1,20,z,x+2,24,z+1,0xe8d8b4);}
  g.box(1,4,0,9,6,1,0xd2bd88);
  return g;
});
