// Dense voxel grid and mesher, ported from the art bible's look lab (design/art-bible/lab/src/voxel.js).
// Use this for all new content: terrain at 1/8 tile per block (opts.scale = 1/8) and characters,
// props and dungeon floors at 1/16 tile per voxel (the default). The mesher bakes voxel AO into the
// vertex colours and writes a per-face 'faceUv' attribute that the voxel material's bevel and seam
// shader reads (see src/core/materials.js).
// Convention: x → east (screen right), y → up, z → south (toward the camera).
// One world unit = one map tile = 16 character voxels (a voxel is 1/16 unit) = 8 terrain blocks.
import * as THREE from 'three';
import { meshArrays } from './mesher.js';

export const VOXELS_PER_TILE = 16;
export const VOXEL = 1 / VOXELS_PER_TILE;

const FILLED = 0x1000000;

// Boxels: a voxel's six faces can each carry their own colour (Boxel's per-face model). `faces` is
// null until the first setFace, then a Map from cell index * 6 + face (FACE_* bit order: +x, -x,
// +y, -y, +z, -z) to a colour that overrides the voxel's own on that face. Plain voxel grids
// never allocate it.
export class DenseGrid {
  constructor(sx, sy, sz) {
    this.sx = sx; this.sy = sy; this.sz = sz;
    this.data = new Uint32Array(sx * sy * sz);
    this.faces = null;
  }
  // Colour one face of a filled voxel (f: 0..5); c == null removes the override.
  setFace(x, y, z, f, c) {
    if (!this.has(x, y, z)) return this;
    const k = this.i(x, y, z) * 6 + f;
    if (c == null) { this.faces?.delete(k); return this; }
    (this.faces ??= new Map()).set(k, c & 0xffffff);
    return this;
  }
  faceColor(x, y, z, f) {
    const i = this.i(x, y, z);
    return this.faces?.get(i * 6 + f) ?? (this.data[i] & 0xffffff);
  }
  inside(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }
  i(x, y, z) { return x + this.sx * (y + this.sy * z); }
  get(x, y, z) { return this.inside(x, y, z) ? this.data[this.i(x, y, z)] : 0; }
  has(x, y, z) { return this.get(x, y, z) !== 0; }
  color(x, y, z) { return this.get(x, y, z) & 0xffffff; }
  set(x, y, z, c) {
    if (!this.inside(x, y, z)) return this;
    const i = this.i(x, y, z);
    this.data[i] = c == null ? 0 : (FILLED | (c & 0xffffff));
    if (this.faces) for (let f = 0; f < 6; f++) this.faces.delete(i * 6 + f); // a new voxel starts plain
    return this;
  }
  // Inclusive-exclusive box. c may be a color or fn(x,y,z) -> color|null.
  box(x0, y0, z0, x1, y1, z1, c) {
    for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
    }
    return this;
  }
  clear(x0, y0, z0, x1, y1, z1) { return this.box(x0, y0, z0, x1, y1, z1, null); }
  ellipsoid(cx, cy, cz, rx, ry, rz, c) {
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    const z0 = Math.floor(cz - rz), z1 = Math.ceil(cz + rz);
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, dz = (z + 0.5 - cz) / rz;
      if (dx * dx + dy * dy + dz * dz <= 1) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
    }
    return this;
  }
  // Recolor existing voxels only.
  paint(x0, y0, z0, x1, y1, z1, c) {
    for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      if (this.has(x, y, z)) this.set(x, y, z, typeof c === 'function' ? c(x, y, z, this.color(x, y, z)) : c);
    }
    return this;
  }
  // Stamp a 2D pixel map onto the front (south, +z) surface: rows top→bottom, chars map to colors, '.' skips.
  // Each mapped pixel recolors the first filled voxel found scanning from the front, to `depth` voxels deep.
  stampFront(x0, yTop, rows, legend, depth = 1) {
    rows.forEach((row, r) => {
      const y = yTop - r;
      [...row].forEach((ch, k) => {
        const col = legend[ch];
        if (col === undefined) return;
        const x = x0 + k;
        for (let z = this.sz - 1; z >= 0; z--) {
          if (this.has(x, y, z)) {
            for (let d = 0; d < depth && z - d >= 0; d++) if (this.has(x, y, z - d)) this.set(x, y, z - d, col);
            break;
          }
        }
      });
    });
    return this;
  }
  mirrorX() { // copy left half onto right half (x < sx/2 is the master)
    const h = Math.floor(this.sx / 2);
    for (let z = 0; z < this.sz; z++) for (let y = 0; y < this.sy; y++) for (let x = 0; x < h; x++) {
      const src = this.i(x, y, z), dst = this.i(this.sx - 1 - x, y, z);
      this.data[dst] = this.data[src];
      if (!this.faces) continue;
      for (let f = 0; f < 6; f++) { // mirrored: +x and -x swap
        const c = this.faces.get(src * 6 + f), mf = f < 2 ? f ^ 1 : f;
        if (c === undefined) this.faces.delete(dst * 6 + mf); else this.faces.set(dst * 6 + mf, c);
      }
    }
    return this;
  }
  count() { let n = 0; for (const v of this.data) if (v) n++; return n; }
}

