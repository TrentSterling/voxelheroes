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

// Places are spots: { area, screen: [i, j], x, z, yaw } with the area's local
// screen and tile coordinates in that screen (world.resolveSpot), so they do
// not depend on where an area sits in the global grid.

// Where the hero gets back up after falling: a spot, or null for the start
// screen. An inn sets it.
defineState('respawn', () => null);

// The hero's position, so a save resumes where it was made.
let loadedPos = null;
registerSaveField('pos', {
  save: () => {
    const s = currentScreen();
    return s ? { area: s.area.id, screen: [s.lx, s.ly], x: player.x - s.x0, z: player.z - s.z0, yaw: player.yaw } : null;
  },
  load: (v) => {
    loadedPos = v;
  },
  reset: () => {
    loadedPos = null;
  },
});

export const startPoint = () => ({ yaw: 0, ...START });

// M1 saves held { sx, sy, x, z, yaw }: a global screen of the one 16 x 11
// lattice of that time. Turn such a spot into an area spot, if a screen is
// still there.
function normalizeSpot(p) {
  if (!p || p.area) return p ?? null;
  if (!Number.isFinite(p.sx) || !Number.isFinite(p.sy)) return null;
  const gx = p.sx * SCREEN_W + (p.x ?? SCREEN_W / 2);
  const gz = p.sy * SCREEN_H + (p.z ?? SCREEN_H / 2);
  const s = world.screenAt(gx, gz);
  return s ? { area: s.area.id, screen: [s.lx, s.ly], x: gx - s.x0, z: gz - s.z0, yaw: p.yaw ?? 0 } : null;
}

// A spot resolved to { screen, x, z, yaw }, or null if it names nothing that exists.
export function resolvePlace(p) {
  const spot = normalizeSpot(p);
  if (!spot) return null;
  try {
    return world.resolveSpot(spot);
  } catch {
    return null;
  }
}

export const respawnPoint = () => (resolvePlace(state.respawn) ? state.respawn : startPoint());

// The screen the hero gets back up on.
export const respawnScreen = () => resolvePlace(respawnPoint())?.screen ?? null;

function placeAtPoint(p) {
  const dest = resolvePlace(p) ?? world.resolveSpot(startPoint());
  placeAt(dest.screen, dest.x, dest.z, dest.yaw);
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
  const via = state.mode === 'dead' ? 'respawn' : 'start';
  hideOverlay();
  setMode('play');
  player.invT = 1;
  sfx.start();
  enterScreen(via);
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
  placeAtPoint(resolvePlace(loadedPos) ? loadedPos : respawnPoint());
  state.hp = Math.max(1, state.hp);
  world.regrow(currentScreen());
  applyScreenAmbience(currentScreen());
  setAreaLabel(currentScreen().name);
  standUp();
  hideOverlay();
  setFade(0);
  setMode('play');
  enterScreen('load');
}

// ---------------------------------------------------------------- teleport
// target: 'crypt' (an area's start screen, else its first), 'crypt:0,1'
// (area-local screen, the same as the screen's key), { area, screen: [i, j] },
// a screen name ('Key Vault', any case), or, as in M1, a global screen of the
// default 16 x 11 lattice ('1,0', [1, 0], { sx, sy }), which is the
// overworld's. x, z are local tile coordinates (default: the middle of the
// screen).
export function resolveScreen(target) {
  if (Array.isArray(target)) return defaultLatticeScreen(target[0], target[1]);
  if (target && typeof target === 'object') {
    if (target.area) return world.screen(target.area, target.screen?.[0] ?? 0, target.screen?.[1] ?? 0);
    return defaultLatticeScreen(target.sx, target.sy);
  }
  if (typeof target !== 'string') return null;
  const local = target.match(/^([\w-]+):(-?\d+),(-?\d+)$/);
  if (local) return world.screen(local[1], +local[2], +local[3]);
  const global = target.match(/^(-?\d+),(-?\d+)$/);
  if (global) return defaultLatticeScreen(+global[1], +global[2]);
  const area = getArea(target);
  if (area) {
    const key = area.start ? `${area.start[0]},${area.start[1]}` : Object.keys(area.screens)[0];
    const [lx, ly] = key.split(',').map(Number);
    return world.screen(area.id, lx, ly);
  }
  const name = target.toLowerCase();
  for (const s of world.screens.values()) if (s.name?.toLowerCase() === name) return s;
  return null;
}

const defaultLatticeScreen = (sx, sy) =>
  Number.isFinite(sx) && Number.isFinite(sy) ? world.screenAt(sx * SCREEN_W, sy * SCREEN_H) : null;

export function teleport(target, x, z, { yaw = player.yaw } = {}) {
  const screen = resolveScreen(target);
  if (!screen) throw new Error(`teleport: no screen matches ${JSON.stringify(target)}`);
  clearScreen();
  hideOverlay();
  setFade(0);
  placeAt(screen, x ?? screen.w / 2, z ?? screen.h / 2, yaw);
  player.resetTileTracking();
  standUp();
  player.knockT = 0;
  world.regrow(screen);
  applyScreenAmbience(screen);
  setMode('play');
  enterScreen('teleport');
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
