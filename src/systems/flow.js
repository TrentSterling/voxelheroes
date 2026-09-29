// Game flow: starting, pausing, falling and getting back up, new game, load,
// and the test hook's teleport. Also registers the 'play' mode and its hooks.
import { GROUND_Y, SCREEN_W, SCREEN_H } from '../core/constants.js';
import { state, defineState, registerSaveField, resetState, loadState, serializeState } from '../core/state.js';
import { writeSlot, readSlot } from '../core/save.js';
import { initAudio, sfx } from '../core/audio.js';
import { input } from '../core/input.js';
import { registerMode, setMode, pushMode, popMode } from '../core/modes.js';
import { world, currentScreen } from '../world/world.js';
import { START, getArea, areaStart } from '../world/areas.js';
import { updateEntities } from '../entities/manager.js';
import { updateItems } from '../items/inventory.js';
import { player } from '../entities/player.js';
import { hideOverlay, setFade } from '../ui/overlay.js';
import { setAreaLabel } from '../ui/hud.js';
import { placeAt, applyScreenAmbience, clearScreen, enterScreen } from './transitions.js';
import { areaEntrance } from '../game/places.js';

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

// A spot resolved to { screen, x, z, yaw }, or null if it names nothing that
// exists. (Saves of the M1 layout have their spots converted on load:
// SAVE_MIGRATIONS in core/state.js.)
export function resolvePlace(p) {
  if (!p || typeof p !== 'object' || !p.area) return null;
  try {
    return world.resolveSpot(p);
  } catch {
    return null;
  }
}

export const respawnPoint = () => (resolvePlace(state.respawn) ? state.respawn : startPoint());

// Where the hero gets back up after falling: the entrance of the area he fell
// in, if it names one (a dungeon, gameplay spec 6.7 and 11); else wherever he
// walked into that area this session (game/places.js areaEntrance, an
// overworld area names no entrance of its own); else the respawn point
// (an inn, or the prologue's, if neither of those has anything yet).
export function continuePoint() {
  const area = currentScreen()?.area;
  const entrance = area?.entrance ? { area: area.id, ...area.entrance } : null;
  if (entrance && resolvePlace(entrance)) return entrance;
  const here = area ? areaEntrance(area.id) : null;
  if (here && resolvePlace(here)) return here;
  return respawnPoint();
}

// The screen the hero gets back up on.
export const continueScreen = () => resolvePlace(continuePoint())?.screen ?? null;
export const respawnScreen = continueScreen; // (the M1 name)

function placeAtPoint(p) {
  const dest = resolvePlace(p) ?? world.resolveSpot(startPoint());
  placeAt(dest.screen, dest.x, dest.z, dest.yaw);
  player.resetTileTracking();
}

export function placeAtStart() {
  placeAtPoint(startPoint());
}

// Back on his feet, still: no knockback left over from the hit that felled
// him (M1 let it carry over, so he slid after "Try again").
function standUp() {
  player.hero.root.rotation.set(0, 0, 0);
  player.hero.root.position.y = GROUND_Y;
  player.knockT = 0;
}

// Title -> play, or game over -> play with full health at the entrance of
// the dungeon the hero fell in, or else at the respawn point.
export function startGame() {
  initAudio();
  if (state.mode === 'dead') {
    state.hp = state.maxHp;
    clearScreen();
    placeAtPoint(continuePoint());
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

// Load a slot and resume play there. false if the slot is empty, unreadable
// or rejected (made by a newer version, damaged); the running game is then
// left as it was.
export function loadFromSlot(n) {
  const saved = readSlot(n);
  if (!saved?.data) return false;
  try {
    loadGame(saved.data);
  } catch (e) {
    console.warn(`loadFromSlot(${n}): ${e.message}`);
    return false;
  }
  slot = n;
  return true;
}

// Apply save data (serializeState() output, or an older save, which
// loadState upgrades: an M1 save's position, crypt flags and tile edits land
// on today's crypt, core/state.js) and resume play where it was made. Throws
// before touching the running game if the data is rejected.
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
// overworld's. x, z are local tile coordinates; without them the hero stands
// in the middle of the screen, or on the free tile nearest it (not in a chest
// or a wall, not on a warp).
export function resolveScreen(target) {
  if (Array.isArray(target)) return defaultLatticeScreen(target[0], target[1]);
  if (target && typeof target === 'object') {
    if (target.area) {
      const area = getArea(target.area);
      return area ? world.screen(area.id, ...(target.screen ?? areaStart(area))) : null;
    }
    return defaultLatticeScreen(target.sx, target.sy);
  }
  if (typeof target !== 'string') return null;
  const local = target.match(/^([\w-]+):(-?\d+),(-?\d+)$/);
  if (local) return world.screen(local[1], +local[2], +local[3]);
  const global = target.match(/^(-?\d+),(-?\d+)$/);
  if (global) return defaultLatticeScreen(+global[1], +global[2]);
  const area = getArea(target);
  if (area) return world.screen(area.id, ...areaStart(area));
  const name = target.toLowerCase();
  for (const s of world.screens.values()) if (s.name?.toLowerCase() === name) return s;
  return null;
}

const defaultLatticeScreen = (sx, sy) =>
  Number.isFinite(sx) && Number.isFinite(sy) ? world.screenAt(sx * SCREEN_W, sy * SCREEN_H) : null;

export function teleport(target, x, z, { yaw = player.yaw } = {}) {
  const screen = resolveScreen(target);
  if (!screen) throw new Error(`teleport: no screen matches ${JSON.stringify(target)}`);
  const spot = x === undefined && z === undefined ? world.freeSpot(screen, screen.w / 2, screen.h / 2, player.r) : null;
  clearScreen();
  hideOverlay();
  setFade(0);
  placeAt(screen, x ?? spot?.x ?? screen.w / 2, z ?? spot?.z ?? screen.h / 2, yaw);
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
// Features that need a say in every play tick register a hook instead of
// editing this file or player.js:
//
//   registerPlayHook({ id: 'map', phase: 'input', update() { if (input.pressed('map')) pushMode('map'); } });
//   registerPlayHook({ id: 'carry', phase: 'input', order: 10, update(dt) { if (carrying && input.pressed('sword')) { throwIt(); input.consume('sword'); } } });
//   registerPlayHook({ id: 'boss-music', phase: 'after', update(dt) { ... } });
//
// 'input' hooks run after the Start check and before the hero moves: they may
// consume presses (input.consume) so the hero never sees them, or change the
// mode (pushMode), which ends the tick. 'after' hooks run once the hero, the
// items and the entities have moved. Within a phase, lower `order` (default
// 50) runs first, then by id, so load order never matters.
const playHooks = { input: [], after: [] };

export function registerPlayHook({ id, phase = 'after', order = 50, update }) {
  if (!id) throw new Error('registerPlayHook: a hook needs an id');
  if (!playHooks[phase]) throw new Error(`Play hook "${id}": phase must be 'input' or 'after', not "${phase}"`);
  if (typeof update !== 'function') throw new Error(`Play hook "${id}" needs update(dt)`);
  if ([...playHooks.input, ...playHooks.after].some((h) => h.id === id)) throw new Error(`Play hook "${id}" is already registered`);
  playHooks[phase].push({ id, order, update });
  playHooks[phase].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

registerMode('play', {
  update(dt) {
    if (input.pressed('menu')) {
      pauseGame();
      return;
    }
    for (const h of playHooks.input) {
      h.update(dt);
      if (state.mode !== 'play') return;
    }
    player.update(dt);
    updateItems(dt, player);
    updateEntities(dt);
    for (const h of playHooks.after) h.update(dt);
  },
});
