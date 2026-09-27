// Pickups and money on the floor, for every stream:
//
//   collectPickup(entity, { by: 'blade' })   collect it now, wherever the hero is (the blade,
//                                             the boomerang or the grapple touched it); 'pickup'
//   dropCoins(x, z, 250)                      scatter coin pickups worth 250 (boss pay, coin burst)
//   coinPieces(250) -> ['coin-100', 'coin-100', 'coin-10', ...]   largest first
//
// Pickup types (gameplay spec Appendix B): heart, magic, coin-1, coin-10,
// coin-100 (entities/pickups/, items stream), key (dungeon stream), and the
// items stream's arrows-5 and bomb-1. The M1 types gem (1 coin) and gem5 (5
// coins) stay until the drop tables move to coins. A pickup the hero walks
// over emits 'pickup' { entity, type } from entities/pickup.js (no `by`:
// read it as 'hero').
import { emit } from '../core/events.js';
import { random } from '../core/random.js';
import { TUNING } from '../core/tuning.js';
import { spawn } from '../entities/manager.js';

export const COIN_TYPES = { 100: 'coin-100', 10: 'coin-10', 1: 'coin-1' };

export function collectPickup(e, { by = 'blade' } = {}) {
  if (!e || e.removed || e.kind !== 'pickup') return false;
  e.collect();
  emit('pickup', { entity: e, type: e.type, by });
  e.remove();
  return true;
}

export function coinPieces(amount) {
  const out = [];
  let left = Math.max(0, Math.floor(amount));
  for (const v of [...TUNING.economy.coins].sort((a, b) => b - a)) {
    while (left >= v) {
      out.push(COIN_TYPES[v]);
      left -= v;
    }
  }
  return out;
}

// Spawn coins worth `amount` in a ring around (x, z). Returns the entities.
export function dropCoins(x, z, amount, { spread = 1.2, life = TUNING.pickups.bossDropLife } = {}) {
  const pieces = coinPieces(amount);
  return pieces.map((type, i) => {
    const a = (i / Math.max(1, pieces.length)) * Math.PI * 2 + random() * 0.5;
    const r = spread * (0.35 + 0.65 * random());
    return spawn(type, { x: x + Math.sin(a) * r, z: z + Math.cos(a) * r, life });
  });
}
