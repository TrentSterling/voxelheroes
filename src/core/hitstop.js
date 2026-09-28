// Hitstop: the whole simulation holds for a few frames when a blow lands, so hits read as solid.
// main.js update() asks hitstopTick(dt) first and skips the step while it returns true (the camera
// and drawing go on). Real-time play only: play-tests step exact ticks, so they never hold.
//
//   hitstop(0.06)   hold 60 ms (a longer request wins; they never add up)
import { isManual } from './loop.js';

let left = 0;

export function hitstop(seconds) {
  if (isManual()) return;
  left = Math.max(left, seconds);
}

export function hitstopTick(dt) {
  if (left <= 0) return false;
  left -= dt;
  return true;
}
