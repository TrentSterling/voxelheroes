// Item and prize models for the items stream (art bible section 10): 16
// voxels per tile. Every design here is our own.
//
//   boomerangModel()        a bent throwing stick: pale wood with red tips
//   bombModel(lit)          a round iron-and-clay bomb with a brass cap and fuse
//   heartContainerModel()   a large heart in a gold frame
//   tokenModel()            a silver medal with a star
import * as THREE from 'three';
import { DenseGrid } from '../../core/vox.js';
import { getMaterial } from '../../core/materials.js';
import { CP } from '../palette.js';
import { model, modelMesh, jitter } from '../kit.js';

const C = {
  wood: 0xe0b476, woodLo: 0xb07e44, tip: 0xd83a3a,
  iron: 0x2c3a58, ironLo: 0x1c2640, ironHi: 0x5a70a0, brass: 0xe8b830, fuse: 0x8a6a40, spark: 0xffe070,
  frame: 0xe9b832, frameLo: 0xb8891c,
  silver: 0xd8dee8, silverLo: 0x9aa4b4, star: 0x5ab8ff,
};

// Flat in the xz plane (it spins about y as it flies), 12 x 2 x 12.
export function boomerang() {
  const g = new DenseGrid(12, 2, 12);
  g.box(0, 0, 0, 12, 2, 3, (x) => (x > 9 ? C.tip : jitter(C.wood, x, 0, 0, 0.05, 3)));
  g.box(0, 0, 0, 3, 2, 12, (x, y, z) => (z > 9 ? C.tip : jitter(C.wood, 0, 0, z, 0.05, 5)));
  g.box(0, 1, 0, 3, 2, 3, C.woodLo);
  return g;
}
export const boomerangModel = () => model('item-boomerang', boomerang, { origin: [4, 1, 4] });

export function bomb(lit = 0) {
  const g = new DenseGrid(12, 14, 12);
  g.ellipsoid(6, 5, 6, 5.5, 5, 5.5, (x, y, z) => (y > 7 && x < 6 ? C.ironHi : y < 2 ? C.ironLo : jitter(C.iron, x, y, z, 0.05, 7)));
  g.box(4, 9, 4, 8, 11, 8, C.brass);
  g.box(5, 11, 5, 7, 13, 7, C.fuse);
  if (lit) g.box(5, 13, 5, 7, 14, 7, C.spark);
  return g;
}
export const bombModel = (lit = 0) => model(`item-bomb:${lit ? 1 : 0}`, () => bomb(lit ? 1 : 0));

export function heartContainer() {
  const g = new DenseGrid(16, 15, 6);
  const rows = [
    '..FFFF....FFFF..',
    '.FHHHHF..FHHHHF.',
    'FHHWHHHFFHHHHHHF',
    'FHWHHHHHHHHHHHHF',
    'FHHHHHHHHHHHHHHF',
    'FHHHHHHHHHHHHHHF',
    '.FHHHHHHHHHHHHF.',
    '..FHHHHHHHHHHF..',
    '...FHHHHHHHHF...',
    '....FHHHHHHF....',
    '.....FHHHHF.....',
    '......FHHF......',
    '.......FF.......',
  ];
  const col = { F: C.frame, H: CP.heart, W: CP.heartHi };
  rows.forEach((row, r) =>
    [...row].forEach((ch, x) => {
      if (col[ch]) g.box(x, 14 - r, ch === 'F' ? 0 : 1, x + 1, 15 - r, ch === 'F' ? 6 : 5, col[ch]);
    })
  );
  return g;
}
export const heartContainerModel = () => model('item-heart-container', heartContainer);

export function token() {
  const g = new DenseGrid(10, 10, 3);
  g.ellipsoid(5, 5, 1.5, 5, 5, 1.5, (x, y) => (x + y > 11 ? C.silverLo : C.silver));
  g.box(4, 2, 2, 6, 8, 3, C.star);
  g.box(2, 4, 2, 8, 6, 3, C.star);
  return g;
}
export const tokenModel = () => model('item-token', token);

// A THREE.Object3D for the item get (the prize over the hero's head).
export const prizeMesh = (m) => () => {
  const o = new THREE.Group();
  o.add(modelMesh(m(), getMaterial('character')));
  return o;
};
