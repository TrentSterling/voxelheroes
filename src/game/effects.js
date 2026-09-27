// Timed effects that several streams read: spells (reflect, reveal, slow,
// truesight, freeze), the star special, a lit candle. state.effects holds the
// seconds left for each; it is runtime state (reset on load and new game).
//
//   startEffect('reflect', TUNING.spells.reflect.time)   'effect-start'
//   effectActive('reflect') -> true while time is left     (the hero's guard reads it)
//   effectLeft('reveal')    -> seconds left                  (tablets read it)
//   clearEffect('slow')                                      'effect-end'
//   worldScale(entity)      -> the time scale for an entity: TUNING.spells.slow.factor
//                             (0.5) while 'slow' runs, 1 for the hero and his own shots
//
// Effect names in use (docs/CONTRACTS.md, "Effects"): reflect, reveal, quake,
// freeze, slow, truesight (items: spells), star (hero: the star special),
// candle, lamp (items: light in a dark room until the hero leaves it; they
// have no timer, so they are started with Infinity and cleared on
// 'screen-leave'). Effects count down in play mode only (game/watch.js).
//
// The slow spell (gameplay spec 9.4) makes everything but the hero move at
// half speed: every mover multiplies its dt by worldScale(this) (the
// Projectile base does; the Enemy base, traps, turrets and moving platforms
// do the same in their streams).
//
// Imports only core modules.
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { TUNING } from '../core/tuning.js';
import './fields.js';

export function startEffect(name, seconds) {
  const had = (state.effects[name] ?? 0) > 0;
  state.effects[name] = Math.max(state.effects[name] ?? 0, seconds);
  if (!had) emit('effect-start', { name, seconds });
}

export const effectLeft = (name) => Math.max(0, state.effects[name] ?? 0);
export const effectActive = (name) => effectLeft(name) > 0;

// Time scale for `entity` this tick: 1, or the slow factor while the slow
// spell runs. The hero (kind 'player') and shots he owns keep full speed.
export function worldScale(entity = null) {
  if (!effectActive('slow')) return 1;
  if (entity && (entity.kind === 'player' || entity.owner === 'hero')) return 1;
  return TUNING.spells.slow.factor;
}

export function clearEffect(name) {
  if (!(name in state.effects)) return;
  delete state.effects[name];
  emit('effect-end', { name });
}

export function tickEffects(dt) {
  for (const [name, left] of Object.entries(state.effects)) {
    if (left === Infinity) continue;
    const next = left - dt;
    if (next > 0) state.effects[name] = next;
    else clearEffect(name);
  }
}
