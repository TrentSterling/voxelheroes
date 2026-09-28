// Model kit: building voxel models (art bible sections 2 and 10).
//
// A model is a DenseGrid (src/core/vox.js) at character resolution: 16 voxels per tile, so a
// 16 x 16 x 16 model fills one tile. Every model faces +z (south, toward the camera), x is east and
// y up. Geometry is built once per model and shared:
//
//   const m = model('pot', () => pot());          // { grid, geometry, colors }
//   const mesh = modelMesh(m);                     // Mesh with the shared character material
//   const mesh = modelMesh(m, makeCharacterMaterial()); // own material (per-entity hit flash)
//
// Poses and frames are whole models swapped like sprite cels (nothing bends):
//
//   const body = new PoseMesh({ stand: model(...), walk1: model(...) }, material);
//   body.setPose('walk1');
//
// modelGeometry(grid, opts) meshes without caching: origin (voxels, default the bottom centre),
// scale (default 1/16; terrain-resolution props such as bushes pass 1/8).
import * as THREE from 'three';
import { meshVoxels, gridColors, hash3, shadeHex, VOXEL } from '../core/vox.js';
import { getMaterial } from '../core/materials.js';
import { GROUND_Y } from '../core/constants.js';

// Brightness jitter for one voxel, reproducible (hash of its coordinates).
export const jitter = (base, x, y, z, amt = 0.06, seed = 1) => shadeHex(base, 1 + (hash3(x, y, z, seed) - 0.5) * 2 * amt);

export function modelGeometry(grid, { origin = [grid.sx / 2, 0, grid.sz / 2], scale = VOXEL } = {}) {
  return meshVoxels(grid, { origin, scale });
}

const models = new Map();

// A cached model: make() returns a DenseGrid. colors: the model's colours, most used first,
// repeated by weight, for bursting it into cubes of its own colours.
export function model(key, make, opts) {
  let m = models.get(key);
  if (!m) {
    const grid = make();
    const geometry = modelGeometry(grid, opts);
    m = { key, grid, geometry, colors: burstColors(grid) };
    models.set(key, m);
  }
  return m;
}

// Up to 12 colour entries weighted by how many voxels use each colour.
export function burstColors(grid, n = 12) {
  const list = gridColors(grid);
  const total = list.reduce((s, c) => s + c.count, 0) || 1;
  const out = [];
  for (const c of list) {
    const k = Math.max(1, Math.round((c.count / total) * n));
    for (let i = 0; i < k && out.length < n; i++) out.push(c.color);
  }
  return out.length ? out : [0xffffff];
}

function shade(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.sharedGeometry = true; // cached: never disposed with the mesh
  return mesh;
}

export function modelMesh(m, material = getMaterial('character')) {
  return shade(new THREE.Mesh(m.geometry, material));
}

// A mesh that shows one of several whole models (poses, animation frames).
export class PoseMesh extends THREE.Mesh {
  constructor(poses, material = getMaterial('character'), first = Object.keys(poses)[0]) {
    super(poses[first].geometry, material);
    this.poses = poses;
    this.pose = first;
    shade(this);
  }

  setPose(name) {
    if (name === this.pose) return this;
    const m = this.poses[name];
    if (!m) throw new Error(`No pose "${name}" (have ${Object.keys(this.poses).join(', ')})`);
    this.geometry = m.geometry;
    this.pose = name;
    return this;
  }

  get model() {
    return this.poses[this.pose];
  }
}

// ---------------------------------------------------------------- contact shadow
// A soft dark blob on the ground under a character (art bible section 10: "a soft contact shadow
// under every character"). One shared texture and material; the blob is a flat quad just above
// the ground, scaled to the character's footprint.
let blobMat = null;
let blobGeo = null;

function blobMaterial() {
  if (blobMat) return blobMat;
  const N = 64;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const d = Math.hypot((x + 0.5) / N - 0.5, (y + 0.5) / N - 0.5) * 2;
      const a = Math.max(0, 1 - d) ** 1.6;
      const i = (y * N + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
      data[i + 3] = Math.round(a * 255);
    }
  const tex = new THREE.DataTexture(data, N, N);
  tex.needsUpdate = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  blobMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.42, toneMapped: false });
  blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  return blobMat;
}

// radius in tiles. Returns a Mesh positioned relative to its parent's origin (feet at y = 0).
export function contactShadow(radius = 0.4, opacity = 1) {
  const mat = blobMaterial();
  const m = new THREE.Mesh(blobGeo, opacity === 1 ? mat : Object.assign(mat.clone(), { opacity: mat.opacity * opacity }));
  m.scale.set(radius * 2, 1, radius * 2);
  m.position.y = 0.004;
  m.renderOrder = 2;
  m.userData.sharedGeometry = true;
  m.userData.noShadow = true;
  m.name = 'contact-shadow';
  return m;
}

// Keep a contact shadow on the ground under an object that hops or floats: call each frame with
// the object's height above its feet; the blob shrinks and fades with height.
export function settleShadow(blob, height, radius) {
  const k = Math.max(0.35, 1 - height * 1.2);
  blob.scale.set(radius * 2 * k, 1, radius * 2 * k);
  blob.position.y = 0.004 - height;
}

export const FEET_Y = GROUND_Y;
