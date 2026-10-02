// A small brass garden machine. Native voxel poses are quick placeholders for
// the later Boxel pass, with a square face, cyan lens and seed drawer.
import * as THREE from 'three';
import { DenseGrid } from '../core/vox.js';
import { getMaterial } from '../core/materials.js';
import { model, PoseMesh, contactShadow } from './kit.js';

function ternPose(pose) {
  return model(`tern:${pose}`, () => {
    const g = new DenseGrid(20, 20, 16), brass = 0xb98a4f, light = 0xe5be75, teal = 0x4c8588, dark = 0x263c4e;
    const step = pose === 'walk1' ? 1 : pose === 'walk2' ? -1 : 0;
    g.box(5, 0, 5 + step, 9, 3, 11 + step, dark);
    g.box(11, 0, 5 - step, 15, 3, 11 - step, dark);
    g.box(5, 3, 4, 15, 10, 12, teal);
    g.box(6, 4, 11, 14, 7, 13, brass);
    g.box(8, 5, 12, 12, 6, 14, light); // drawer pull
    g.box(4, 10, 3, 16, 17, 12, brass);
    g.box(5, 11, 11, 15, 16, 13, dark);
    g.box(8, 12, 12, 12, 15, 14, 0x97f1dd); // one broad lens
    g.box(4, 16, 3, 16, 18, 12, light);
    g.box(13, 18, 5, 14, 20, 6, teal);
    const raised = ['cheer', 'item', 'swordOut'].includes(pose);
    for (const x of [2, 15]) {
      g.box(x, raised ? 9 : 5, raised ? 10 : 6, x + 3, raised ? 13 : 9, raised ? 14 : 10, brass);
      g.box(x, raised ? 12 : 4, raised ? 12 : 8, x + 3, raised ? 14 : 6, raised ? 15 : 11, light);
    }
    return g;
  });
}

export function makeTern(material = getMaterial('character')) {
  const root = new THREE.Group(), sway = new THREE.Group(), body = new THREE.Group();
  root.name = 'tern'; root.add(sway); sway.add(body);
  const poses = Object.fromEntries(['stand', 'walk1', 'walk2', 'cheer', 'item', 'swordOut'].map(p => [p, ternPose(p)]));
  const figure = new PoseMesh(poses, material, 'stand'), swordPivot = new THREE.Group();
  body.add(figure, swordPivot); root.add(contactShadow(.4));
  return { root, sway, body, figure, swordPivot, setPose: p => figure.setPose(p), pose: () => figure.pose,
    setSword: () => {}, armR: new THREE.Object3D(), armL: new THREE.Object3D() };
}
