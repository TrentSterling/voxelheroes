import * as THREE from 'three';

// Seeded RNG so the world looks the same on every load.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

// Each face: outward normal, neighbour offset, and 4 corners in CCW order.
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.86 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.86 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.6 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.93 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.8 },
];

// Greedy-free culled mesher: emits only faces whose neighbour is empty.
export function buildGeometry(grid, size, offset = [0, 0, 0]) {
  const pos = [];
  const nor = [];
  const col = [];
  const idx = [];
  let v = 0;
  const [ox, oy, oz] = offset;
  for (const [x, y, z, r, g, b] of grid.map.values()) {
    for (const f of FACES) {
      if (grid.has(x + f.n[0], y + f.n[1], z + f.n[2])) continue;
      for (const c of f.c) {
        pos.push((x + c[0] + ox) * size, (y + c[1] + oy) * size, (z + c[2] + oz) * size);
        nor.push(f.n[0], f.n[1], f.n[2]);
        col.push(r * f.shade, g * f.shade, b * f.shade);
      }
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      v += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

export const voxelMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
