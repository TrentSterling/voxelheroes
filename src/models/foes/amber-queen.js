import { DenseGrid } from '../../core/vox.js';
import { model } from '../kit.js';

export function amberQueenModel(open = false) {
  return model(`amber-queen:${open}`, () => {
    const g = new DenseGrid(48, 32, 32);
    g.ellipsoid(24, 10, 14, 9, 7, 11, 0x754827);
    for (let z = 7; z < 24; z += 5) g.box(16, 8, z, 32, 15, z+2, 0xdba644);
    g.ellipsoid(24, 17, 22, 8, 6, 6, open ? 0xf3cf66 : 0xb48038);
    g.box(19, 19, 27, 22, 22, 29, open ? 0x98f2cf : 0x33273a);
    g.box(26, 19, 27, 29, 22, 29, open ? 0x98f2cf : 0x33273a);
    for (const x of [18,23,28]) g.box(x, 24, 20, x+2, 29, 23, 0xffdc78);
    g.box(17, 23, 19, 31, 25, 24, 0xdd9c37);
    for (const side of [-1,1]) {
      const cx = 24 + side * (open ? 15 : 9);
      g.ellipsoid(cx, open ? 16 : 22, 12, open ? 9 : 5, 2, 12, 0xb4ddd0);
      g.ellipsoid(cx, open ? 16 : 22, 12, open ? 7 : 3, 2.2, 8, 0x6ca795);
      g.box(side < 0 ? 10 : 31, 4, 10, side < 0 ? 17 : 38, 6, 12, 0x553f31);
      g.box(side < 0 ? 12 : 31, 4, 21, side < 0 ? 17 : 36, 6, 23, 0x553f31);
    }
    return g;
  }, { origin: [24,0,16] });
}

export function amberDroneModel() {
  return model('amber-drone', () => {
    const g = new DenseGrid(20,12,16);
    g.ellipsoid(10,5,8,4,4,6,0xdda74c);
    g.box(6,4,6,14,8,8,0x6f462b);
    g.box(2,8,3,8,9,12,0xb4ddd0); g.box(12,8,3,18,9,12,0xb4ddd0);
    g.box(7,6,13,9,8,15,0x342b38); g.box(11,6,13,13,8,15,0x342b38);
    return g;
  });
}

export function amberShotModel() {
  return model('amber-shot', () => {
    const g = new DenseGrid(8,8,8);
    g.ellipsoid(4,4,4,4,4,4,0xe9963d);
    g.ellipsoid(4,4,5,2,2,2,0xffef9b);
    return g;
  });
}
