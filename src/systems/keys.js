// Small keys are counted per dungeon (area.keyGroup, default the area id), so
// a key found in one dungeon only opens doors in that dungeon.
import { state } from '../core/state.js';
import { currentScreen } from '../world/world.js';

export function keyGroup(screen = currentScreen()) {
  const area = screen?.area;
  return area ? area.keyGroup ?? area.id : 'none';
}

export const keyCount = (group = keyGroup()) => state.keys[group] ?? 0;

export function addKeys(n = 1, group = keyGroup()) {
  state.keys[group] = keyCount(group) + n;
}

// Spend one key; false if there is none.
export function useKey(group = keyGroup()) {
  if (keyCount(group) <= 0) return false;
  state.keys[group] -= 1;
  return true;
}
