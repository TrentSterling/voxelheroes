// Read and write Boxel's open .boxel file (JSON; the editor lives in C:\trontstack\boxel,
// crates/voxel-io/src/document.rs is the format). Boxels beat voxels: each of a voxel's six faces
// can carry its own colour, which lands in DenseGrid.faces and the mesher (src/core/vox.js).
//
//   import src from '../../assets/models/hero.boxel?raw';
//   const doc = parseBoxel(src, { recolor: { tunic: 0x9a6a44 } });
//   doc.grids.stand                  // DenseGrid per matrix, keyed by matrix name
//
// What is read: each matrix's voxels, base materials and face overrides, and the palette with its
// material names. Palette names are the recolour slots (a townsperson is the hero with a new
// tunic). Not read: transforms (a model is its grid; the game places it), modifiers and features
// (bake them in Boxel before saving), PBR, lights and animation.
//
// Layout: RLE runs of [count, value] over x fastest, then y, then z (the same order as
// DenseGrid.i). Voxel type 0 is air, anything else solid. A material id indexes the palette. Face
// overrides are [x, y, z, face, material] with faces in DenseGrid's order (+x, -x, +y, -y, +z, -z).
import { DenseGrid } from './vox.js';

const hex = (c) => ((c.r & 255) << 16) | ((c.g & 255) << 8) | (c.b & 255);

function unrle(runs, n) {
  const out = new Uint8Array(n);
  let i = 0;
  for (const [count, value] of runs) {
    if (i + count > n) throw new Error(`.boxel RLE overruns its matrix (${i + count} > ${n})`);
    out.fill(value, i, i + count);
    i += count;
  }
  return out;
}

// text: the file's JSON (string or parsed). opts.recolor: { materialName: 0xRRGGBB }.
export function parseBoxel(text, opts = {}) {
  const doc = typeof text === 'string' ? JSON.parse(text) : text;
  const names = {};
  for (const { id, name } of doc.names ?? []) names[id] = name;
  const recolor = opts.recolor ?? {};
  const colors = (doc.palette ?? []).map((c, id) => recolor[names[id]] ?? hex(c));
  const color = (id) => colors[id] ?? 0xff00ff;
  const grids = {};
  const list = [];
  for (const m of doc.matrices ?? []) {
    const [sx, sy, sz] = m.size;
    const n = sx * sy * sz;
    const type = unrle(m.voxels_rle, n);
    const mat = unrle(m.base_material_rle, n);
    const g = new DenseGrid(sx, sy, sz);
    for (let i = 0; i < n; i++) if (type[i]) g.data[i] = 0x1000000 | color(mat[i]);
    for (const [x, y, z, f, id] of m.face_overrides ?? []) g.setFace(x, y, z, f, color(id));
    grids[m.name] = g;
    list.push({ name: m.name, grid: g, visible: m.visible !== false });
  }
  return { version: doc.version, names, colors, grids, matrices: list };
}

function rle(values) {
  const runs = [];
  for (let i = 0; i < values.length; ) {
    let j = i + 1;
    while (j < values.length && values[j] === values[i]) j++;
    runs.push([j - i, values[i]]);
    i = j;
  }
  return runs;
}

// Write DenseGrids as a .boxel that Boxel opens for editing. grids: { name: DenseGrid } (one
// matrix each, laid out side by side along x so poses don't overlap in the editor).
// opts.names: { materialName: 0xRRGGBB } puts those colours first in the palette under those
// names, so the file keeps its recolour slots.
export function toBoxel(grids, opts = {}) {
  const ids = new Map(); // colour -> palette id (id 0 left unused)
  const names = [];
  const idOf = (c) => {
    if (!ids.has(c)) {
      if (ids.size >= 255) throw new Error('.boxel palette full (255 colours)');
      ids.set(c, ids.size + 1);
    }
    return ids.get(c);
  };
  for (const [name, c] of Object.entries(opts.names ?? {})) {
    const known = ids.has(c & 0xffffff);
    const id = idOf(c & 0xffffff);
    if (!known) names.push({ id, name });
  }
  const matrices = [];
  let x = 0;
  for (const [name, g] of Object.entries(grids)) {
    const n = g.sx * g.sy * g.sz;
    const type = new Array(n), mat = new Array(n);
    for (let i = 0; i < n; i++) {
      const v = g.data[i];
      type[i] = v ? 1 : 0;
      mat[i] = v ? idOf(v & 0xffffff) : 0;
    }
    const face_overrides = [];
    if (g.faces) {
      for (const [k, c] of [...g.faces].sort((a, b) => a[0] - b[0])) {
        const i = Math.floor(k / 6), f = k % 6;
        if (!g.data[i] || c === (g.data[i] & 0xffffff)) continue;
        const cx = i % g.sx, cy = Math.floor(i / g.sx) % g.sy, cz = Math.floor(i / (g.sx * g.sy));
        face_overrides.push([cx, cy, cz, f, idOf(c)]);
      }
    }
    matrices.push({
      name,
      size: [g.sx, g.sy, g.sz],
      transform: { position: [x, 0, 0], rotation: [0, 0, 0, 1], pivot: [0, 0, 0] },
      scale: 1,
      visible: true,
      voxels_rle: rle(type),
      base_material_rle: rle(mat),
      face_overrides,
      features: [],
      modifiers: [],
      instance_of: null,
      parent: null,
    });
    x += g.sx + 4;
  }
  const palette = Array.from({ length: 256 }, () => ({ r: 128, g: 128, b: 128, a: 255 }));
  for (const [c, id] of ids) palette[id] = { r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255, a: 255 };
  const pbr = Array.from({ length: 256 }, () => ({ metallic: 0, roughness: 0.5, emission: 0, transmission: 0 }));
  return JSON.stringify({ version: 12, palette, names, pbr, boxel_types: [], matrices, active: 0, clips: [] });
}
