// Keyboard, gamepad and touch input, read as named actions.
//
//   input.move()            -> { x, z, len } from keys, d-pad, sticks (touch, gamepad, tests)
//   input.move8()           -> { x, z, dir } snapped to 8 directions (dir 0 north, clockwise; -1 none)
//   input.held('guard')     -> button is down right now
//   input.pressed('sword')  -> went down since the last simulation tick
//   input.released('sword') -> went up since the last simulation tick
//   input.consume('sword')  -> mark a press as handled so later code ignores it
//   input.lastDevice()      -> 'keyboard' | 'gamepad' | 'touch' (for button prompts)
//
// Presses and releases are latched until the end of the next tick (endFrame),
// so a tap between two frames is seen exactly once, including when tests step
// the simulation by hand. Changing mode clears them (clearPresses) so one
// press never acts in two modes; input.carry(action) re-presses an action on
// the next tick (modes.js uses it to carry A and B through screen slides and
// warps). Held + pressed + released is enough for hold actions (guard, a
// hold-to-dash option): act on pressed, keep going while held, stop on
// released.
//
// Default bindings follow the gameplay spec (section 7.1). In play every key
// means one action; in menus confirm, cancel, the directions and item
// cycling are read. Some keys mean one thing in play and another in menus
// (J confirms in a menu and thrusts in play); menus read confirm and cancel
// before menu, so Enter confirms inside a menu and Start/Esc/P close it only
// when neither fired. input.clashes() lists any key bound twice in one
// context (the contracts-m2 play-test requires none).
//
// Gamepads use the standard mapping (the Gamepad API's 'standard' layout) and
// are polled once per tick, the first time anything reads input. The left
// stick and the touch stick have a radial dead zone (TUNING.hero.deadzone).

import { TUNING } from './tuning.js';

// Actions and where they are read. docs/CONTRACTS.md ("Input") explains each.
export const ACTIONS = {
  play: ['up', 'down', 'left', 'right', 'sword', 'item', 'dash', 'guard', 'map', 'inventory', 'prev-item', 'next-item', 'menu', 'mute'],
  menu: ['up', 'down', 'left', 'right', 'confirm', 'cancel', 'prev-item', 'next-item'],
};

// Keyboard: KeyboardEvent.code values.
const DEFAULT_KEYS = {
  sword: ['KeyJ', 'KeyZ'],
  item: ['KeyK', 'KeyX'],
  dash: ['Space'],
  guard: ['ShiftLeft', 'ShiftRight'],
  map: ['KeyM'],
  inventory: ['Tab'],
  'prev-item': ['KeyQ'],
  'next-item': ['KeyE'],
  menu: ['Enter', 'Escape', 'KeyP'],
  confirm: ['KeyJ', 'KeyZ', 'Enter', 'Space'],
  cancel: ['KeyK', 'KeyX', 'Escape', 'Backspace'],
  mute: ['KeyN'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
};

// Gamepad, standard mapping button indices: 0 A (bottom), 1 B (right),
// 2 X (left), 3 Y (top), 4 LB, 5 RB, 6 LT, 7 RT, 8 Back, 9 Start,
// 12-15 d-pad up, down, left, right. Axes 0 and 1 are the left stick.
const DEFAULT_PAD = {
  sword: [0],
  item: [1],
  dash: [2],
  inventory: [3],
  map: [4],
  guard: [5],
  'prev-item': [6],
  'next-item': [7],
  menu: [9],
  confirm: [0],
  cancel: [1],
  up: [12],
  down: [13],
  left: [14],
  right: [15],
};

// Touch buttons (element id in index.html -> action). The stick is #stick.
// Tapping the HUD item slot cycles items (the ui stream wires that tap to
// input.tap('next-item')).
export const TOUCH_BUTTONS = {
  'btn-a': 'sword',
  'btn-b': 'item',
  'btn-dash': 'dash',
  'btn-guard': 'guard',
  'btn-map': 'map',
  'btn-inv': 'inventory',
  'btn-start': 'menu',
};

const copy = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v]]));

export const BINDINGS = copy(DEFAULT_KEYS);
export const PAD_BINDINGS = copy(DEFAULT_PAD);

// Keys whose browser default (scrolling, focus moves) is suppressed.
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

const codeActions = new Map(); // KeyboardEvent.code -> [action]
function indexBindings() {
  codeActions.clear();
  for (const [action, codes] of Object.entries(BINDINGS))
    for (const code of codes) {
      if (!codeActions.has(code)) codeActions.set(code, []);
      codeActions.get(code).push(action);
    }
}
indexBindings();