// Face bits for opts.faces.
export const FACE_PX = 1, FACE_NX = 2, FACE_PY = 4, FACE_NY = 8, FACE_PZ = 16, FACE_NZ = 32, FACE_ALL = 63;

// Build a BufferGeometry with only exposed faces, per-vertex colors (linear) with baked voxel AO,
// face UVs (0..1 per voxel face) for the bevel shader, and per-face flags.
// opts.scale: world size of one voxel. opts.origin: [ox,oy,oz] in voxels subtracted before scaling.
// opts.neighbors(x,y,z) → bool can report occupancy outside the grid (for seamless tiles).
// opts.region: [x0,y0,z0,x1,y1,z1] (upper bounds exclusive) meshes only the voxels inside that box;
//   voxels outside it still hide faces and darken AO, so a grid built with a margin of neighbouring
//   tiles meshes one screen seamlessly.
// opts.faces: bit mask of the face directions to emit (FACE_PX | ... ; default all six).
// opts.skipBottom: true drops every bottom face; a number drops only those of voxels whose y index is
//   below it (terrain: no bottom faces on the ground, but overhangs keep theirs for shadow maps).
// The work is core/mesher.js's (no three.js in it, so world/mesh-worker.js runs the same code).
export function meshVoxels(grid, opts = {}) {
  return arraysToGeometry(meshArrays(grid, { ...opts, scale: opts.scale ?? VOXEL }, { shared: true }));
}

// A BufferGeometry from mesher arrays ({ faces, pos, nor, col, uv, idx, min, max }). bounds: true
// takes the bounding box and sphere from the mesher's min / max (voxel boxes: never smaller than
// the vertices' own), false computes them from the vertices.
export function arraysToGeometry(m, { bounds = false } = {}) {
  const v = m.faces * 4;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(m.col, 3));
  g.setAttribute('faceUv', new THREE.BufferAttribute(m.uv, 2));
  g.setIndex(new THREE.BufferAttribute(v > 65535 ? m.idx : Uint16Array.from(m.idx), 1));
  if (bounds && m.faces) {
    g.boundingBox = new THREE.Box3(new THREE.Vector3(...m.min), new THREE.Vector3(...m.max));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
  } else {
    g.computeBoundingSphere();
    g.computeBoundingBox();
  }
  return g;
}

// The colours a grid is made of, most used first: [{ color, count }]. Handy for bursting a model
// into cubes of its own colours (see systems/particles.js).
export function gridColors(grid) {
  const counts = new Map();
  for (const v of grid.data) if (v) counts.set(v & 0xffffff, (counts.get(v & 0xffffff) ?? 0) + 1);
  return [...counts].map(([color, count]) => ({ color, count })).sort((a, b) => b.count - a.count);
}

// Deterministic hash noise for color jitter (so renders are reproducible).
export function hash3(x, y, z, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1442695040) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Mix two hex colors (sRGB space, fine for authoring variation).
export function mixHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
export function mulHex(a, k) { // scale each channel by k (clamped): lighter or darker, hue kept
  const f = (v) => Math.min(255, Math.round(v * k));
  return (f((a >> 16) & 255) << 16) | (f((a >> 8) & 255) << 8) | f(a & 255);
}
export function shadeHex(a, k) { // k<1 darker, k>1 lighter (toward white)
  if (k <= 1) return mixHex(a, 0x000000, 1 - k);
  return mixHex(a, 0xffffff, k - 1);
}
