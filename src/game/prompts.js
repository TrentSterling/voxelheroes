// The prompt bar (HUD, bottom right; gameplay spec 12.1): what the buttons
// do right now. Features register prompts; the ui stream draws
// currentPrompts() every frame.
//
//   registerPrompt({ id: 'lift', order: 20, action: 'sword', label: 'Lift', when: () => pot !== null });
//   currentPrompts() -> [{ id, action, label, button }]  (one per action: the lowest order wins)
//   buttonLabel('sword') -> 'J' | 'A' ... for the device used last (input.lastDevice())
//
// label may be a function returning the text (or null to hide the prompt).
import { state } from '../core/state.js';
import { input, ACTIONS, TOUCH_BUTTONS } from '../core/input.js';
import { player } from '../entities/player.js';
import { findInteraction } from '../systems/interact.js';
import { selectedItem } from '../items/inventory.js';

const prompts = [];

export function registerPrompt(def) {
  if (!def?.id) throw new Error('registerPrompt: a prompt needs an id');
  if (prompts.some((p) => p.id === def.id)) throw new Error(`Prompt "${def.id}" is already registered`);
  if (!ACTIONS.play.includes(def.action)) throw new Error(`Prompt "${def.id}": action must be a play action (${ACTIONS.play.join(', ')})`);
  prompts.push({ order: 50, when: () => true, ...def });
  prompts.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const PAD_NAMES = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'Back', 9: 'Start', 12: 'Up', 13: 'Down', 14: 'Left', 15: 'Right' };
const TOUCH_NAMES = { 'btn-a': 'A', 'btn-b': 'B', 'btn-dash': 'D', 'btn-guard': 'G', 'btn-map': 'Map', 'btn-inv': 'Menu', 'btn-start': 'Pause' };
const KEY_NAMES = { Escape: 'Esc', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl' };
const keyName = (code) => KEY_NAMES[code] ?? code.replace(/^(Key|Digit|Arrow)/, '');

export function buttonLabel(action, device = input.lastDevice()) {
  const b = input.bindings();
  if (device === 'gamepad') {
    const i = b.pad[action]?.[0];
    return i === undefined ? null : PAD_NAMES[i] ?? `B${i}`;
  }
  if (device === 'touch') {
    const id = Object.keys(TOUCH_BUTTONS).find((k) => TOUCH_BUTTONS[k] === action);
    return id ? TOUCH_NAMES[id] ?? id : null;
  }
  const code = b.keys[action]?.[0];
  return code ? keyName(code) : null;
}

export function currentPrompts() {
  if (state.mode !== 'play') return [];
  const taken = new Set();
  const out = [];
  for (const p of prompts) {
    if (taken.has(p.action) || !p.when()) continue;
    const label = typeof p.label === 'function' ? p.label() : p.label;
    if (!label) continue;
    taken.add(p.action);
    out.push({ id: p.id, action: p.action, label, button: buttonLabel(p.action) });
  }
  return out;
}

// Talk / Check / Open on A when something answers it; the item on B.
registerPrompt({ id: 'interact', order: 10, action: 'sword', label: () => findInteraction(player)?.label ?? null });
registerPrompt({ id: 'item', order: 50, action: 'item', label: () => selectedItem()?.name ?? null });
