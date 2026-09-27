// The player's options: one object, state.settings, kept in localStorage
// (core/save.js readPrefs / writePrefs) for the whole browser, not per save
// slot. The options menu (ui) changes them with setSetting; everything else
// reads state.settings.<key> or getSetting(key).
//
//   setSetting('textSpeed', 'fast')    -> true, saved, 'settings-changed' { key, value, old }
//   setSetting('camera', 'Z')          -> false (not an allowed value)
//   registerSettingApplier('minimap', (on) => showMinimap(on));   // runs now and on every change
//
// Keys, allowed values and who applies them are in SETTINGS below and in
// docs/CONTRACTS.md ("Settings"). Defaults come from TUNING.options. The
// camera preset is also written into each save slot by feat/world ('camera'
// save field), so loading a slot can change it.
//
// This module imports only core modules (dialog.js and hud.js import it).
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { readPrefs, writePrefs } from '../core/save.js';
import { setMuted, setVolumes } from '../core/audio.js';
import { TUNING } from '../core/tuning.js';

const oneOf = (...values) => ({ check: (v) => values.includes(v), values });
const bool = { check: (v) => typeof v === 'boolean', values: [true, false] };
const range = (lo, hi) => ({ check: (v) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi, range: [lo, hi] });

// key -> { check, values | range, by: who applies it }
export const SETTINGS = {
  camera: { ...oneOf('A', 'B', 'C', 'D'), by: 'world: chooseCameraPreset (applied by game/places.js)' },
  look: { ...oneOf('auto', 'high', 'medium', 'low', 'flat'), by: "look: reads state.settings each drawn frame ('auto' = the device default)" },
  seams: { ...bool, by: "look: the voxel seams, live (the gameplay spec's grid option)" },
  brightness: { ...range(0.5, 1.5), by: 'look: times the exposure' },
  saturation: { ...range(0, 2), by: "look: times the grade's saturation (high and medium quality)" },
  minimap: { ...bool, by: 'ui: HUD minimap' },
  loadingArt: { ...bool, by: 'ui: loading cards (art on: at least TUNING.load.cardMin s)' },
  textSpeed: { ...oneOf('slow', 'normal', 'fast', 'instant'), by: 'ui: dialog.js typewriter (textSpeed())' },
  largeText: { ...bool, by: 'ui: dialog.js big text box' },
  sway: { ...bool, by: 'hero: walk sway' },
  cornerAssist: { ...bool, by: 'hero: corner assist' },
  spinAssist: { ...bool, by: 'hero: spin assist' },
  dashHold: { ...bool, by: 'hero: hold to dash instead of tap' },
  autosave: { ...bool, by: 'ui: autosave on area loads' },
  volume: { ...range(0, 1), by: 'contracts: core/audio.js master level' },
  music: { ...range(0, 1), by: 'contracts: core/audio.js music level' },
  sfx: { ...range(0, 1), by: 'contracts: core/audio.js effects level' },
  muted: { ...bool, by: 'contracts: core/audio.js (N key, the HUD Sound button)' },
};

// Characters per second for each text speed ('instant' shows a page at once).
export const TEXT_SPEEDS = { slow: 25, normal: 45, fast: 90, instant: Infinity };

export const settingDefaults = () => Object.fromEntries(Object.keys(SETTINGS).map((k) => [k, TUNING.options[k]]));

const appliers = new Map(); // key -> [fn]

export function registerSettingApplier(key, fn) {
  if (!SETTINGS[key]) throw new Error(`registerSettingApplier: unknown setting "${key}"`);
  if (!appliers.has(key)) appliers.set(key, []);
  appliers.get(key).push(fn);
  run(key, fn);
}

// An applier that throws (say, a camera preset another branch renamed) must
// not stop the game from starting or an option from being stored, so the
// error becomes a warning.
function run(key, fn) {
  try {
    fn(state.settings[key]);
  } catch (e) {
    console.warn(`Setting "${key}": applying ${JSON.stringify(state.settings[key])} failed: ${e.message}`);
  }
}

const allowed = (key, value) => !!SETTINGS[key] && SETTINGS[key].check(value);

export const getSetting = (key) => state.settings[key];
export const settings = () => ({ ...state.settings });
export const textSpeed = () => TEXT_SPEEDS[state.settings.textSpeed] ?? TEXT_SPEEDS.normal;

function persist() {
  const out = {};
  for (const k of Object.keys(SETTINGS)) out[k] = state.settings[k];
  return writePrefs(out);
}

function apply(key) {
  for (const fn of appliers.get(key) ?? []) run(key, fn);
}

// Change one option. Unknown keys throw (a typo is a bug); a value the key
// does not allow returns false and changes nothing.
export function setSetting(key, value) {
  if (!SETTINGS[key]) throw new Error(`setSetting: unknown setting "${key}" (${Object.keys(SETTINGS).join(', ')})`);
  if (!allowed(key, value)) return false;
  const old = state.settings[key];
  state.settings[key] = value;
  persist();
  if (old !== value) {
    apply(key);
    emit('settings-changed', { key, value, old });
  }
  return true;
}

export function resetSettings() {
  for (const [k, v] of Object.entries(settingDefaults())) setSetting(k, v);
}

// Fill in defaults, then the saved preferences (values that are no longer
// allowed are ignored). Runs once at startup; tests call it again.
export function loadSettings() {
  const defaults = settingDefaults();
  for (const [k, v] of Object.entries(defaults)) if (!allowed(k, state.settings[k])) state.settings[k] = v;
  const saved = readPrefs();
  if (saved) for (const [k, v] of Object.entries(saved)) if (allowed(k, v)) state.settings[k] = v;
  for (const k of Object.keys(SETTINGS)) apply(k);
}

loadSettings();

// Sound follows the options.
const levels = () => setVolumes({ master: state.settings.volume, music: state.settings.music, sfx: state.settings.sfx });
registerSettingApplier('muted', (on) => setMuted(!!on));
registerSettingApplier('volume', levels);
registerSettingApplier('music', levels);
registerSettingApplier('sfx', levels);
