// Seeded randomness for everything that is not terrain generation.
//
// random()   gameplay: AI decisions, drops, enemy start values
// fxRandom() cosmetics: particles and other effects
//
// Two streams keep gameplay the same when an effect changes how many random
// numbers it draws. seedRandom(n) reseeds both so a test can replay a run
// exactly. Never use Math.random for anything that affects gameplay.
import { rng } from './voxel.js';

const fresh = () => (Math.random() * 4294967296) >>> 0;

let gen = rng(fresh());
let fxGen = rng(fresh());

export function random() {
  return gen();
}

export function fxRandom() {
  return fxGen();
}

export function seedRandom(seed) {
  gen = rng(seed >>> 0);
  fxGen = rng((seed ^ 0x9e3779b9) >>> 0);
}

// Random element of an array (gameplay stream).
export function pick(arr) {
  return arr[Math.floor(gen() * arr.length)];
}
