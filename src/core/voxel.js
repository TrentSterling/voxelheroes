import * as THREE from 'three';
import { getMaterial } from './materials.js';

// Seeded RNG (mulberry32) so the world looks the same on every load.
// getState/setState let the world replay one tile's random stream when it
// rebuilds a screen, so unchanged tiles keep their exact colours.
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.getState = () => a;
  next.setState = (s) => {
    a = s >>> 0;
  };
  return next;
}

const tmp = new THREE.Color();

// Voxels live in a sparse map keyed by integer coordinates. Each voxel stores
// its own (jittered) colour so the mesh reads as a grid of little cubes.
export class VoxelGrid {
  constructor(random = Math.random) {
    this.map = new Map();
    this.random = random;
  }

  static key(x, y, z) {
    return ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024);
  }

  set(x, y, z, color, jitter = 0.07) {
    tmp.set(color);
    const k = 1 + (this.random() * 2 - 1) * jitter;
    this.map.set(VoxelGrid.key(x, y, z), [x, y, z, tmp.r * k, tmp.g * k, tmp.b * k]);
  }

  has(x, y, z) {
    return this.map.has(VoxelGrid.key(x, y, z));
  }

  delete(x, y, z) {
    this.map.delete(VoxelGrid.key(x, y, z));
  }

  box(x0, x1, y0, y1, z0, z1, color, jitter) {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) this.set(x, y, z, color, jitter);
  }

  // Filled ellipsoid centred on (cx, cy, cz); colorFn(x, y, z) picks the colour.
  ellipsoid(cx, cy, cz, rx, ry, rz, colorFn, jitter) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
          const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          if (d <= 1) {
            const c = colorFn(x, y, z, d);
            if (c != null) this.set(x, y, z, c, jitter);
          }
        }
  }
}

// Each face: outward normal and 4 corners in CCW order (the lab's face table, so the per-face UVs
// run the same way as src/core/vox.js meshVoxels).
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const FACE_UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
// Voxel AO: brightness by how many of a corner's three outer neighbours are filled (lab values).
const AO_CURVE = [1.0, 0.8, 0.66, 0.52];
// For each face and corner: the two edge neighbours and the corner neighbour, as offsets from the
// voxel (in the face's outward layer), precomputed once.
const AO_TAPS = FACES.map((F) => {
  const axes = [0, 1, 2].filter((i) => F.n[i] === 0);
  return F.c.map((c) => {
    const d = [c[0] * 2 - 1, c[1] * 2 - 1, c[2] * 2 - 1];
    const e1 = [0, 0, 0];
    const e2 = [0, 0, 0];
    e1[axes[0]] = d[axes[0]];
    e2[axes[1]] = d[axes[1]];
    const n = F.n;
    return [
      [n[0] + e1[0], n[1] + e1[1], n[2] + e1[2]],
      [n[0] + e2[0], n[1] + e2[1], n[2] + e2[2]],
      [n[0] + e1[0] + e2[0], n[1] + e1[1] + e2[1], n[2] + e1[2] + e2[2]],
    ];
  });
});

// Culled mesher: emits only faces whose neighbour is empty. Writes linear vertex colours with baked
// voxel AO and a per-face 'faceUv' (0..1 across each face) for the bevel and seam shader in
// src/core/materials.js. Face brightness comes from the lights, not from the mesher.
// opts.ao = false skips the AO bake.
export function buildGeometry(grid, size, offset = [0, 0, 0], opts = {}) {
  const pos = [];
  const nor = [];
  const col = [];
  const uv = [];
  const idx = [];
  const aoOn = opts.ao !== false;
  let v = 0;
  const [ox, oy, oz] = offset;
  const aos = [0, 0, 0, 0];
  for (const [x, y, z, r, g, b] of grid.map.values()) {
    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      if (grid.has(x + F.n[0], y + F.n[1], z + F.n[2])) continue;
      for (let k = 0; k < 4; k++) {
        const c = F.c[k];
        let a = 3;
        if (aoOn) {
          const [t1, t2, tc] = AO_TAPS[f][k];
          const s1 = grid.has(x + t1[0], y + t1[1], z + t1[2]) ? 1 : 0;
          const s2 = grid.has(x + t2[0], y + t2[1], z + t2[2]) ? 1 : 0;
          const sc = grid.has(x + tc[0], y + tc[1], z + tc[2]) ? 1 : 0;
          a = s1 && s2 ? 0 : 3 - (s1 + s2 + sc);
        }
        aos[k] = a;
        const m = AO_CURVE[3 - a];
        pos.push((x + c[0] + ox) * size, (y + c[1] + oy) * size, (z + c[2] + oz) * size);
        nor.push(F.n[0], F.n[1], F.n[2]);
        col.push(r * m, g * m, b * m);
        uv.push(FACE_UV[k][0], FACE_UV[k][1]);
      }
      // Flip the quad diagonal so AO interpolates without the anisotropy artefact.
      if (aos[0] + aos[2] > aos[1] + aos[3]) idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      else idx.push(v + 1, v + 2, v + 3, v + 1, v + 3, v);
      v += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('faceUv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(v > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

// The prototype's one shared voxel material, kept so old content renders with the look's bevel and
// seam shader until it asks src/core/materials.js for a kind. It is the terrain kind (faint seams):
// the prototype meshes terrain and characters with this one material.
export const voxelMaterial = getMaterial('terrain');
