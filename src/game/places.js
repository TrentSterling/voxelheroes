// Places: spots, the respawn point, where the hero has been, and the room
// entry point. A spot names a place independently of where an area sits in
// the global grid (world.resolveSpot):
//
//   { area: 'crypt', screen: [0, 1], x: 8, z: 8.4, yaw: Math.PI }   (x, z: local tiles)
//
//   spotHere()                     the hero's spot now
//   goToSpot(spot, { fade })       fade: a warp (fade out, move, fade in); else at once
//   setRespawn(spot)               where the hero gets back up (an inn, a bedroll)
//   respawnSpot('death' | 'load', { area })
//                                  where he gets up: respawn rules first (a dungeon's
//                                  entrance after dying, or saving, inside it), then
//                                  state.respawn, then the start. area: where he
//                                  fell or saved (default: the current area)
//   registerRespawnRule(id, fn)    fn({ reason, area }) -> spot or null
//   roomEntry()                    where the hero came into the current screen
//                                  (pits send him back there)
//   screenRect(screen), screenId(screen), currentRect()
//   registerPlace({ id, name, kind, spot, area })   a named place: village, inn, castle, dungeon, ...
//   places(kind), getPlace(id), placeVisited(id), warpPlaces(kinds)   (the warp feather's list)
//   areaKind(area)                 'overworld' | 'town' | 'castle' | 'interior' | 'cave' | 'dungeon' | 'arena' | 'test'
//
// Screens carry their own rect (x0, z0, x1, z1) and size (w, h), which
// differ between areas. state.visited / state.visitedAreas record every
// screen and area entered ('screen-visited' the first time); the world map
// and the dungeon map read them.
import { state } from '../core/state.js';
import { on, emit } from '../core/events.js';
import { world, currentScreen } from '../world/world.js';
import { getArea, START } from '../world/areas.js';
import { player } from '../entities/player.js';
import { teleport } from '../systems/flow.js';
import { startWarp, chooseCameraPreset } from '../systems/transitions.js';
import { registerSettingApplier } from './settings.js';
import './fields.js';

// ---------------------------------------------------------------- screens
export function screenRect(screen) {
  if (!screen) return null;
  const { x0, z0, x1, z1, w, h } = screen;
  return { x0, z0, x1, z1, w, h };
}

export const currentRect = () => screenRect(currentScreen());

// 'area:i,j' (the screen's key).
export const screenId = (screen) => (screen ? `${screen.area.id}:${screen.lx},${screen.ly}` : null);

// The screen's rect as moveBody bounds ({ x0 .. z1 }; x and z repeat x0 and
// z0 for code written against M1's origin form).
export function bodyBounds(screen = currentScreen()) {
  const r = screenRect(screen);
  return r ? { x: r.x0, z: r.z0, ...r } : null;
}

// ---------------------------------------------------------------- spots
export function spotHere() {
  const s = currentScreen();
  if (!s) return null;
  return { area: s.area.id, screen: [s.lx, s.ly], x: player.x - s.x0, z: player.z - s.z0, yaw: player.yaw };
}

// spot -> { screen, x, z, yaw } (x, z local), or null if it names nothing.
export function resolveSpot(spot) {
  if (!spot?.area) return null;
  try {
    return world.resolveSpot(spot);
  } catch {
    return null;
  }
}

// A spot with every field filled in (screen, x, z, yaw).
export function fullSpot(spot) {
  const r = resolveSpot(spot);
  return r ? { area: r.screen.area.id, screen: [r.screen.lx, r.screen.ly], x: r.x, z: r.z, yaw: r.yaw } : null;
}

export const startSpot = () => fullSpot({ yaw: 0, ...START });

// Move the hero to a spot. fade: through the warp mode (fade out and in,
// 'warp' event); otherwise at once (a teleport; the screen is entered with
// via 'teleport'). Returns false if the spot names nothing.
export function goToSpot(spot, { fade = true } = {}) {
  const r = resolveSpot(spot);
  if (!r) return false;
  if (fade) {
    startWarp(r);
  } else {
    teleport({ area: r.screen.area.id, screen: [r.screen.lx, r.screen.ly] }, r.x, r.z, { yaw: r.yaw });
  }
  return true;
}

// ---------------------------------------------------------------- respawn
// state.respawn (declared in systems/flow.js) holds a spot (an M1 save's
// { sx, sy } point is converted when it loads: SAVE_MIGRATIONS in
// core/state.js). These fill a spot in, or give null for one that names
// nothing.
export const toFlowSpot = (spot) => fullSpot(spot);
export const fromFlowSpot = (p) => fullSpot(p);

export function setRespawn(spot) {
  const p = toFlowSpot(spot);
  if (!p) return false;
  state.respawn = p;
  return true;
}

const respawnRules = [];

export function registerRespawnRule(id, fn) {
  if (respawnRules.some((r) => r.id === id)) throw new Error(`Respawn rule "${id}" is already registered`);
  respawnRules.push({ id, fn });
}

