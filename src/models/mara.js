// Quick native keeper poses: a long plum coat, pale braid, tide lantern and paddle.
import * as THREE from 'three';
import { DenseGrid } from '../core/vox.js';
import { getMaterial } from '../core/materials.js';
import { model, PoseMesh, contactShadow } from './kit.js';

function maraPose(pose) {
  return model(`mara:${pose}`, () => {
    const g = new DenseGrid(20, 22, 20), coat = 0x85546d, trim = 0xdf9779, hair = 0xeee0b9, boot = 0x36394e;
    const step = pose === 'walk1' ? 1 : pose === 'walk2' ? -1 : 0;
    g.box(6, 0, 6 + step, 9, 3, 11 + step, boot); g.box(11, 0, 6 - step, 14, 3, 11 - step, boot);
    g.box(5, 3, 5, 15, 10, 12, coat); g.box(7, 3, 12, 13, 5, 13, trim);
    g.box(6, 9, 5, 14, 13, 12, coat); g.box(7, 11, 11, 13, 13, 13, trim);
    g.box(5, 13, 5, 15, 20, 13, hair); g.box(6, 13, 12, 14, 17, 14, 0xcda684);
    g.box(8, 15, 13, 9, 17, 14, boot); g.box(11, 15, 13, 12, 17, 14, boot);
    g.box(5, 18, 4, 15, 20, 13, 0x477f88); g.box(4, 18, 11, 16, 19, 15, 0x75b8ae);
    g.box(13, 8, 4, 15, 16, 6, hair); g.box(13, 8, 5, 15, 9, 7, trim);
    const raised = ['item', 'cheer', 'swordOut'].includes(pose), armY = raised ? 11 : 7, armZ = raised ? 12 : 7;
    g.box(3, armY, armZ, 6, armY + 3, armZ + 3, coat);
    g.box(3, armY - 1, armZ + 2, 6, armY + 1, armZ + 4, 0xcda684);
    g.box(14, 7, 6, 17, 11, 9, coat); g.box(15, 6, 8, 17, 8, 11, 0xcda684);
    g.box(16, 3, 10, 19, 7, 13, boot); g.box(17, 4, 12, 18, 6, 14, 0xffc675);
    g.box(3, 2, armZ + 3, 4, raised ? 22 : 16, armZ + 4, 0xd4a472);
    g.box(1, raised ? 17 : 12, armZ + 2, 6, raised ? 22 : 17, armZ + 4, 0x75b8ae);
    return g;
  });
}

export function makeMara(material = getMaterial('character')) {
  const root = new THREE.Group(), sway = new THREE.Group(), body = new THREE.Group(), swordPivot = new THREE.Group();
  root.name = 'mara'; root.add(sway); sway.add(body);
  const poses = Object.fromEntries(['stand', 'walk1', 'walk2', 'cheer', 'item', 'swordOut'].map(p => [p, maraPose(p)]));
  const figure = new PoseMesh(poses, material, 'stand'); body.add(figure, swordPivot); root.add(contactShadow(.35));
  return { root, sway, body, figure, swordPivot, setPose: p => figure.setPose(p), pose: () => figure.pose,
    setSword: () => {}, armR: new THREE.Object3D(), armL: new THREE.Object3D() };
}
