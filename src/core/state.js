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

export const SAVE_VERSION = 1;
export const SAVE_MIGRATIONS = {};
export const START_HP = 6; // three hearts, counted in halves

export const state = {
  mode: 'title', // top of the mode stack: title | play | scroll | warp | paused | dead | dialog | ...
  modeStack: [],
  time: 0, // seconds of simulation since load
  deadT: 0,
  sx: 0, // current screen, global grid coordinates
  sy: 0,
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
defineState('gems', () => 0); // the currency
defineState('keys', () => ({})); // small keys per dungeon: { crypt: 1 }
defineState('flags', () => new Set(), { toJSON: (s) => [...s], fromJSON: (a) => new Set(a) });
defineState('tileEdits', () => ({})); // persistent tile changes: { 'tx,tz': char }

export const hasFlag = (flag) => state.flags.has(flag);
export const setFlag = (flag) => state.flags.add(flag);
export const clearFlag = (flag) => state.flags.delete(flag);
