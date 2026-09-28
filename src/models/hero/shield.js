// The raised shield of the guard pose (CONTRACTS 8.1: the hero adds the
// guard model to his rig). Character voxels (1/16 tile), the rig's shield
// colours: a 10 x 11 board held square in front of the chest, facing +z.
import { DenseGrid } from '../../core/vox.js';
import { CP } from '../palette.js';
import { model, modelMesh } from '../kit.js';

function guardShieldGrid() {
  const g = new DenseGrid(10, 11, 2);
  g.box(0, 0, 0, 10, 11, 2, CP.shieldRim);
  g.box(1, 1, 1, 9, 10, 2, CP.shieldWood);
  g.box(4, 3, 1, 6, 8, 2, CP.shieldMark);
  g.box(3, 5, 1, 7, 6, 2, CP.shieldMark);
  return g;
}

export function makeGuardShield() {
  const mesh = modelMesh(model('hero:guard-shield', guardShieldGrid, { origin: [5, 0, 1] }));
  mesh.name = 'guard-shield';
  mesh.position.set(-0.08, 0.18, 0.4); // off hand, in front of the chest
  return mesh;
}
