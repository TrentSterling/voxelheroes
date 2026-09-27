// Small keys are counted per dungeon (area.keyGroup, default the area id), so
// a key found in one dungeon only opens doors in that dungeon. Every change
// emits 'keys-changed' { group, count, delta } (the ui's key toast). Colored
// keys and the master key are in game/dungeons.js.
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { currentScreen } from '../world/world.js';

export function keyGroup(screen = currentScreen()) {
  const area = screen?.area;
  return area ? area.keyGroup ?? area.id : 'none';
}

export const keyCount = (group = keyGroup()) => state.keys[group] ?? 0;

export function addKeys(n = 1, group = keyGroup()) {
  state.keys[group] = keyCount(group) + n;
  emit('keys-changed', { group, count: state.keys[group], delta: n });
}

// Spend one key; false if there is none.
export function useKey(group = keyGroup()) {
  if (keyCount(group) <= 0) return false;
  state.keys[group] -= 1;
  emit('keys-changed', { group, count: state.keys[group], delta: -1 });
  return true;
}
