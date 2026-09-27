// Gameplay randomness (AI decisions, drops, particles). Everything that is not
// terrain generation draws from here instead of Math.random, so a test can
// call seedRandom(n) and replay a run exactly.
import { rng } from './voxel.js';

let gen = rng((Math.random() * 4294967296) >>> 0);

export function random() {
  return gen();
}

export function seedRandom(seed) {
  gen = rng(seed >>> 0);
}

// Random element of an array.
export function pick(arr) {
  return arr[Math.floor(gen() * arr.length)];
}
