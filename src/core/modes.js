// Game modes: what the per-frame update does right now.
//
// Each mode is registered by name from its own file and gets the frame's dt:
//
//   registerMode('inventory', {
//     enter({ from, resumed }) { show the menu },
//     update(dt) { if (input.pressed('menu')) popMode(); },
//     exit({ to, suspended }) { hide the menu },
//     carry: ['sword'],   // optional, see below
//   });
//
// setMode() switches outright; pushMode() runs a mode on top of the current
// one (pause, dialog, inventory) and popMode() returns to it. state.mode is
// always the top of the stack. The world, particles and camera update in every
// mode; only the mode decides whether the hero and entities move.
//
// Every switch clears latched button presses, so one press never acts in two
// modes. A mode can list actions in `carry`: a press of one of them while the
// mode runs is pressed again on the first tick after the mode ends. No built-in
// mode carries anything: input is ignored during the screen slide and warps
// (gameplay spec 4.3), so a swing pressed on the way in is dropped, not played
// on arrival.
//
// setMode() unwinds the whole stack: every mode on it gets exit() with
// suspended: false, top first, so a dialog or menu under the top closes too.
import { state } from './state.js';
import { emit } from './events.js';
import { input } from './input.js';

const modes = new Map();
const carried = new Set(); // presses the current mode keeps for the next one

export function registerMode(name, def) {
  if (modes.has(name)) throw new Error(`Mode "${name}" is already registered`);
  modes.set(name, def);
}

export const getMode = (name) => modes.get(name);
export const hasMode = (name) => modes.has(name);

function switchTo(to, { suspended = false, resumed = false, unwind = [] } = {}) {
  const from = state.mode;
  const carry = !suspended && carried.size ? [...carried] : [];
  carried.clear();
  modes.get(from)?.exit?.({ to, suspended });
  for (const name of unwind) modes.get(name)?.exit?.({ to, suspended: false });
  state.mode = to;
  input.clearPresses();
  for (const a of carry) input.carry(a);
  modes.get(to)?.enter?.({ from, resumed });
  emit('mode-change', { from, to });
}

export function setMode(name) {
  if (!modes.has(name)) throw new Error(`Unknown mode "${name}"`);
  const below = state.modeStack.splice(0).reverse(); // suspended modes, nearest first
  switchTo(name, { unwind: below });
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
  const mode = modes.get(state.mode);
  if (mode?.carry) for (const a of mode.carry) if (input.pressed(a)) carried.add(a);
  mode?.update?.(dt);
}
