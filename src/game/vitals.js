// Life, magic and money: the one way to change them so the right events fire.
//
//   heal(2)                 +1 heart (life is counted in half-heart units)
//   setLife(1, 'drain')     a drain blob's touch
//   addMaxLife(2)           a heart container: +1 heart and a full refill
//   addHeartPiece()         every 4th piece adds a heart
//   restoreMagic(1) / spendMagic(3) -> false if short / addMaxMagic(1)
//   addCoins(100) / spendCoins(30) -> false if short / canAfford(30)
//   refill()                full life and magic (inn, fountain, respawn)
//
// Damage to the hero goes through game/hero.js receiveHit (shield, i-frames,
// knockback, death), not through here. Every change emits 'life-changed',
// 'magic-changed' or 'coins-changed' at once with a reason; code that writes
// state.hp (or magic, coins) directly still gets an event with reason
// 'direct' at the start of the next play tick. isFullLife() is the sword's
// full-life rule: life equals max life exactly.
//
// This module imports only core modules (grants.js and other M1 systems
// import it); game/watch.js runs syncVitals every play tick.
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { TUNING } from '../core/tuning.js';
import './fields.js';

export const UNITS_PER_HEART = 2;

const last = { hp: state.hp, maxHp: state.maxHp, magic: state.magic, maxMagic: state.maxMagic, coins: state.coins };

export const isFullLife = () => state.hp >= state.maxHp && state.hp > 0;
export const hearts = (units = state.hp) => units / UNITS_PER_HEART;
export const walletMax = () => TUNING.economy.walletMax;

function lifeEvent(reason) {
  const delta = state.hp - last.hp;
  const wasFull = last.hp >= last.maxHp && last.hp > 0;
  last.hp = state.hp;
  last.maxHp = state.maxHp;
  emit('life-changed', { hp: state.hp, maxHp: state.maxHp, delta, full: isFullLife(), wasFull, reason });
}

function magicEvent(reason) {
  const delta = state.magic - last.magic;
  last.magic = state.magic;
  last.maxMagic = state.maxMagic;
  emit('magic-changed', { magic: state.magic, maxMagic: state.maxMagic, delta, reason });
}

function coinsEvent(reason) {
  const delta = state.coins - last.coins;
  last.coins = state.coins;
  emit('coins-changed', { coins: state.coins, delta, reason });
}

// ---------------------------------------------------------------- life
export function setLife(units, reason = 'set') {
  const v = Math.max(0, Math.min(state.maxHp, Math.round(units)));
  if (v === state.hp) return 0;
  const d = v - state.hp;
  state.hp = v;
  lifeEvent(reason);
  return d;
}

// Returns the units actually restored.
export function heal(units, reason = 'heal') {
  if (units <= 0 || state.hp <= 0) return 0;
  return setLife(state.hp + units, reason);
}

// Raise max life by `units` (2 per heart container). fill: refill life too.
export function addMaxLife(units, { fill = true, reason = 'max-life' } = {}) {
  state.maxHp = Math.max(UNITS_PER_HEART, state.maxHp + Math.round(units));
  if (fill) state.hp = state.maxHp;
  else state.hp = Math.min(state.hp, state.maxHp);
  lifeEvent(reason);
}

// One heart piece; every TUNING.progression.piecesPerHeart-th adds a heart.
// Returns the pieces toward the next heart (0 after a heart was added).
export function addHeartPiece(n = 1) {
  for (let i = 0; i < n; i++) {
    state.heartPieces += 1;
    if (state.heartPieces % TUNING.progression.piecesPerHeart === 0) addMaxLife(UNITS_PER_HEART, { reason: 'heart-piece' });
  }
  return state.heartPieces % TUNING.progression.piecesPerHeart;
}

export const heartPiecesTowardNext = () => state.heartPieces % TUNING.progression.piecesPerHeart;

// ---------------------------------------------------------------- magic
export function setMagic(n, reason = 'set') {
  const v = Math.max(0, Math.min(state.maxMagic, Math.round(n)));
  if (v === state.magic) return 0;
  const d = v - state.magic;
  state.magic = v;
  magicEvent(reason);
  return d;
}

export const restoreMagic = (n, reason = 'restore') => (n > 0 ? setMagic(state.magic + n, reason) : 0);

// Spend n magic; false (and nothing spent) if there is not enough.
export function spendMagic(n, reason = 'spend') {
  if (n > state.magic) return false;
  if (n > 0) setMagic(state.magic - n, reason);
  return true;
}

export function addMaxMagic(n, { fill = true, reason = 'max-magic' } = {}) {
  state.maxMagic = Math.max(0, state.maxMagic + Math.round(n));
  state.magic = fill ? state.maxMagic : Math.min(state.magic, state.maxMagic);
  magicEvent(reason);
}

// ---------------------------------------------------------------- money
export function addCoins(n, reason = 'coins') {
  const v = Math.max(0, Math.min(walletMax(), state.coins + Math.round(n)));
  if (v === state.coins) return 0;
  const d = v - state.coins;
  state.coins = v;
  coinsEvent(reason);
  return d;
}

export const canAfford = (n) => state.coins >= n;

// Spend n coins; false (and nothing spent) if short.
export function spendCoins(n, reason = 'spend') {
  if (n > state.coins) return false;
  if (n > 0) addCoins(-n, reason);
  return true;
}

export function addTokens(n = 1) {
  state.tokens = Math.max(0, state.tokens + n);
  return state.tokens;
}

// ---------------------------------------------------------------- refills
export function refill({ life = true, magic = true, reason = 'refill' } = {}) {
  if (life && state.hp !== state.maxHp) {
    state.hp = state.maxHp;
    lifeEvent(reason);
  }
  if (magic && state.magic !== state.maxMagic) {
    state.magic = state.maxMagic;
    magicEvent(reason);
  }
}

// Changes made without this module (M1 code, the test hook's setHp, loads)
// are reported at the start of the next play tick.
export function syncVitals(reason = 'direct') {
  if (state.hp !== last.hp || state.maxHp !== last.maxHp) lifeEvent(reason);
  if (state.magic !== last.magic || state.maxMagic !== last.maxMagic) magicEvent(reason);
  if (state.coins !== last.coins) coinsEvent(reason);
}
