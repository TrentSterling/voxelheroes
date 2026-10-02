// The raised shield of the guard pose (CONTRACTS 8.1: the hero adds the
// guard model to his rig). Character voxels (1/16 tile), the rig's shield
// colours: a 10 x 11 board held square in front of the chest, facing +z.
import { modelMesh } from '../kit.js';
import { shieldModel } from '../items/rewards.js';

export function makeGuardShield() {
  const mesh = modelMesh(shieldModel());
  mesh.name = 'guard-shield';
  return mesh;
}

// One off-hand mesh serves both carry and guard. Reward/carry poses put it
// away; a hero without the gear never draws an ornamental shield.
export function poseShield(mesh, body, tier, { guarding=false, hidden=false }={}) {
  if (!tier || hidden) { mesh.removeFromParent(); return; }
  if (mesh.userData.tier !== tier) {
    mesh.geometry = shieldModel(tier).geometry;
    mesh.userData.tier = tier;
  }
  if (mesh.parent !== body) body.add(mesh);
  mesh.position.set(guarding ? -.08 : .36, guarding ? .18 : .1, guarding ? .4 : .2);
  mesh.rotation.y = guarding ? 0 : -.2;
  mesh.scale.setScalar(guarding ? 1 : .75);
}