const keysDown = new Set(); // codes currently held
const virtualHeld = new Map(); // action -> number of virtual sources holding it (touch, tests)
const pressedSet = new Set();
const releasedSet = new Set();
const carriedSet = new Set(); // pressed again on the next tick (carry)
const stick = { x: 0, z: 0 }; // touch stick or a test's virtual stick
const gestureHandlers = [];
let device = 'keyboard';

// ---------------------------------------------------------------- gamepad
const browserPads = () => (typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()] : []);
let padSource = browserPads;
let padHeld = new Set(); // actions the pad holds this tick
const padStick = { x: 0, z: 0 };
let polled = false;

function deadzone(x, z) {
  const len = Math.hypot(x, z);
  const dz = TUNING.hero.deadzone;
  if (len < dz) return { x: 0, z: 0 };
  // rescale so the stick reaches full speed at the rim and starts at 0 past the dead zone
  const k = Math.min(1, (len - dz) / (1 - dz)) / len;
  return { x: x * k, z: z * k };
}

function pollPads() {
  if (polled) return;
  polled = true;
  let pads = [];
  try {
    pads = padSource() ?? [];
  } catch {
    pads = [];
  }
  const pad = pads.find((p) => p && p.connected !== false && p.buttons?.length);
  const now = new Set();
  padStick.x = padStick.z = 0;
  if (pad) {
    for (const [action, buttons] of Object.entries(PAD_BINDINGS))
      for (const i of buttons) {
        const b = pad.buttons[i];
        if (b && (b.pressed || b.value > 0.5)) now.add(action);
      }
    const s = deadzone(pad.axes?.[0] ?? 0, pad.axes?.[1] ?? 0);
    padStick.x = s.x;
    padStick.z = s.z;
    if (now.size || s.x || s.z) device = 'gamepad';
  }
  const was = padHeld;
  padHeld = now;
  for (const a of now) if (!was.has(a) && !heldByOthers(a)) pressedSet.add(a);
  for (const a of was) if (!now.has(a) && !actionHeld(a)) releasedSet.add(a);
}

// ---------------------------------------------------------------- state
function heldByOthers(action) {
  if (virtualHeld.get(action) > 0) return true;
  const codes = BINDINGS[action];
  if (codes) for (const c of codes) if (keysDown.has(c)) return true;
  return false;
}

function actionHeld(action) {
  return heldByOthers(action) || padHeld.has(action);
}

function rawMove() {
  pollPads();
  let x = stick.x + padStick.x;
  let z = stick.z + padStick.z;
  if (actionHeld('left')) x -= 1;
  if (actionHeld('right')) x += 1;
  if (actionHeld('up')) z -= 1;
  if (actionHeld('down')) z += 1;
  return { x, z };
}

