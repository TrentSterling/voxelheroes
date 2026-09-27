// Cleared screens and rooms: which ones stay empty when the hero comes back
// (gameplay spec 5.5: an overworld screen whose enemies were all killed
// stays empty until its area loads again, and a screen that had a rare
// spawn never counts; 6.5: a cleared dungeon room stays clear until the
// hero leaves the floor or TUNING.enemy.roomClearMemory s pass). One store
// for every enemy type and every way enemies are placed, so spawn groups,
// plain spawn markers and each stream's own enemies agree.
//
//   registerClearRule('overworld', ({ key, area, rare }) => areaKind(area) === 'overworld' ? !rare : undefined)
//   isCleared('ow-4-3:1,2')          the screen is remembered as cleared: skip its enemies
//   markCleared(key)                 remember it (done for you on 'room-cleared')
//   forgetCleared((key, rec) => ...) forget the ones the predicate picks (rec: { at, area })
//   clearedScreens()                 [key, ...]
//
// On 'room-cleared' the current screen is remembered when some rule answers
// true and none answers false (no rule: not remembered, M1's behaviour). A
// rule gets { key, area, screen, rare, now }: rare is true when an enemy with
// `rare: true` appeared on this visit. The rules and the forgetting are the
// foes streams' (foes-overworld: the overworld rule, forgetting an area's
// screens on 'area-enter'; foes-dungeon: the room rule, forgetting on a
// floor change, 'dungeon-leave' or after roomClearMemory s). Who spawns
// enemies (systems/spawner.js markers, entities/spawn-group.js groups, a
// stream's own spawner) checks isCleared(screenId(screen)) first.
// Remembered clears are runtime state: a load or a new game forgets them.
import { state } from '../core/state.js';
import { on } from '../core/events.js';
import { currentScreen } from '../world/world.js';
import { screenId } from './places.js';

const rules = [];
const cleared = new Map(); // key -> { at, area }
let rareThisVisit = false;

export function registerClearRule(id, fn) {
  if (typeof fn !== 'function') throw new Error(`registerClearRule("${id}"): fn must be a function`);
  if (rules.some((r) => r.id === id)) throw new Error(`Clear rule "${id}" is already registered`);
  rules.push({ id, fn });
  rules.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export const isCleared = (key) => cleared.has(key);
export const clearedScreens = () => [...cleared.keys()];

export function markCleared(key, { area = null } = {}) {
  if (!key) return false;
  cleared.set(key, { at: state.time, area });
  return true;
}

export function forgetCleared(pred = () => true) {
  for (const [key, rec] of [...cleared]) if (pred(key, rec)) cleared.delete(key);
}

// Would a clear of this screen be remembered now?
export function remembersClear(screen = currentScreen()) {
  if (!screen) return false;
  const ctx = { key: screenId(screen), area: screen.area, screen, rare: rareThisVisit, now: state.time };
  let yes = false;
  for (const r of rules) {
    const v = r.fn(ctx);
    if (v === false) return false;
    if (v === true) yes = true;
  }
  return yes;
}

on('screen-enter', () => {
  rareThisVisit = false;
});
on('enemy-spawned', ({ entity }) => {
  if (entity?.rare) rareThisVisit = true;
});
on('room-cleared', ({ screen }) => {
  const s = screen ?? currentScreen();
  if (s && remembersClear(s)) markCleared(screenId(s), { area: s.area?.id ?? null });
});
on('new-game', () => forgetCleared());
on('loaded', () => forgetCleared());
on('mode-change', ({ to }) => {
  if (to === 'title') forgetCleared();
});