export function respawnSpot(reason = 'death', { area = currentScreen()?.area?.id ?? null } = {}) {
  for (const r of respawnRules) {
    const spot = r.fn({ reason, area });
    if (spot && resolveSpot(spot)) return fullSpot(spot);
  }
  return fromFlowSpot(state.respawn) ?? startSpot();
}

// Until the game flow (systems/flow.js, ui in M2) asks respawnSpot() itself,
// a rule's answer is put into state.respawn while the game-over screen is up
// and the inn's respawn is put back once the hero stands again.
let stash = null;
on('player-died', () => {
  const spot = respawnSpot('death');
  const now = fromFlowSpot(state.respawn);
  if (!spot || (now && JSON.stringify(now) === JSON.stringify(spot))) return;
  stash = { before: state.respawn, set: toFlowSpot(spot) };
  state.respawn = stash.set;
});
on('mode-change', ({ from }) => {
  if (from !== 'dead' || !stash) return;
  if (state.respawn === stash.set) state.respawn = stash.before;
  stash = null;
});

// ---------------------------------------------------------------- named places
// Villages, inns, the castle, the cabin, the trader and dungeon entrances,
// registered by the stream that builds them (overworld; dungeon for its
// entrances) so the warp feather (items), the world map (ui) and the inns
// find them without knowing each other's ids:
//
//   registerPlace({ id: 'v1', name: 'Millbrook', kind: 'village',
//                   spot: { area: 'v1', screen: [1, 2], x: 8, z: 9, yaw: 0 } })   where a warp lands
//   registerPlace({ id: 'd1', name: '...', kind: 'dungeon', area: 'd1', spot: <outside its door> })
//
// `area` is the area whose first visit makes the place known (default: the
// spot's area; a dungeon's is its own first area, while its spot is outside
// the door). placeVisited(id) is true once that area is in state.visitedAreas.
export const PLACE_KINDS = ['village', 'inn', 'castle', 'cabin', 'trader', 'dungeon', 'cave', 'other'];
export const WARP_KINDS = ['village', 'inn', 'dungeon']; // gameplay spec 9.3: the warp feather
const namedPlaces = new Map();

export function registerPlace(def) {
  if (!def?.id) throw new Error('registerPlace: a place needs an id');
  if (namedPlaces.has(def.id)) throw new Error(`Place "${def.id}" is already registered`);
  if (!PLACE_KINDS.includes(def.kind)) throw new Error(`Place "${def.id}": kind must be one of ${PLACE_KINDS.join(', ')}`);
  if (!def.spot?.area) throw new Error(`Place "${def.id}" needs a spot with an area`);
  const full = { name: def.id, order: 100, ...def, area: def.area ?? def.spot.area };
  namedPlaces.set(def.id, full);
  return full;
}

export const getPlace = (id) => namedPlaces.get(id) ?? null;
export const places = (kind = null) =>
  [...namedPlaces.values()].filter((p) => !kind || p.kind === kind).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
export const placeVisited = (id) => {
  const p = getPlace(id);
  return !!p && state.visitedAreas.has(p.area);
};
// Places of these kinds the hero has been to, in order: what the warp feather offers.
export const warpPlaces = (kinds = WARP_KINDS) => places().filter((p) => kinds.includes(p.kind) && placeVisited(p.id));

// What kind of place an area is (the minimap shows in 'overworld' and
// 'town' areas only, gameplay spec 4.6): the area's `kind` field, else
// 'dungeon' for an area of rooms (feat/world) or with its own key group
// (the M1 crypt), else 'overworld'. New areas set `kind`.
export const AREA_KINDS = ['overworld', 'town', 'castle', 'interior', 'cave', 'dungeon', 'arena', 'test'];
export function areaKind(area = currentScreen()?.area) {
  const a = typeof area === 'string' ? getArea(area) : area;
  if (!a) return null;
  return a.kind ?? (a.rooms || a.keyGroup ? 'dungeon' : 'overworld');
}

// ---------------------------------------------------------------- visits
let entry = null;
let lastArea = null;
const areaHandlers = [];

// fn(area, previousArea) when the hero enters a screen of another area
// (including the first screen after a start or a load).
export function onAreaChange(fn) {
  areaHandlers.push(fn);
}

export const roomEntry = () => entry;
export const hasVisited = (screenOrId) => state.visited.has(typeof screenOrId === 'string' ? screenOrId : screenId(screenOrId));

on('screen-enter', ({ screen }) => {
  if (!screen) return;
  entry = spotHere();
  const id = screenId(screen);
  if (!state.visited.has(id)) {
    state.visited.add(id);
    emit('screen-visited', { key: id, area: screen.area.id, screen });
  }
  state.visitedAreas.add(screen.area.id);
  if (screen.area !== lastArea) {
    const prev = lastArea;
    lastArea = screen.area;
    for (const fn of areaHandlers) fn(screen.area, prev);
  }
});

// The camera option picks the preset (world owns the camera).
registerSettingApplier('camera', (name) => chooseCameraPreset(name));
