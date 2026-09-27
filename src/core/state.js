// The game state object plus the registry that saves and loads it.
//
// `state` holds everything the game needs to remember. Core fields are
// declared below with defineState(); a feature adds its own field the same way
// from its own file, and that field is then reset on a new game, written into
// save data and read back on load without touching this file:
//
//   defineState('bombs', () => 0);                           // saved number
//   defineState('sword', () => ({ id: 'starter', length: 1 }));
//   defineState('seen', () => new Set(), { toJSON: (s) => [...s], fromJSON: (a) => new Set(a) });
//   defineState('fx', () => ({}), { persist: false });       // runtime only: reset on new game and on load
//
// Fields that live elsewhere (the hero's position) register raw handlers:
//
//   registerSaveField('pos', { save: () => ({...}), load: (v) => {...}, reset: () => {...}, decode: (v) => v });
//
// serializeState() returns plain JSON; loadState(json) restores every
// registered field and resets the ones missing from the data.
//
// Loading is all or nothing: every field is decoded first (fromJSON /
// decode, which may throw on damaged data) and only then applied, so a bad
// save throws before the running game changes. Data from a newer
// SAVE_VERSION is rejected; older data is upgraded one version at a time by
// SAVE_MIGRATIONS[v] (data of version v -> data of version v + 1). Bump
// SAVE_VERSION and add a migration only for a change loadState cannot absorb
// (renaming or reshaping a field); new fields need neither.
//
// Tiles in save data. In play, flags and tile edits that belong to a tile
// name its global tile: any flag of the form '<name>:<tx>,<tz>' ('chest:
// 3223,5'), and every key of tileEdits ('3223,5'). An area can be moved in
// the global grid, so save data names those tiles by place instead ('chest:
// crypt:1,0:7,5', the area, its local screen and the local tile); the world
// installs that translation with setTileKeyCodec (world/world.js). Keep other
// flags out of the '<name>:<number>,<number>' form.

export const SAVE_VERSION = 3;
export const SAVE_MIGRATIONS = {
  // 1 -> 2 (M2 contracts): money is counted in coins; the M1 field was 'gems'.
  1: (data) => {
    const { gems, ...fields } = data.fields ?? {};
    if (gems !== undefined && fields.coins === undefined) fields.coins = gems;
    return { ...data, version: 2, fields };
  },
  // 2 -> 3 (M1.5 world): places instead of the M1 lattice (fromM1Layout below).
  2: (data) => ({ ...fromM1Layout(data), version: 3 }),
};

// The M1 layout (main before M1.5): every area sat on one lattice of 16 x 11
// screens, origins counted in those screens, and saves named places by it:
// pos and respawn as { sx, sy, x, z, yaw }, and tiles in flags and tile
// edits by global tile ('chest:23,115', '23,121'). The overworld is still
// where it was; the crypt has since moved to the dungeon columns as 16 x 12
// rooms whose rows 0-10 kept their places. Saves of that layout are M1's
// (version 1) and the M2 contracts' before feat/world (version 2); those
// made since name an area in pos (feat/world's own saves say version 1).
const M1_SCREEN = [16, 11];
const M1_AREAS = [
  { id: 'overworld', origin: [0, 0], size: [3, 2] },
  { id: 'crypt', origin: [0, 10], size: [2, 2] },
];

// The place of an M1 global point: { area, screen: [i, j], x, z } with x and
// z local to the screen, or null where M1 had nothing.
function m1Place(gx, gz) {
  const [w, h] = M1_SCREEN;
  const sx = Math.floor(gx / w);
  const sy = Math.floor(gz / h);
  for (const a of M1_AREAS) {
    const [i, j] = [sx - a.origin[0], sy - a.origin[1]];
    if (i >= 0 && j >= 0 && i < a.size[0] && j < a.size[1]) return { area: a.id, screen: [i, j], x: gx - sx * w, z: gz - sy * h };
  }
  return null;
}

// An M1 spot as an area spot (null where M1 had nothing); anything else as it is.
function m1Spot(p) {
  if (!p || typeof p !== 'object' || p.area || !Number.isFinite(p.sx) || !Number.isFinite(p.sy)) return p;
  const [w, h] = M1_SCREEN;
  const place = m1Place(p.sx * w + (p.x ?? w / 2), p.sy * h + (p.z ?? h / 2));
  return place ? { ...place, yaw: p.yaw ?? 0 } : null;
}

// An M1 global tile key ('23,121') as a place key ('crypt:1,1:7,0'), which
// loading then puts on today's tile (loadTileKey below); others as they are.
function m1TileKey(key) {
  const m = /^(-?\d+),(-?\d+)$/.exec(key);
  const p = m && m1Place(Number(m[1]), Number(m[2]));
  return p ? `${p.area}:${p.screen.join(',')}:${p.x},${p.z}` : key;
}

// A save of the M1 layout (its pos is { sx, sy, ... }) with its position,
// respawn point, tile flags and tile edits named by place; other saves as
// they are. Fields that are not what they should be are left for their
// decoder to refuse.
function fromM1Layout(data) {
  const f = data.fields;
  if (!f || typeof f !== 'object' || !Number.isFinite(f.pos?.sx) || !Number.isFinite(f.pos?.sy)) return data;
  const fields = { ...f, pos: m1Spot(f.pos) };
  if ('respawn' in f) fields.respawn = m1Spot(f.respawn);
  if (Array.isArray(f.flags))
    fields.flags = f.flags.map((flag) => {
      const m = typeof flag === 'string' && TILE_FLAG.exec(flag);
      return m ? `${m[1]}:${m1TileKey(m[2])}` : flag;
    });
  if (f.tileEdits && typeof f.tileEdits === 'object' && !Array.isArray(f.tileEdits))
    fields.tileEdits = Object.fromEntries(Object.entries(f.tileEdits).map(([k, ch]) => [m1TileKey(k), ch]));
  return { ...data, fields };
}
export const START_HP = 6; // three hearts, counted in halves

