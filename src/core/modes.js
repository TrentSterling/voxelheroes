// Game modes: what the per-frame update does right now.
//
// Each mode is registered by name from its own file and gets the frame's dt:
//
//   registerMode('inventory', {
//     enter({ from, resumed }) { show the menu },
//     update(dt) { if (input.pressed('menu')) popMode(); },
//     exit({ to, suspended }) { hide the menu },
//   });
//
// setMode() switches outright; pushMode() runs a mode on top of the current
// one (pause, dialog, inventory) and popMode() returns to it. state.mode is
// always the top of the stack. The world, particles and camera update in every
// mode; only the mode decides whether the hero and entities move.
import { state } from './state.js';
import { emit } from './events.js';
import { input } from './input.js';

const modes = new Map();

export function registerMode(name, def) {
  if (modes.has(name)) throw new Error(`Mode "${name}" is already registered`);
  modes.set(name, def);
}

export const getMode = (name) => modes.get(name);
export const hasMode = (name) => modes.has(name);

function switchTo(to, { suspended = false, resumed = false } = {}) {
  const from = state.mode;
  modes.get(from)?.exit?.({ to, suspended });
  state.mode = to;
  input.clearPresses();
  modes.get(to)?.enter?.({ from, resumed });
  emit('mode-change', { from, to });
}

export function setMode(name) {
  if (!modes.has(name)) throw new Error(`Unknown mode "${name}"`);
  state.modeStack.length = 0;
  switchTo(name);
}

export function pushMode(name) {
  if (!modes.has(name)) throw new Error(`Unknown mode "${name}"`);
  state.modeStack.push(state.mode);
  switchTo(name, { suspended: true });
}

export function popMode() {
  const to = state.modeStack.pop() ?? 'play';
  switchTo(to, { resumed: true });
}

export function updateMode(dt) {
  modes.get(state.mode)?.update?.(dt);
}
