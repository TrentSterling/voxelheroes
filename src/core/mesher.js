// The voxel mesher's core, with no three.js in it, so a Web Worker can run it (world/mesh-worker.js)
// as well as the main thread (core/vox.js meshVoxels wraps it into a BufferGeometry).
//
// meshInto(acc, grid, opts) appends the exposed faces of `grid` ({ sx, sy, sz, data: Uint32Array,
// faces: Map | null }, a DenseGrid will do) to an accumulator from newAccumulator(); finish(acc)
// returns exact-size arrays { faces, pos, nor, col, uv, idx, min, max }. Several calls into one
// accumulator (the slabs of a screen, or its own tiles plus a few edge tiles) come out as one mesh,
// in the order they were made, exactly as one call over the union would when the slabs follow the
// mesher's own z order. Options are core/vox.js meshVoxels's (scale, origin, neighbors, region,
// faces, skipBottom, ao).
//
// Colours: voxels hold sRGB hex; vertices get linear colour (three.js's SRGBToLinear, the same
// arithmetic, so a worker's mesh is bit-identical to the main thread's) darkened by baked AO.

// Face table: normal, the 4 corners (unit cube, CCW seen from outside).
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

export const FACE_ALL = 63;

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

// three.js's SRGBToLinear (math/ColorManagement.js), term for term.
const srgbToLinear = (c) => (c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4));

// Linear-space colour per sRGB hex, converted once (colour conversion per voxel was ~10% of a build).
const _linear = new Map();
export function linearOf(hex) {
  let c = _linear.get(hex);
  if (!c) {
    c = [srgbToLinear(((hex >> 16) & 255) / 255), srgbToLinear(((hex >> 8) & 255) / 255), srgbToLinear((hex & 255) / 255)];
    _linear.set(hex, c);
  }
  return c;
}

// A growable set of output buffers. shared: reuse one module-level set (a synchronous caller that
// copies the result out at once); otherwise the accumulator owns its buffers (a mesh built in steps).
const sharedBufs = { cap: 0, pos: null, nor: null, col: null, uv: null, idx: null };
export function newAccumulator({ shared = false } = {}) {
  const bufs = shared ? sharedBufs : { cap: 0, pos: null, nor: null, col: null, uv: null, idx: null };
  return { bufs, n: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
}

function reserve(b, faces) {
  if (faces <= b.cap) return;
  let cap = Math.max(4096, b.cap);
  while (cap < faces) cap *= 2;
  const grow = (a, T, k) => { const x = new T(cap * k); if (a) x.set(a); return x; };
  b.pos = grow(b.pos, Float32Array, 12);
  b.nor = grow(b.nor, Float32Array, 12);
  b.col = grow(b.col, Float32Array, 12);
  b.uv = grow(b.uv, Float32Array, 8);
  b.idx = grow(b.idx, Uint32Array, 6);
  b.cap = cap;
}

export function meshInto(acc, grid, opts = {}) {
  const scale = opts.scale ?? 1 / 16;
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
  const b = acc.bufs;
  let n = acc.n; // faces written
  reserve(b, n + 1024);
  // Bounds of the voxels that made faces, in voxels (converted once at the end).
  let bx0 = Infinity, by0 = Infinity, bz0 = Infinity, bx1 = -Infinity, by1 = -Infinity, bz1 = -Infinity;
  for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const ci = x + sx * (y + sy * z);
    const val = data[ci];
    if (!val) continue;
    const base = linearOf(val & 0xffffff); // → linear working space
    const inner = x > 0 && y > 0 && z > 0 && x < sx - 1 && y < sy - 1 && z < sz - 1;
    const before = n;
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
      if (n >= b.cap) reserve(b, n + 1);
      const { pos, nor, col, uv } = b;
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
      const v = n * 4, i = n * 6, idx = b.idx;
      if (aos[0] + aos[2] > aos[1] + aos[3]) { idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2; idx[i + 3] = v; idx[i + 4] = v + 2; idx[i + 5] = v + 3; }
      else { idx[i] = v + 1; idx[i + 1] = v + 2; idx[i + 2] = v + 3; idx[i + 3] = v + 1; idx[i + 4] = v + 3; idx[i + 5] = v; }
      n++;
    }
    if (n > before) {
      if (x < bx0) bx0 = x; if (y < by0) by0 = y; if (z < bz0) bz0 = z;
      if (x > bx1) bx1 = x; if (y > by1) by1 = y; if (z > bz1) bz1 = z;
    }
  }
  if (bx1 >= bx0) {
    const lo = [(bx0 - ox) * scale, (by0 - oy) * scale, (bz0 - oz) * scale];
    const hi = [(bx1 + 1 - ox) * scale, (by1 + 1 - oy) * scale, (bz1 + 1 - oz) * scale];
    for (let k = 0; k < 3; k++) {
      acc.min[k] = Math.min(acc.min[k], lo[k], hi[k]);
      acc.max[k] = Math.max(acc.max[k], lo[k], hi[k]);
    }
  }
  acc.n = n;
  return acc;
}

// Exact-size copies of what the accumulator holds. idx is always a Uint32Array here; meshVoxels
// narrows it to 16 bits where it fits.
export function finish(acc) {
  const { bufs: b, n } = acc;
  if (!n) return { faces: 0, pos: new Float32Array(0), nor: new Float32Array(0), col: new Float32Array(0), uv: new Float32Array(0), idx: new Uint32Array(0), min: [0, 0, 0], max: [0, 0, 0] };
  return {
    faces: n,
    pos: b.pos.slice(0, n * 12),
    nor: b.nor.slice(0, n * 12),
    col: b.col.slice(0, n * 12),
    uv: b.uv.slice(0, n * 8),
    idx: b.idx.slice(0, n * 6),
    min: acc.min,
    max: acc.max,
  };
}

// One call: mesh `grid` with `opts` into fresh arrays (see meshInto).
export function meshArrays(grid, opts = {}, { shared = false } = {}) {
  return finish(meshInto(newAccumulator({ shared }), grid, opts));
}
