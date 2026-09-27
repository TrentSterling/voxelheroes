// Save slots in localStorage. Every access is wrapped in try/catch because
// storage can be missing or blocked (private windows, sandboxed previews).
//
//   writeSlot(1, serializeState())  -> true when stored
//   readSlot(1)                     -> { time, data } or null
//   listSlots(3)                    -> [{ slot, time, data } | null, ...]
//   readPrefs() / writePrefs(obj)   -> the player's options, kept apart from the slots
//
// The load/new-game flow that applies a slot lives in systems/flow.js; slot
// summaries for a file-select screen are in game/saves.js; the options are
// kept by game/settings.js.

const PREFIX = 'voxel-heroes:slot:';
const PREFS = 'voxel-heroes:settings';
export const SLOT_COUNT = 3;

export function writeSlot(slot, data) {
  try {
    localStorage.setItem(PREFIX + slot, JSON.stringify({ time: Date.now(), data }));
    return true;
  } catch {
    return false;
  }
}

export function readSlot(slot) {
  try {
    const raw = localStorage.getItem(PREFIX + slot);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function deleteSlot(slot) {
  try {
    localStorage.removeItem(PREFIX + slot);
    return true;
  } catch {
    return false;
  }
}

export function listSlots(count = SLOT_COUNT) {
  return Array.from({ length: count }, (_, i) => {
    const s = readSlot(i + 1);
    return s ? { slot: i + 1, ...s } : null;
  });
}

// Options (settings) are one object for the whole browser, not per slot.
export function readPrefs() {
  try {
    const raw = localStorage.getItem(PREFS);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

export function writePrefs(prefs) {
  try {
    localStorage.setItem(PREFS, JSON.stringify(prefs));
    return true;
  } catch {
    return false;
  }
}
