// Timed effects that several streams read: spells (reflect, reveal, slow,
// truesight, freeze), the star special, a lit candle. state.effects holds the
// seconds left for each; it is runtime state (reset on load and new game).
//
//   startEffect('reflect', TUNING.spells.reflect.time)   'effect-start'
//   effectActive('reflect') -> true while time is left     (the hero's guard reads it)
//   effectLeft('reveal')    -> seconds left                  (tablets read it)
//   clearEffect('slow')                                      'effect-end'
//
// Effect names in use (docs/CONTRACTS.md, "Effects"): reflect, reveal, quake,
// freeze, slow, truesight (items: spells), star (hero: the star special),
// candle, lamp (items: light in a dark room until the hero leaves it; they
// have no timer, so they are started with Infinity and cleared on
// 'screen-leave'). Effects count down in play mode only (game/watch.js).
//
// Imports only core modules.
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import './fields.js';

export function startEffect(name, seconds) {
  const had = (state.effects[name] ?? 0) > 0;
  state.effects[name] = Math.max(state.effects[name] ?? 0, seconds);
  if (!had) emit('effect-start', { name, seconds });
}

export const effectLeft = (name) => Math.max(0, state.effects[name] ?? 0);
export const effectActive = (name) => effectLeft(name) > 0;

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
