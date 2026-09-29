// Swords: the registry, the swords the hero owns, the smith's levels and the
// blade the hero holds right now. One file per sword in src/swords/ (loaded
// automatically):
//
//   registerSword({
//     id: 'blade-2',
//     name: 'Fen Edge',                   // shown in menus and on the item get
//     base: { strength: 3, spin: 1 },     // stats not given are 0 (strength 1)
//     max: { length: 5, width: 5, strength: 9, spin: 1, pierce: 1 },  // default: base
//     price: { length: 80, width: 80, strength: 240, pierce: 450 },   // coins per level
//     budget: 2200,                       // most coins a smith takes for it in all
//     special: null,                      // or a SPECIALS kind; its level is the special stat
//     order: 20,                          // menu order
//     icon: '<svg ...>',                  // the HUD weapon slot and menus (optional)
//     model: () => new THREE.Group(),     // the blade held overhead at the item get and
//                                         // shown in menus (models/hero/*; optional)
//   });
//
// Stats (gameplay spec 10.5): length 0-20, width 0-20, strength 1-20, spin
// 0-1, beam 0-3, pierce 0-1, special 0-5. A stat with no price is not sold.
//
//   giveSword('blade-2')          own it ('sword-found'); grant('blade-2') does the same with the item get
//   equipSword('blade-2')         'sword-equip'
//   swordLevels(id)               base + levels bought, per stat
//   canBuyLevel(id, 'length')     { ok, reason: 'max' | 'budget' | 'coins' | 'not-sold' | 'not-owned', price }
//   buyLevel(id, 'length')        the smith: pays, adds a level, 'sword-upgrade'
//   resetSword(id)                back to base, the coins spent are lost ('sword-reset')
//   bladeStats()                  what the blade does now (the full-life rule, the might trait)
//   bladeSize(stats)              { length, width, hitWidth, reach, small } in tiles
//
// The full-life rule (spec 7.5): at full life the blade has every stat;
// below it the blade shrinks to a quick thrust and the bonus stats (spin,
// beam, pierce and most specials) switch off, except pinch power, which
// works below full life. Length, width and strength are never lost though:
// a smith level always lengthens, widens or hardens the blade, full life or
// not (fun audit: buying a level below full life used to change nothing).
// The might trait adds 1 strength either way. Until the hero stream's sword
// reads bladeStats(), the M1 swing in systems/sword.js keeps its own numbers.
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { TUNING } from '../core/tuning.js';
import { registerGrant } from '../systems/grants.js';
import { isFullLife, spendCoins, canAfford } from './vitals.js';
import './fields.js';

export const SWORD_STATS = ['length', 'width', 'strength', 'spin', 'beam', 'pierce', 'special'];
export const STAT_RANGES = { length: [0, 20], width: [0, 20], strength: [1, 20], spin: [0, 1], beam: [0, 3], pierce: [0, 1], special: [0, 5] };
export const SPECIALS = ['coin-burst', 'freeze', 'pinch', 'swift', 'star', 'thrift', 'rare-slayer'];
export const STARTER = 'blade-start';

const swords = new Map();

function statTable(id, what, table, fill) {
  const out = {};
  for (const k of Object.keys(table ?? {})) if (!SWORD_STATS.includes(k)) throw new Error(`Sword "${id}": unknown stat "${k}" in ${what} (${SWORD_STATS.join(', ')})`);
  for (const k of SWORD_STATS) {
    const v = table?.[k] ?? fill(k);
    const [lo, hi] = STAT_RANGES[k];
    if (!Number.isInteger(v) || v < lo || v > hi) throw new Error(`Sword "${id}": ${what}.${k} must be a whole number ${lo}-${hi}, not ${v}`);
    out[k] = v;
  }
  return out;
}

