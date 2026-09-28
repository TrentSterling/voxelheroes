// The mesher as of 2026-09-27 (before the fast rewrite), kept to prove the rewrite is exact.
import * as THREE from 'three';
const VOXEL = 1 / 16;
const FACE_ALL = 63;
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
// opts.neighbors(x,y,z) â†’ bool can report occupancy outside the grid (for seamless tiles).
// opts.region: [x0,y0,z0,x1,y1,z1] (upper bounds exclusive) meshes only the voxels inside that box;
//   voxels outside it still hide faces and darken AO, so a grid built with a margin of neighbouring
//   tiles meshes one screen seamlessly.
// opts.faces: bit mask of the face directions to emit (FACE_PX | ... ; default all six).
// opts.skipBottom: true drops every bottom face; a number drops only those of voxels whose y index is
//   below it (terrain: no bottom faces on the ground, but overhangs keep theirs for shadow maps).
export function meshVoxelsRef(grid, opts = {}) {
  const scale = opts.scale ?? VOXEL;
  const [ox, oy, oz] = opts.origin ?? [grid.sx / 2, 0, grid.sz / 2];
  const { sx, sy, sz, data } = grid;
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
  const pos = [], nor = [], col = [], uv = [], idx = [];
  const aos = [0, 0, 0, 0];
  const faces = grid.faces?.size ? grid.faces : null;
  let v = 0;
  for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const ci = x + sx * (y + sy * z);
    const val = data[ci];
    if (!val) continue;
    _c.setHex(val & 0xffffff, THREE.SRGBColorSpace); // â†’ linear working space
    for (let f = 0; f < 6; f++) {
      if (!(mask & (1 << f))) continue;
      const F = FACE_TABLE[f];
      const nx = F.n[0], ny = F.n[1], nz = F.n[2];
      if (ny === -1 && y < skipBelow) continue;
      const px = x + nx, py = y + ny, pz = z + nz;
      if (solid(px, py, pz)) continue;
      const fc = faces?.get(ci * 6 + f);
      const c = fc === undefined ? _c : _fc.setHex(fc, THREE.SRGBColorSpace);
      for (let k = 0; k < 4; k++) {
        const C = F.corners[k];
        let a = 3;
        if (aoOn) {
          const s1 = solid(px + C.e1[0], py + C.e1[1], pz + C.e1[2]) ? 1 : 0;
          const s2 = solid(px + C.e2[0], py + C.e2[1], pz + C.e2[2]) ? 1 : 0;
          const sc = solid(px + C.ec[0], py + C.ec[1], pz + C.ec[2]) ? 1 : 0;
          a = (s1 && s2) ? 0 : 3 - (s1 + s2 + sc);
        }
        aos[k] = a;
        pos.push((x + C.c[0] - ox) * scale, (y + C.c[1] - oy) * scale, (z + C.c[2] - oz) * scale);
        nor.push(nx, ny, nz);
        const m = AO_CURVE[3 - a];
        col.push(c.r * m, c.g * m, c.b * m);
        uv.push(FACE_UV[k][0], FACE_UV[k][1]);
      }
      // Flip the quad diagonal so AO interpolates without the anisotropy artefact.
      if (aos[0] + aos[2] > aos[1] + aos[3]) idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      else idx.push(v + 1, v + 2, v + 3, v + 1, v + 3, v);
      v += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('faceUv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(v > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

// The colours a grid is made of, most used first: [{ color, count }]. Handy for bursting a model
