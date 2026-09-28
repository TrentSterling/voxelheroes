// Dense voxel grid and mesher, ported from the art bible's look lab (design/art-bible/lab/src/voxel.js).
// Use this for all new content: terrain at 1/8 tile per block (opts.scale = 1/8) and characters,
// props and dungeon floors at 1/16 tile per voxel (the default). The mesher bakes voxel AO into the
// vertex colours and writes a per-face 'faceUv' attribute that the voxel material's bevel and seam
// shader reads (see src/core/materials.js).
// Convention: x → east (screen right), y → up, z → south (toward the camera).
// One world unit = one map tile = 16 character voxels (a voxel is 1/16 unit) = 8 terrain blocks.
import * as THREE from 'three';

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

// Face table: normal, the 4 corners (unit cube, CCW seen from outside), and the tangent axes for face UVs.
// Face order (and the bit order of opts.faces): +x, -x, +y, -y, +z, -z.
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const FACE_UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
const AO_CURVE = [1.0, 0.8, 0.66, 0.52];

// Face bits for opts.faces.
export const FACE_PX = 1, FACE_NX = 2, FACE_PY = 4, FACE_NY = 8, FACE_PZ = 16, FACE_NZ = 32, FACE_ALL = 63;

// Per face and corner: the corner offset and the three AO probe offsets (the two edge neighbours and
// the corner neighbour in the face's outward layer), precomputed so the mesher allocates nothing per face.
const FACE_TABLE = FACES.map((F) => {
  const axes = [0, 1, 2].filter((i) => F.n[i] === 0);
  return {
    n: F.n,
    corners: F.c.map((c) => {
      const d = [c[0] * 2 - 1, c[1] * 2 - 1, c[2] * 2 - 1];
      const e1 = [0, 0, 0], e2 = [0, 0, 0];
      e1[axes[0]] = d[axes[0]]; e2[axes[1]] = d[axes[1]];
      return { c, e1, e2, ec: [e1[0] + e2[0], e1[1] + e2[1], e1[2] + e2[2]] };
    }),
  };
});

const _c = new THREE.Color();
const _fc = new THREE.Color();

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
// Linear-space colour per sRGB hex, converted once (colour conversion per voxel was ~10% of a build).
const _linear = new Map();
function linearOf(hex) {
  let c = _linear.get(hex);
  if (!c) {
    _c.setHex(hex, THREE.SRGBColorSpace);
    c = [_c.r, _c.g, _c.b];
    _linear.set(hex, c);
  }
  return c;
}

// Growable output buffers, reused between calls; each geometry gets exact-size copies.
const out = { cap: 0, pos: null, nor: null, col: null, uv: null, idx: null };
function reserve(faces) {
  if (faces <= out.cap) return;
  let cap = Math.max(4096, out.cap);
  while (cap < faces) cap *= 2;
  const grow = (a, n) => { const b = new (a ? a.constructor : n.T)(cap * n.k); if (a) b.set(a); return b; };
  out.pos = grow(out.pos, { T: Float32Array, k: 12 });
  out.nor = grow(out.nor, { T: Float32Array, k: 12 });
  out.col = grow(out.col, { T: Float32Array, k: 12 });
  out.uv = grow(out.uv, { T: Float32Array, k: 8 });
  out.idx = grow(out.idx, { T: Uint32Array, k: 6 });
  out.cap = cap;
}