export function registerSword(def) {
  if (!def?.id) throw new Error('registerSword: a sword needs an id');
  if (swords.has(def.id)) throw new Error(`Sword "${def.id}" is already registered`);
  const base = statTable(def.id, 'base', def.base, (k) => STAT_RANGES[k][0]);
  const max = statTable(def.id, 'max', def.max, (k) => base[k]);
  for (const k of SWORD_STATS) if (max[k] < base[k]) throw new Error(`Sword "${def.id}": max.${k} (${max[k]}) is below base (${base[k]})`);
  const price = {};
  for (const [k, v] of Object.entries(def.price ?? {})) {
    if (!SWORD_STATS.includes(k)) throw new Error(`Sword "${def.id}": unknown stat "${k}" in price`);
    if (!(Number.isFinite(v) && v > 0)) throw new Error(`Sword "${def.id}": price.${k} must be a positive number of coins`);
    price[k] = v;
  }
  if (def.special != null && !SPECIALS.includes(def.special)) throw new Error(`Sword "${def.id}": special must be one of ${SPECIALS.join(', ')}`);
  if ((max.special > 0 || base.special > 0) && !def.special) throw new Error(`Sword "${def.id}": a special stat needs a special kind`);
  // A sword with no cap (spec 10.5's one late sword) takes budget: Infinity.
  const budget = def.budget ?? 0;
  if (!(budget === Infinity || (Number.isFinite(budget) && budget >= 0))) throw new Error(`Sword "${def.id}": budget must be 0 or more coins (Infinity: no cap)`);
  if (def.model != null && typeof def.model !== 'function') throw new Error(`Sword "${def.id}": model must be a function returning a THREE.Object3D`);
  const full = { name: def.id, description: '', order: 100, icon: '', model: null, source: '', ...def, base, max, price, budget, special: def.special ?? null };
  swords.set(def.id, full);
  registerGrant(def.id, () => giveSword(def.id), { name: full.name, fanfare: true, kind: 'sword', model: full.model });
  return full;
}

