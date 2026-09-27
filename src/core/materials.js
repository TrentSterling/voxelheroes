// Shared materials, asked for by kind so the look pass can replace every implementation in one
// place (art bible section 6). Callers never build their own voxel materials.
//
//   getMaterial('terrain')    shared material for terrain blocks (1/8 tile): faint seams
//   getMaterial('character')  shared material for characters, props and pickups (1/16 tile): clear seams
//   getMaterial('fine')       shared material for fine floors built at character resolution (dungeon floors)
//   makeCharacterMaterial()   a new unshared character material, for per-entity effects such as a hit flash
//   makeGlowMaterial(color, intensity)  emissive-only material for flames, magic, lamp strips, sword beams
//   makeWaterMaterial()       water surface material (glints come from the look pass)
//
// Geometry from src/core/vox.js (meshVoxels) carries a 'faceUv' attribute for the bevel and seam
// shader. This file is the placeholder the look pass replaces; the kinds and function names are the
// contract.
import * as THREE from 'three';
import { voxelMaterial as legacy } from './voxel.js';

export const MATERIAL_KINDS = ['terrain', 'character', 'fine'];

export function getMaterial(kind = 'terrain') {
  if (!MATERIAL_KINDS.includes(kind)) throw new Error(`Unknown material kind "${kind}"`);
  return legacy;
}

export function makeCharacterMaterial() {
  return legacy.clone();
}

export function makeGlowMaterial(color = 0xffffff, intensity = 3) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: true });
}

export function makeWaterMaterial() {
  return new THREE.MeshLambertMaterial({ color: 0x1f4fb0, transparent: true, opacity: 0.95 });
}