export function meshVoxels(grid, opts = {}) {
  const scale = opts.scale ?? VOXEL;
  const [ox, oy, oz] = opts.origin ?? [grid.sx / 2, 0, grid.sz / 2];
  const { sx, sy, sz, data } = grid;
  const sxy = sx * sy;
  const nb = opts.neighbors ?? null;
  const solid = (x, y, z) => {
    if (x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz) return data[x + sx * (y + sy * z)] !== 0;
    return nb ? !!nb(x, y, z) : false;
  };
  const aoOn = opts.ao !== false;
  const sb = opts.skipBottom ?? false;
  const skipBelow = sb === true ? Infinity : typeof sb === 'number' ? sb : -Infinity;
  const mask = opts.faces ?? FACE_ALL;
  const [rx0, ry0, rz0, rx1, ry1, rz1] = opts.region ?? [0, 0, 0, sx, sy, sz];
  const x0 = Math.max(0, rx0), y0 = Math.max(0, ry0), z0 = Math.max(0, rz0);
  const x1 = Math.min(sx, rx1), y1 = Math.min(sy, ry1), z1 = Math.min(sz, rz1);
  // Index offsets of each face's neighbour and AO probes, for voxels at least one cell inside the
  // grid (every probe is then within +-1 on each axis, so a plain array read).
  const off = (d) => d[0] + sx * d[1] + sxy * d[2];
  const OFF = FACE_TABLE.map((F) => ({ n: off(F.n), k: F.corners.map((C) => [off(C.e1), off(C.e2), off(C.ec)]) }));
  const aos = [0, 0, 0, 0];
  const faces = grid.faces?.size ? grid.faces : null;
  let n = 0; // faces written
  reserve(1024);
  for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const ci = x + sx * (y + sy * z);
    const val = data[ci];
    if (!val) continue;
    const base = linearOf(val & 0xffffff); // → linear working space
    const inner = x > 0 && y > 0 && z > 0 && x < sx - 1 && y < sy - 1 && z < sz - 1;
    for (let f = 0; f < 6; f++) {
      if (!(mask & (1 << f))) continue;
      const F = FACE_TABLE[f];
      const nx = F.n[0], ny = F.n[1], nz = F.n[2];
      if (ny === -1 && y < skipBelow) continue;
      const px = x + nx, py = y + ny, pz = z + nz;
      const O = OFF[f];
      const pi = ci + O.n;
      if (inner ? data[pi] !== 0 : solid(px, py, pz)) continue;
      const fc = faces?.get(ci * 6 + f);
      const c = fc === undefined ? base : linearOf(fc);
      if (n >= out.cap) reserve(n + 1);
      const { pos, nor, col, uv } = out;
      for (let k = 0; k < 4; k++) {
        const C = F.corners[k];
        let a = 3;
        if (aoOn) {
          let s1, s2, sc;
          if (inner) {
            const K = O.k[k];
            s1 = data[pi + K[0]] !== 0 ? 1 : 0;
            s2 = data[pi + K[1]] !== 0 ? 1 : 0;
            sc = data[pi + K[2]] !== 0 ? 1 : 0;
          } else {
            s1 = solid(px + C.e1[0], py + C.e1[1], pz + C.e1[2]) ? 1 : 0;
            s2 = solid(px + C.e2[0], py + C.e2[1], pz + C.e2[2]) ? 1 : 0;
            sc = solid(px + C.ec[0], py + C.ec[1], pz + C.ec[2]) ? 1 : 0;
          }
          a = (s1 && s2) ? 0 : 3 - (s1 + s2 + sc);
        }
        aos[k] = a;
        const p = n * 12 + k * 3;
        pos[p] = (x + C.c[0] - ox) * scale; pos[p + 1] = (y + C.c[1] - oy) * scale; pos[p + 2] = (z + C.c[2] - oz) * scale;
        nor[p] = nx; nor[p + 1] = ny; nor[p + 2] = nz;
        const m = AO_CURVE[3 - a];
        col[p] = c[0] * m; col[p + 1] = c[1] * m; col[p + 2] = c[2] * m;
        const q = n * 8 + k * 2;
        uv[q] = FACE_UV[k][0]; uv[q + 1] = FACE_UV[k][1];
      }
      // Flip the quad diagonal so AO interpolates without the anisotropy artefact.
      const v = n * 4, i = n * 6, idx = out.idx;
      if (aos[0] + aos[2] > aos[1] + aos[3]) { idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2; idx[i + 3] = v; idx[i + 4] = v + 2; idx[i + 5] = v + 3; }
      else { idx[i] = v + 1; idx[i + 1] = v + 2; idx[i + 2] = v + 3; idx[i + 3] = v + 1; idx[i + 4] = v + 3; idx[i + 5] = v; }
      n++;
    }
  }
  const v = n * 4;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out.pos.slice(0, n * 12), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(out.nor.slice(0, n * 12), 3));
  g.setAttribute('color', new THREE.BufferAttribute(out.col.slice(0, n * 12), 3));
  g.setAttribute('faceUv', new THREE.BufferAttribute(out.uv.slice(0, n * 8), 2));
  const idx = out.idx.subarray(0, n * 6);
  g.setIndex(new THREE.BufferAttribute(v > 65535 ? idx.slice() : Uint16Array.from(idx), 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
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