export const getSword = (id) => swords.get(id) ?? null;
export const allSwords = () => [...swords.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
export const hasSword = (id) => state.swords.owned.includes(id);
export const ownedSwords = () => allSwords().filter((s) => hasSword(s.id));
export const equippedId = () => state.swords.equipped;
export const equippedSword = () => getSword(state.swords.equipped);

function need(id) {
  const s = getSword(id);
  if (!s) throw new Error(`Unknown sword "${id}"`);
  return s;
}

// Own a sword. Returns true the first time.
export function giveSword(id) {
  need(id);
  if (hasSword(id)) return false;
  state.swords.owned.push(id);
  emit('sword-found', { id });
  return true;
}

export function equipSword(id) {
  need(id);
  if (!hasSword(id)) return false;
  const from = state.swords.equipped;
  if (from === id) return true;
  state.swords.equipped = id;
  emit('sword-equip', { id, from });
  return true;
}

// ---------------------------------------------------------------- levels
const bought = (id) => state.swords.bought[id] ?? {};
export const spentOn = (id) => state.swords.spent[id] ?? 0;
export const budgetLeft = (id) => Math.max(0, need(id).budget - spentOn(id));

// Current levels (base + bought, never over max).
export function swordLevels(id = equippedId()) {
  const s = need(id);
  const b = bought(id);
  const out = {};
  for (const k of SWORD_STATS) out[k] = Math.min(s.max[k], s.base[k] + (b[k] ?? 0));
  return out;
}

// For the sword menu's stars: { stat: { level, base, max } }.
export function swordStars(id = equippedId()) {
  const s = need(id);
  const lv = swordLevels(id);
  return Object.fromEntries(SWORD_STATS.map((k) => [k, { level: lv[k], base: s.base[k], max: s.max[k] }]));
}

// Coins for the next level of a stat, or null if no smith sells it.
export const levelPrice = (id, stat) => need(id).price[stat] ?? null;

export function canBuyLevel(id, stat) {
  const s = need(id);
  if (!SWORD_STATS.includes(stat)) throw new Error(`Unknown sword stat "${stat}"`);
  const price = levelPrice(id, stat);
  if (!hasSword(id)) return { ok: false, reason: 'not-owned', price };
  if (price === null) return { ok: false, reason: 'not-sold', price };
  if (swordLevels(id)[stat] >= s.max[stat]) return { ok: false, reason: 'max', price };
  if (spentOn(id) + price > s.budget) return { ok: false, reason: 'budget', price };
  if (!canAfford(price)) return { ok: false, reason: 'coins', price };
  return { ok: true, reason: null, price };
}

// The smith sells one level. Returns canBuyLevel's answer (and the new level when ok).
export function buyLevel(id, stat) {
  const check = canBuyLevel(id, stat);
  if (!check.ok) return check;
  spendCoins(check.price, 'smith');
  const b = (state.swords.bought[id] ??= {});
  b[stat] = (b[stat] ?? 0) + 1;
  state.swords.spent[id] = spentOn(id) + check.price;
  const level = swordLevels(id)[stat];
  emit('sword-upgrade', { id, stat, level, cost: check.price });
  return { ...check, level };
}

// Back to base values. The coins spent are not refunded; the budget is free again.
export function resetSword(id) {
  need(id);
  const lost = spentOn(id);
  delete state.swords.bought[id];
  delete state.swords.spent[id];
  emit('sword-reset', { id, lost });
  return lost;
}

// ---------------------------------------------------------------- the blade now
const might = () => (state.profile.trait === 'might' ? TUNING.progression.mightStrength : 0);

// What the equipped blade does at the current life (or `full`, to ask).
// { id, full, small, length, width, strength, spin, beam, pierce, special, specialKind }
// With no sword equipped (a new game's prologue, before the king hands one
// over) it is { id: null, none: true, ... } with nothing to hit with.
export function bladeStats({ id = equippedId(), full = isFullLife() } = {}) {
  if (id == null) return { id: null, none: true, full, small: !full, length: 0, width: 0, strength: 0, spin: 0, beam: 0, pierce: 0, special: 0, specialKind: null };
  const s = getSword(id) ?? getSword(STARTER);
  if (!s) return { id, full, small: !full, length: 0, width: 0, strength: 1 + might(), spin: 0, beam: 0, pierce: 0, special: 0, specialKind: null };
  const lv = swordLevels(s.id);
  if (full) return { id: s.id, full: true, small: false, ...lv, strength: lv.strength + might(), specialKind: s.special };
  const pinch = s.special === 'pinch';
  return {
    id: s.id,
    full: false,
    small: true,
    // length, width and strength keep every smith level below full life too (fun audit: a bought
    // level felt like nothing happened at 5/6 hearts); only the full-life bonus stats drop out.
    length: lv.length,
    width: lv.width,
    strength: lv.strength + might(),
    spin: 0,
    beam: 0,
    pierce: 0,
    special: pinch ? lv.special : 0,
    specialKind: pinch ? s.special : null,
  };
}

// The blade's size in tiles. reach = hand offset + length (from the hero's centre).
export function bladeSize(stats = bladeStats()) {
  const t = TUNING.sword;
  if (stats.none) return { small: true, none: true, length: 0, width: 0, hitWidth: 0, reach: 0 };
  if (stats.small) {
    // Still a quick thrust, not the full blade, but smith levels always show: half the length and
    // width a level would add at full life grows the small blade too (fun audit: a bought level
    // was invisible below full life).
    const length = t.smallLength + (t.length(stats.length) - t.length(0)) * 0.5;
    const width = t.smallHitWidth + (t.width(stats.width) - t.width(0)) * 0.5;
    return { small: true, length, width, hitWidth: Math.max(t.minHitWidth, width), reach: t.handOffset + length };
  }
  const length = t.length(stats.length);
  const width = t.width(stats.width);
  return { small: false, length, width, hitWidth: Math.max(t.minHitWidth, width), reach: t.handOffset + length };
}
