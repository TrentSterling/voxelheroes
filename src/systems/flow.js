// Game flow: starting, pausing, falling and getting back up, new game, load,
// and the test hook's teleport. Also registers the 'play' mode.
import { GROUND_Y, SCREEN_W, SCREEN_H } from '../core/constants.js';
import { state, defineState, registerSaveField, resetState, loadState, serializeState } from '../core/state.js';
import { writeSlot, readSlot } from '../core/save.js';
import { initAudio, sfx } from '../core/audio.js';
import { input } from '../core/input.js';
import { registerMode, setMode, pushMode, popMode } from '../core/modes.js';
import { world, currentScreen } from '../world/world.js';
import { START, getArea } from '../world/areas.js';
import { updateEntities } from '../entities/manager.js';
import { updateItems } from '../items/inventory.js';
import { player } from '../entities/player.js';
import { hideOverlay, setFade } from '../ui/overlay.js';
import { setAreaLabel } from '../ui/hud.js';
import { placeAt, applyScreenAmbience, clearScreen, enterScreen } from './transitions.js';

// Where the hero gets back up after falling: { sx, sy, x, z, yaw } (global
// screen, local tile coords), or null for the start screen. An inn sets it.
defineState('respawn', () => null);

// The hero's position, so a save resumes where it was made.
let loadedPos = null;
registerSaveField('pos', {
  save: () => ({ sx: state.sx, sy: state.sy, x: player.x - state.sx * SCREEN_W, z: player.z - state.sy * SCREEN_H, yaw: player.yaw }),
  load: (v) => {
    loadedPos = v;
  },
  reset: () => {
    loadedPos = null;
  },
});

export function startPoint() {
  const area = getArea(START.area);
  const [ox, oy] = area.origin ?? [0, 0];
  return { sx: ox + START.screen[0], sy: oy + START.screen[1], x: SCREEN_W / 2, z: SCREEN_H / 2, yaw: 0 };
}

export const respawnPoint = () => state.respawn ?? startPoint();

function placeAtPoint(p) {
  placeAt(p.sx, p.sy, p.x, p.z, p.yaw ?? 0);
  player.resetTileTracking();
}

export function placeAtStart() {
  placeAtPoint(startPoint());
}

function standUp() {
  player.hero.root.rotation.set(0, 0, 0);
  player.hero.root.position.y = GROUND_Y;
}

// Title -> play, or game over -> play at the respawn point with full health.
export function startGame() {
  initAudio();
  if (state.mode === 'dead') {
    state.hp = state.maxHp;
    clearScreen();
    placeAtPoint(respawnPoint());
    world.regrow(currentScreen());
    applyScreenAmbience(currentScreen());
    standUp();
  }
  hideOverlay();
  setMode('play');
  player.invT = 1;
  sfx.start();
  enterScreen();
}

export function pauseGame() {
  if (state.mode === 'play') pushMode('paused');
}

export function resumeGame() {
  if (state.mode === 'paused') popMode();
}

// Fresh state and world, hero at the start, back on the title screen.
export function newGame() {
  resetState();
  clearScreen();
  world.reset();
  placeAtStart();
  applyScreenAmbience(currentScreen());
  setAreaLabel(currentScreen().name);
  standUp();
  setMode('title');
}

// ---------------------------------------------------------------- save slots
// The slot this game was loaded from or last saved to. The inn and the pause
// menu save into it; the title screen's file select picks it.
let slot = 1;
export const activeSlot = () => slot;

// Write the game into a localStorage slot (core/save.js). false if storage is
// unavailable (private windows, sandboxed previews).
export function saveToSlot(n = slot) {
  slot = n;
  return writeSlot(n, serializeState());
}

// Load a slot and resume play there. false if the slot is empty or unreadable.
export function loadFromSlot(n) {
  const saved = readSlot(n);
  if (!saved?.data) return false;
  slot = n;
  loadGame(saved.data);
  return true;
}

// Apply save data (serializeState() output) and resume play where it was made.
export function loadGame(data) {
  loadState(data);
  clearScreen();
  world.reset();
  const p = loadedPos && world.screen(loadedPos.sx, loadedPos.sy) ? loadedPos : respawnPoint();
  placeAtPoint(p);
  state.hp = Math.max(1, state.hp);
  world.regrow(currentScreen());
  applyScreenAmbience(currentScreen());
  setAreaLabel(currentScreen().name);
  standUp();
  hideOverlay();
  setFade(0);
  setMode('play');
  enterScreen();
}

// ---------------------------------------------------------------- teleport
// target: 'crypt' (an area's first or start screen), 'crypt:0,1' (area-local
// screen), '1,0' (global screen), [1, 0], { area, screen: [x, y] }, or a
// screen name ('Key Vault'). x, z are local tile coordinates (default: the
// middle of the screen).
export function resolveScreen(target) {
  if (Array.isArray(target)) return world.screen(target[0], target[1]);
  if (target && typeof target === 'object') {
    if (target.area) {
      const area = getArea(target.area);
      if (!area) return null;
      const [ox, oy] = area.origin ?? [0, 0];
      return world.screen(ox + target.screen[0], oy + target.screen[1]);
    }
    return world.screen(target.sx, target.sy);
  }
  if (typeof target !== 'string') return null;
  const local = target.match(/^([\w-]+):(-?\d+),(-?\d+)$/);
  if (local) return resolveScreen({ area: local[1], screen: [+local[2], +local[3]] });
  const global = target.match(/^(-?\d+),(-?\d+)$/);
  if (global) return world.screen(+global[1], +global[2]);
  const area = getArea(target);
  if (area) {
    const key = area.start ? `${area.start[0]},${area.start[1]}` : Object.keys(area.screens)[0];
    const [lx, ly] = key.split(',').map(Number);
    return resolveScreen({ area: area.id, screen: [lx, ly] });
  }
  const name = target.toLowerCase();
  for (const s of world.screens.values()) if (s.name.toLowerCase() === name) return s;
  return null;
}

export function teleport(target, x = SCREEN_W / 2, z = SCREEN_H / 2, { yaw = player.yaw } = {}) {
  const screen = resolveScreen(target);
  if (!screen) throw new Error(`teleport: no screen matches ${JSON.stringify(target)}`);
  clearScreen();
  hideOverlay();
  setFade(0);
  placeAtPoint({ sx: screen.sx, sy: screen.sy, x, z, yaw });
  standUp();
  player.knockT = 0;
  world.regrow(screen);
  applyScreenAmbience(screen);
  setMode('play');
  enterScreen();
  return screen;
}

// ---------------------------------------------------------------- play mode
registerMode('play', {
  update(dt) {
    if (input.pressed('menu')) {
      pauseGame();
      return;
    }
    player.update(dt);
    updateItems(dt, player);
    updateEntities(dt);
  },
});
