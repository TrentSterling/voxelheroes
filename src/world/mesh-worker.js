// The terrain mesher off the main thread (world/meshing.js starts it). A message carries one voxel
// layer of a screen and the pieces to mesh from it:
//   { id, sx, sy, sz, data: Uint32Array (transferred), parts: [meshVoxels opts, ...] }
// and the answer is one mesh of all the pieces, in order (core/mesher.js finish()), its arrays
// transferred back: { id, faces, pos, nor, col, uv, idx, min, max }. Options that are functions
// (neighbors) cannot cross; the terrain never passes them.
import { newAccumulator, meshInto, finish } from '../core/mesher.js';

self.onmessage = ({ data: job }) => {
  try {
    const grid = { sx: job.sx, sy: job.sy, sz: job.sz, data: job.data, faces: null };
    const acc = newAccumulator({ shared: true });
    for (const opts of job.parts) meshInto(acc, grid, opts);
    const m = finish(acc);
    self.postMessage({ id: job.id, ...m }, [m.pos.buffer, m.nor.buffer, m.col.buffer, m.uv.buffer, m.idx.buffer]);
  } catch (e) {
    self.postMessage({ id: job.id, error: String(e?.message ?? e) });
  }
};
