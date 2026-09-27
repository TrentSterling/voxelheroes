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

export const SAVE_VERSION = 1;
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
defineState('flags', () => new Set(), { toJSON: (s) => [...s], fromJSON: (a) => new Set(a) });
defineState('tileEdits', () => ({})); // persistent tile changes: { 'tx,tz': char }

export const hasFlag = (flag) => state.flags.has(flag);
export const setFlag = (flag) => state.flags.add(flag);
export const clearFlag = (flag) => state.flags.delete(flag);
