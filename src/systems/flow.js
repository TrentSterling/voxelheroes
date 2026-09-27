// Game flow: starting, pausing, falling and getting back up, new game, load,
// and the test hook's teleport. Also registers the 'play' mode.
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

// M1 laid every area on one lattice of 16 x 11 screens (origins in screens)
// and its saves named places by that lattice: pos and respawn as { sx, sy,
// x, z, yaw }, flags and tile edits by global tile. The overworld is still
// where it was; the crypt has since moved to its dungeon columns and grown
// 16 x 12 rooms (its rows 0-10 kept their places).
const M1_AREAS = [
  { id: 'overworld', origin: [0, 0], size: [3, 2] },
  { id: 'crypt', origin: [0, 10], size: [2, 2] },
];

// The place of an M1 global point: { area, screen: [i, j], x, z } with x and
// z local to the screen, or null where M1 had nothing.
function m1Place(gx, gz) {
  const sx = Math.floor(gx / SCREEN_W);
  const sy = Math.floor(gz / SCREEN_H);
  for (const a of M1_AREAS) {
    const [i, j] = [sx - a.origin[0], sy - a.origin[1]];
    if (i >= 0 && j >= 0 && i < a.size[0] && j < a.size[1]) return { area: a.id, screen: [i, j], x: gx - sx * SCREEN_W, z: gz - sy * SCREEN_H };
  }
  return null;
}

// Turn an M1 spot ({ sx, sy, x, z, yaw }) into an area spot.
function normalizeSpot(p) {
  if (!p || p.area) return p ?? null;
  if (!Number.isFinite(p.sx) || !Number.isFinite(p.sy)) return null;
  const place = m1Place(p.sx * SCREEN_W + (p.x ?? SCREEN_W / 2), p.sy * SCREEN_H + (p.z ?? SCREEN_H / 2));
  return place ? { ...place, yaw: p.yaw ?? 0 } : null;
}

// An M1 save (its pos is { sx, sy, ... }) names tiles in flags and tile edits
// by M1 global tile: name them by place instead ('crypt:1,1:7,0'), which the
// load then puts on today's tiles (core/state.js). Other saves pass through.
function fromM1(data) {
  const f = data?.fields;
  if (!f || !Number.isFinite(f.pos?.sx) || !Number.isFinite(f.pos?.sy)) return data;
  const byPlace = (key) => {
    const [tx, tz] = key.split(',').map(Number);
    const p = m1Place(tx, tz);
    return p ? `${p.area}:${p.screen.join(',')}:${p.x},${p.z}` : key;
  };
  const fields = { ...f };
  if (Array.isArray(f.flags))
    fields.flags = f.flags.map((flag) => {
      const m = /^([\w-]+):(-?\d+,-?\d+)$/.exec(flag);
      return m ? `${m[1]}:${byPlace(m[2])}` : flag;
    });
  if (f.tileEdits && typeof f.tileEdits === 'object')
    fields.tileEdits = Object.fromEntries(Object.entries(f.tileEdits).map(([k, ch]) => [byPlace(k), ch]));
  return { ...data, fields };
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

// Where the hero gets back up after falling: the entrance of the area he fell
// in, if the area names one (a dungeon, gameplay spec 6.7 and 11), else the
// respawn point.
export function continuePoint() {
  const area = currentScreen()?.area;
  const entrance = area?.entrance ? { area: area.id, ...area.entrance } : null;
  return entrance && resolvePlace(entrance) ? entrance : respawnPoint();
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

// Load a slot and resume play there. false if the slot is empty or unreadable.
export function loadFromSlot(n) {
  const saved = readSlot(n);
  if (!saved?.data) return false;
  slot = n;
  loadGame(saved.data);
  return true;
}

// Apply save data (serializeState() output, or an M1 save) and resume play
// where it was made.
export function loadGame(data) {
  loadState(fromM1(data));
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
