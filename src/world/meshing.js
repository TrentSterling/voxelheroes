// Where terrain meshes are made: in Web Workers (world/mesh-worker.js) when the page can start
// them, else on the main thread in slices. Either way a build is a sequence of small steps
// (terrain.js screenTerrainSteps) that world.pump() runs within a per-frame time budget, so a
// screen streaming in never costs a frame.
//
//   const job = submitMesh(layer.grid, parts)   // null: no worker, mesh here (meshInto, sliced)
//   yield { wait: job.done }                    // the build step waits; other builds go on
//   job.result                                  // { faces, pos, nor, col, uv, idx, min, max }
//
// The layer's voxel buffer is transferred to the worker: the grid is not usable afterwards.
// Workers are off in manual mode (play-tests step the simulation by hand, and a worker's answer
// only arrives between two of their calls) and when useWorkers(false) says so; the main thread
// then meshes in slices, with the same result bit for bit (core/mesher.js).
import { isManual } from '../core/loop.js';
import MeshWorker from './mesh-worker.js?worker&inline';

const POOL = Math.max(1, Math.min(3, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4) - 2));

// ?workers=0 meshes on the main thread only (for comparing; the slices keep frames short either way)
let enabled = typeof location === 'undefined' || new URLSearchParams(location.search).get('workers') !== '0';
let broken = false; // a worker failed to start or answered with an error: main thread from then on
const workers = [];
const waiting = new Map(); // id -> job
let nextId = 1;
let rr = 0;
let sent = 0; // layers meshed in workers so far

// Turn the workers off (or back on); jobs already sent still finish.
export function useWorkers(on = true) {
  enabled = !!on;
}

export const workersOn = () => enabled && !broken && !isManual() && typeof Worker !== 'undefined';

function worker() {
  while (workers.length < POOL) {
    let w;
    try {
      w = new MeshWorker();
    } catch (e) {
      broken = true;
      console.warn(`meshing: no worker (${e?.message ?? e}); meshing on the main thread`);
      return null;
    }
    w.onmessage = ({ data }) => {
      const job = waiting.get(data.id);
      if (!job) return;
      waiting.delete(data.id);
      if (data.error) {
        broken = true;
        console.warn(`meshing: a worker failed (${data.error}); meshing on the main thread`);
        job.fail(new Error(data.error));
      } else job.ok(data);
    };
    w.onerror = (e) => {
      broken = true;
      console.warn(`meshing: a worker failed (${e?.message ?? e}); meshing on the main thread`);
      for (const job of waiting.values()) job.fail(new Error('mesh worker error'));
      waiting.clear();
    };
    workers.push(w);
  }
  return workers[rr++ % workers.length];
}

// Send a layer to a worker: { done: Promise, result (when done), error }; null when workers are off.
export function submitMesh(grid, parts) {
  if (!workersOn()) return null;
  const w = worker();
  if (!w) return null;
  const id = nextId++;
  const job = { id, result: null, error: null };
  job.done = new Promise((ok) => {
    job.ok = (r) => {
      job.result = r;
      ok();
    };
    job.fail = (e) => {
      job.error = e;
      ok();
    };
  });
  waiting.set(id, job);
  sent++;
  w.postMessage({ id, sx: grid.sx, sy: grid.sy, sz: grid.sz, data: grid.data, parts }, [grid.data.buffer]);
  return job;
}

export const meshJobsInFlight = () => waiting.size;
export const meshStats = () => ({ workers: workers.length, sent, inFlight: waiting.size, on: workersOn() });
