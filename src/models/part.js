// Helpers shared by the character models.
import * as THREE from 'three';
import { VoxelGrid, buildGeometry, voxelMaterial, rng } from '../core/voxel.js';

// Character voxels are finer than terrain voxels: 14 per tile.
export const MV = 1 / 14;

// A part is meshed so its pivot (in voxel coords) sits at the mesh origin,
// letting us rotate limbs around shoulders and hips.
export function part(fill, pivot = [0, 0, 0], material = voxelMaterial, seed = 1) {
  const g = new VoxelGrid(rng(seed));
  fill(g);
  const geo = buildGeometry(g, MV, [-pivot[0], -pivot[1], -pivot[2]]);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set((pivot[0] - 0.5) * MV, pivot[1] * MV, (pivot[2] - 0.5) * MV);
  mesh.castShadow = true;
  return mesh;
}
