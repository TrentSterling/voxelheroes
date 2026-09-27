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
//   registerSaveField('pos', { save: () => ({...}), load: (v) => {...}, reset: () => {...} });
//
// serializeState() returns plain JSON; loadState(json) restores every
// registered field and resets the ones missing from the data.
//
// Tiles in save data. In play, flags and tile edits that belong to a tile
// name its global tile: any flag of the form '<name>:<tx>,<tz>' ('chest:
// 3223,5'), and every key of tileEdits ('3223,5'). An area can be moved in
// the global grid, so save data names those tiles by place instead ('chest:
// crypt:1,0:7,5', the area, its local screen and the local tile); the world
// installs that translation with setTileKeyCodec (world/world.js). Keep other
// flags out of the '<name>:<number>,<number>' form.

export const SAVE_VERSION = 1;
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

export function registerSaveField(key, { save, load, reset }) {
  if (saveFields.has(key)) throw new Error(`Save field "${key}" is already registered`);
  saveFields.set(key, { save, load, reset });
}

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export function defineState(key, init, { persist = true, toJSON = clone, fromJSON = clone } = {}) {
  state[key] = init();
  registerSaveField(key, {
    save: persist ? () => toJSON(state[key]) : null,
    load: (v) => {
      state[key] = fromJSON(v);
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

export function loadState(data) {
  const fields = data?.fields ?? {};
  for (const [key, f] of saveFields) {
    if (f.save && key in fields) f.load(fields[key]);
    else f.reset?.();
  }
}

// ---------------------------------------------------------------- core fields
defineState('hp', () => START_HP);
defineState('maxHp', () => START_HP);
defineState('gems', () => 0); // the currency
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