export const state = {
  mode: 'title', // top of the mode stack: title | play | scroll | warp | paused | dead | dialog | ...
  modeStack: [],
  time: 0, // seconds of simulation since load
  deadT: 0,
  screenKey: null, // the current screen: 'area:i,j' (world/world.js currentScreen())
  // Player preferences. Not part of a save slot; the options UI owns them.
  settings: { camera: 'A' },
};

const saveFields = new Map();

// save() -> JSON value (null: runtime only); decode(json) -> value, may throw
// on damaged data; load(value) applies it and must not throw; reset() puts
// the initial value back.
export function registerSaveField(key, { save, load, reset, decode = (v) => v }) {
  if (saveFields.has(key)) throw new Error(`Save field "${key}" is already registered`);
  saveFields.set(key, { save, load, reset, decode });
}

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export function defineState(key, init, { persist = true, toJSON = clone, fromJSON = clone } = {}) {
  state[key] = init();
  registerSaveField(key, {
    save: persist ? () => toJSON(state[key]) : null,
    decode: fromJSON,
    load: (v) => {
      state[key] = v;
    },
    reset: () => {
      state[key] = init();
    },
  });
}

// New game: every registered field goes back to its initial value.
export function resetState() {
  for (const f of saveFields.values()) f.reset?.();
}

export function serializeState() {
  const fields = {};
  for (const [key, f] of saveFields) if (f.save) fields[key] = f.save();
  return { version: SAVE_VERSION, fields };
}

// codec.save('tx,tz') -> the key to save; codec.load(key) -> 'tx,tz', or null
// when the key names no tile today (it is then kept as it is).
let tileKeys = { save: (k) => k, load: () => null };
export function setTileKeyCodec(codec) {
  tileKeys = codec;
}
const TILE_FLAG = /^([\w-]+):(-?\d+,-?\d+)$/;
const PLACE_FLAG = /^([\w-]+):([\w-]+:-?\d+,-?\d+:-?\d+,-?\d+)$/;
const saveTileKey = (k) => tileKeys.save(k) ?? k;
const loadTileKey = (k) => (/^-?\d+,-?\d+$/.test(k) ? k : tileKeys.load(k) ?? k);
function saveFlag(flag) {
  const m = TILE_FLAG.exec(flag);
  return m ? `${m[1]}:${saveTileKey(m[2])}` : flag;
}
function loadFlag(flag) {
  const m = PLACE_FLAG.exec(flag);
  return m ? `${m[1]}:${loadTileKey(m[2])}` : flag;
}

// Restore a serializeState() result. Throws, leaving the state untouched, if
// the data is from a newer version or a field cannot be decoded. loadState({})
// resets every field.
export function loadState(data) {
  if (data == null || typeof data !== 'object') throw new Error('Save data must be an object');
  let version = data.version ?? SAVE_VERSION;
  if (!Number.isInteger(version) || version < 1) throw new Error(`Save data has a bad version (${data.version})`);
  if (version > SAVE_VERSION) throw new Error(`Save data is from a newer version of the game (${version}, this is ${SAVE_VERSION})`);
  for (; version < SAVE_VERSION; version++) {
    const migrate = SAVE_MIGRATIONS[version];
    if (!migrate) throw new Error(`No save migration from version ${version}`);
    data = migrate(data);
  }
  const fields = data.fields ?? {};
  if (typeof fields !== 'object') throw new Error('Save data fields must be an object');
  // Decode everything first: a failure here leaves the running game as it was.
  const decoded = new Map();
  for (const [key, f] of saveFields) {
    if (!f.save || !(key in fields)) continue;
    try {
      decoded.set(key, f.decode(fields[key]));
    } catch (e) {
      throw new Error(`Save field "${key}" cannot be loaded: ${e.message}`);
    }
  }
  for (const [key, f] of saveFields) {
    if (decoded.has(key)) f.load(decoded.get(key));
    else f.reset?.();
  }
}

// ---------------------------------------------------------------- core fields
defineState('hp', () => START_HP);
defineState('maxHp', () => START_HP);
defineState('coins', () => 0); // money, in coins (wallet max TUNING.economy.walletMax)
// M1 name of the money field, kept as an alias for code written before M2
// (the test hook's snapshot, the game-over panel). New code uses state.coins.
Object.defineProperty(state, 'gems', {
  get: () => state.coins,
  set: (v) => {
    state.coins = v;
  },
  enumerable: false,
  configurable: true,
});
defineState('keys', () => ({})); // small keys per dungeon: { crypt: 1 }
defineState('flags', () => new Set(), {
  toJSON: (s) => [...s].map(saveFlag),
  fromJSON: (a) => new Set([...(a ?? [])].map(loadFlag)),
});
// persistent tile changes: { 'tx,tz': char }
defineState('tileEdits', () => ({}), {
  toJSON: (o) => Object.fromEntries(Object.entries(o).map(([k, ch]) => [saveTileKey(k), ch])),
  fromJSON: (o) => Object.fromEntries(Object.entries(o ?? {}).map(([k, ch]) => [loadTileKey(k), ch])),
});

export const hasFlag = (flag) => state.flags.has(flag);
export const setFlag = (flag) => state.flags.add(flag);
export const clearFlag = (flag) => state.flags.delete(flag);