export const input = {
  move() {
    let { x, z } = rawMove();
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z, len: Math.min(1, len) };
  },
  // Eight-way movement: a unit vector along one of 8 directions, or zero.
  // dir: 0 north (-z), 1 north-east, 2 east, ... 7 north-west; -1 when idle.
  move8() {
    const { x, z } = rawMove();
    if (Math.hypot(x, z) < 1e-6) return { x: 0, z: 0, dir: -1 };
    const dir = (Math.round(Math.atan2(x, -z) / (Math.PI / 4)) + 8) % 8;
    const a = (dir * Math.PI) / 4;
    const s = Math.round(Math.sin(a) * 1e6) / 1e6;
    const c = Math.round(Math.cos(a) * 1e6) / 1e6;
    const n = Math.hypot(s, c);
    return { x: s / n, z: -c / n, dir };
  },
  held(action) {
    pollPads();
    return actionHeld(action);
  },
  pressed(action) {
    pollPads();
    return pressedSet.has(action);
  },
  released(action) {
    pollPads();
    return releasedSet.has(action);
  },
  consume(action) {
    pressedSet.delete(action);
  },
  // Called once at the end of every simulation tick.
  endFrame() {
    pressedSet.clear();
    releasedSet.clear();
    for (const a of carriedSet) pressedSet.add(a);
    carriedSet.clear();
    polled = false;
  },
  // Forget latched presses and releases (and carried presses).
  clearPresses() {
    pressedSet.clear();
    releasedSet.clear();
    carriedSet.clear();
  },
  // Report `action` as pressed again on the next tick.
  carry(action) {
    carriedSet.add(action);
  },
  releaseAll() {
    keysDown.clear();
    virtualHeld.clear();
    padHeld = new Set();
    stick.x = stick.z = 0;
  },
  lastDevice: () => device,

  // Virtual controls, used by the touch buttons and by play-tests.
  setStick(x, z) {
    stick.x = x;
    stick.z = z;
  },
  down(action) {
    const n = virtualHeld.get(action) || 0;
    if (n === 0 && !actionHeld(action)) pressedSet.add(action);
    virtualHeld.set(action, n + 1);
  },
  up(action) {
    const n = virtualHeld.get(action) || 0;
    if (n <= 0) return;
    virtualHeld.set(action, n - 1);
    if (!actionHeld(action)) releasedSet.add(action);
  },
  tap(action) {
    pressedSet.add(action);
    releasedSet.add(action);
  },

  // Rebinding. bind('map', ['KeyG']) replaces the keys of one action;
  // bindPad('map', [8]) its gamepad buttons; resetBindings() restores the
  // defaults. bindings() returns a copy of everything, for an options menu.
  bind(action, codes) {
    BINDINGS[action] = [...codes];
    indexBindings();
  },
  bindPad(action, buttons) {
    PAD_BINDINGS[action] = [...buttons];
  },
  resetBindings() {
    for (const k of Object.keys(BINDINGS)) delete BINDINGS[k];
    for (const k of Object.keys(PAD_BINDINGS)) delete PAD_BINDINGS[k];
    Object.assign(BINDINGS, copy(DEFAULT_KEYS));
    Object.assign(PAD_BINDINGS, copy(DEFAULT_PAD));
    indexBindings();
  },
  bindings: () => ({ keys: copy(BINDINGS), pad: copy(PAD_BINDINGS), touch: { ...TOUCH_BUTTONS }, actions: copy(ACTIONS) }),
  // Keys or buttons bound to two actions of one context: [{ context, device, code, actions }].
  clashes() {
    const out = [];
    for (const [context, list] of Object.entries(ACTIONS))
      for (const [dev, table] of [
        ['keyboard', BINDINGS],
        ['gamepad', PAD_BINDINGS],
      ]) {
        const seen = new Map();
        for (const a of list) for (const c of table[a] ?? []) seen.set(c, [...(seen.get(c) ?? []), a]);
        for (const [code, actions] of seen) if (actions.length > 1) out.push({ context, device: dev, code, actions });
      }
    return out;
  },
  // Replace where gamepads are read from (tests pass fake pads):
  // setPadSource(() => [{ buttons: [{ pressed: true }], axes: [0, 0] }]). null restores the browser's.
  setPadSource(fn) {
    padSource = fn ?? browserPads;
    polled = false;
  },
  // fn runs on every key press and pointer press (used to unlock audio).
  onGesture(fn) {
    gestureHandlers.push(fn);
  },
};

function gesture() {
  for (const fn of gestureHandlers) fn();
}

function onKeyDown(e) {
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  gesture();
  device = 'keyboard';
  const actions = codeActions.get(e.code);
  const wasHeld = actions ? actions.map((a) => actionHeld(a)) : [];
  keysDown.add(e.code);
  if (e.repeat || !actions) return;
  actions.forEach((a, i) => {
    if (!wasHeld[i]) pressedSet.add(a);
  });
}

function onKeyUp(e) {
  keysDown.delete(e.code);
  const actions = codeActions.get(e.code);
  if (!actions) return;
  for (const a of actions) if (!actionHeld(a)) releasedSet.add(a);
}

// Touch: a virtual stick on the left and round buttons on the right.
function bindTouch() {
  const $ = (id) => document.getElementById(id);
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const pad = $('touch');
  if (!pad) return;
  if (coarse) pad.hidden = false;

  const stickEl = $('stick');
  const knob = $('knob');
  let id = null;
  let cx = 0;
  let cy = 0;
  const RADIUS = 44;
  const move = (e) => {
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    const k = len > RADIUS ? RADIUS / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    const s = deadzone((dx * k) / RADIUS, (dy * k) / RADIUS);
    stick.x = s.x;
    stick.z = s.z;
  };
  if (stickEl) {
    stickEl.addEventListener('pointerdown', (e) => {
      device = 'touch';
      id = e.pointerId;
      stickEl.setPointerCapture?.(id);
      const r = stickEl.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      move(e);
    });
    stickEl.addEventListener('pointermove', (e) => e.pointerId === id && move(e));
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      stick.x = stick.z = 0;
      if (knob) knob.style.transform = '';
    };
    stickEl.addEventListener('pointerup', end);
    stickEl.addEventListener('pointercancel', end);
  }

  // Each button holds its action while pressed.
  for (const [elId, action] of Object.entries(TOUCH_BUTTONS)) {
    const el = $(elId);
    if (!el) continue;
    let down = false;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      device = 'touch';
      if (down) return;
      down = true;
      input.down(action);
    });
    const lift = () => {
      if (!down) return;
      down = false;
      input.up(action);
    };
    el.addEventListener('pointerup', lift);
    el.addEventListener('pointercancel', lift);
    el.addEventListener('pointerleave', lift);
  }
}

export function initInput() {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    for (const code of [...keysDown]) onKeyUp({ code });
  });
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') device = 'touch';
    gesture();
  });
  bindTouch();
}
