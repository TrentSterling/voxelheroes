// Save slots in localStorage. Every access is wrapped in try/catch because
// storage can be missing or blocked (private windows, sandboxed previews).
//
//   writeSlot(1, serializeState())  -> true when stored
//   readSlot(1)                     -> { time, data } or null
//   listSlots(3)                    -> [{ slot, time, data } | null, ...]
//
// The load/new-game flow that applies a slot lives in systems/flow.js.

const PREFIX = 'voxel-heroes:slot:';

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

export function listSlots(count = 3) {
  return Array.from({ length: count }, (_, i) => {
    const s = readSlot(i + 1);
    return s ? { slot: i + 1, ...s } : null;
  });
}
