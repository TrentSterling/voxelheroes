// The real-time loop: fixed 1/60 s simulation steps, one render per animation
// frame (gameplay spec P0.1: the simulation steps at 1/60 s whatever the
// display's frame rate, so every timing in TUNING means the same number of
// ticks everywhere).
//
// Each frame adds the real time since the last frame to an accumulator and
// runs as many whole ticks as it holds (at most MAX_STEPS, so a slow device
// slows the game down instead of spiralling). A 144 Hz display runs a tick on
// most frames; a 30 Hz one runs two per frame.
//
// In manual mode (setManual(true)) the loop keeps rendering but stops
// advancing the simulation, so a test can step it deterministically with
// window.__voxelHeroes.update(1 / 60).
import { TICK } from './tuning.js';

export const STEP = TICK; // seconds per simulation tick (1/60)
export const MAX_STEPS = 4; // ticks per frame at most (a frame longer than 1/15 s is cut)
export const MAX_DT = STEP * MAX_STEPS; // kept for older callers

let manual = false;
let running = false;

export function setManual(on) {
  manual = !!on;
}

export const isManual = () => manual;

// Pure accumulator step: how many ticks `elapsed` more seconds buy, and what
// is left over. advance(0.004, 1 / 60) -> { steps: 1, acc: 0.004 }.
export function advance(acc, elapsed, step = STEP, maxSteps = MAX_STEPS) {
  let a = acc + Math.max(0, elapsed);
  let steps = Math.floor((a + 1e-9) / step);
  if (steps > maxSteps) {
    steps = maxSteps;
    a = 0; // drop the backlog instead of catching up
  } else {
    a -= steps * step;
    if (a < 0) a = 0;
  }
  return { steps, acc: a };
}

export function startLoop(update, render) {
  if (running) return;
  running = true;
  let last = performance.now();
  let acc = 0;
  const frame = () => {
    requestAnimationFrame(frame);
    const now = performance.now();
    const elapsed = (now - last) / 1000;
    last = now;
    if (!manual) {
      const r = advance(acc, elapsed);
      acc = r.acc;
      for (let i = 0; i < r.steps; i++) update(STEP);
    } else {
      acc = 0;
    }
    render();
  };
  frame();
}
