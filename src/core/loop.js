// The real-time loop: one simulation step and one render per animation frame.
//
// In manual mode (setManual(true)) the loop stops advancing the simulation, so
// a test can step it deterministically with window.__voxelHeroes.update(1 / 60),
// and main.js's draw callback skips the scene (a look frame takes seconds in
// software GL): tests call window.__voxelHeroes.render() before a screenshot.

export const MAX_DT = 1 / 30;

let manual = false;
let running = false;

export function setManual(on) {
  manual = !!on;
}

export const isManual = () => manual;

export function startLoop(update, render) {
  if (running) return;
  running = true;
  let last = performance.now();
  const frame = () => {
    requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min(Math.max(0, (now - last) / 1000), MAX_DT);
    last = now;
    if (!manual) update(dt);
    render();
  };
  frame();
}
