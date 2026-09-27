// Keyboard and touch input, read as named actions.
//
//   input.move()            -> { x, z, len } from WASD/arrows plus the touch stick
//   input.held('sword')     -> button is down right now
//   input.pressed('sword')  -> went down since the last simulation tick
//   input.released('sword') -> went up since the last simulation tick
//   input.consume('sword')  -> mark a press as handled so later code ignores it
//
// Presses and releases are latched until the end of the next tick (endFrame),
// so a tap between two frames is seen exactly once, including when tests step
// the simulation by hand. Changing mode clears them (clearPresses) so one
// press never acts in two modes; input.carry(action) re-presses an action on
// the next tick (modes.js uses it to carry A and B through screen slides and
// warps). Held + pressed + released is enough to build charge attacks: start
// charging on pressed, fire on released.
//
// Actions: sword (A), item (B), menu (Start), confirm, cancel, next-item,
// prev-item, mute, up/down/left/right. Rebind with input.bind().

export const BINDINGS = {
  sword: ['Space', 'KeyJ', 'KeyZ'],
  item: ['KeyK', 'KeyX'],
  menu: ['Enter', 'Escape', 'KeyP'],
  confirm: ['Enter', 'Space'],
  cancel: ['Escape', 'Backspace'],
  'next-item': ['KeyE'],
  'prev-item': ['KeyQ'],
  mute: ['KeyM'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
};

// Keys whose browser default (scrolling) is suppressed.
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

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
const virtualHeld = new Map(); // action -> number of virtual sources holding it
const pressedSet = new Set();
const releasedSet = new Set();
const carriedSet = new Set(); // pressed again on the next tick (carry)
const stick = { x: 0, z: 0 }; // touch stick or a test's virtual stick
const gestureHandlers = [];

function actionHeld(action) {
  if (virtualHeld.get(action) > 0) return true;
  const codes = BINDINGS[action];
  if (codes) for (const c of codes) if (keysDown.has(c)) return true;
  return false;
}

export const input = {
  move() {
    let x = stick.x;
    let z = stick.z;
    if (actionHeld('left')) x -= 1;
    if (actionHeld('right')) x += 1;
    if (actionHeld('up')) z -= 1;
    if (actionHeld('down')) z += 1;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z, len: Math.min(1, len) };
  },
  held: actionHeld,
  pressed: (action) => pressedSet.has(action),
  released: (action) => releasedSet.has(action),
  consume(action) {
    pressedSet.delete(action);
  },
  // Called once at the end of every simulation tick.
  endFrame() {
    pressedSet.clear();
    releasedSet.clear();
    for (const a of carriedSet) pressedSet.add(a);
    carriedSet.clear();
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
    stick.x = stick.z = 0;
  },

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

  bind(action, codes) {
    BINDINGS[action] = [...codes];
    indexBindings();
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
  const actions = codeActions.get(e.code);
  keysDown.add(e.code);
  if (e.repeat || !actions) return;
  for (const a of actions) pressedSet.add(a);
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
    const dead = len < 8 ? 0 : 1;
    stick.x = ((dx * k) / RADIUS) * dead;
    stick.z = ((dy * k) / RADIUS) * dead;
  };
  stickEl.addEventListener('pointerdown', (e) => {
    id = e.pointerId;
    stickEl.setPointerCapture(id);
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
    knob.style.transform = '';
  };
  stickEl.addEventListener('pointerup', end);
  stickEl.addEventListener('pointercancel', end);

  // Each button holds its action while pressed.
  for (const [elId, action] of [
    ['btn-a', 'sword'],
    ['btn-b', 'item'],
    ['btn-start', 'menu'],
  ]) {
    const el = $(elId);
    if (!el) continue;
    let down = false;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
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
  window.addEventListener('pointerdown', gesture);
  bindTouch();
}
