// Spells: one file per spell in src/spells/ (items stream). A spell is also
// an item on the quick ring (registerItem kind 'spell'), so cycling and the
// B button treat tools and spells alike (gameplay spec 9.1, 9.4).
//
//   registerSpell({
//     id: 'spell-reflect',
//     name: 'Reflect',
//     icon: '<svg ...>',
//     cost: TUNING.spells.reflect.cost,       // [might, focus] (or one number)
//     cast(ctx) {                             // true if cast; ctx: { spell, cost, hero }
//       startEffect('reflect', TUNING.spells.reflect.time);
//       return true;
//     },
//   });
//
//   learnSpell('spell-reflect')   own it, max magic +1 (TUNING.progression.spellMagic), 'spell-learned';
//                                 grant('spell-reflect') does the same with the item get
//   spellCost('spell-quake')      for this hero: the focus trait's column, the thrift special
//   castSpell('spell-quake')      checks canAct (not in a doorway) and the magic, casts, then
//                                 spends and emits 'spell-cast' { id, cost, x, z } -> 'cast' | 'no-magic' |
//                                 'blocked' | 'failed' (cast returned false: nothing spent) | 'unknown'
//
// Cost: [might, focus] from TUNING.spells, the first number for heroes
// without the focus trait. The thrift special takes 1 off per 2 levels.
// Never below 1.
//
// A spell does its own work in cast(): freeze calls damage.freezeAt (which
// also turns flame tiles to ice through onFreeze), slow starts the 'slow'
// effect (movers read effects.worldScale), quake calls damageAt, reveal and
// truesight start their effects. 'spell-cast' is for the ui, audio and the
// dungeon's reveal tablets, not for applying the spell.
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { registerItem, getItem } from '../items/registry.js';
import { giveItem, hasItem } from '../items/inventory.js';
import { registerGrant } from '../systems/grants.js';
import { TUNING } from '../core/tuning.js';
import { addMaxMagic, spendMagic } from './vitals.js';
import { hasTrait } from './progress.js';
import { bladeStats } from './swords.js';
import { hero } from './hero.js';

const spells = new Map();

export const SPELL_RESULTS = ['cast', 'no-magic', 'blocked', 'failed', 'unknown'];

export function registerSpell(def) {
  if (!def?.id) throw new Error('registerSpell: a spell needs an id');
  if (spells.has(def.id)) throw new Error(`Spell "${def.id}" is already registered`);
  if (typeof def.cast !== 'function') throw new Error(`Spell "${def.id}" needs cast(ctx)`);
  const cost = Array.isArray(def.cost) ? def.cost : [def.cost ?? 1, def.cost ?? 1];
  if (!cost.every((c) => Number.isInteger(c) && c >= 0)) throw new Error(`Spell "${def.id}": cost must be whole numbers`);
  const full = { name: def.id, order: 200, icon: '', ...def, cost };
  spells.set(def.id, full);
  registerItem({
    id: def.id,
    name: full.name,
    icon: full.icon,
    order: full.order,
    kind: 'spell',
    fanfare: true,
    use: () => castSpell(def.id) === 'cast',
  });
  registerGrant(def.id, () => learnSpell(def.id), { name: full.name, fanfare: true, kind: 'spell', text: full.getText });
  return full;
}

export const getSpell = (id) => spells.get(id) ?? null;
export const allSpells = () => [...spells.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
export const knowsSpell = (id) => spells.has(id) && hasItem(id);
export const knownSpells = () => allSpells().filter((s) => hasItem(s.id));

// Learn a spell: owned, on the ring, +1 max magic (and a refill). True the first time.
export function learnSpell(id) {
  if (!spells.has(id)) throw new Error(`Unknown spell "${id}"`);
  if (hasItem(id)) return false;
  giveItem(id);
  addMaxMagic(TUNING.progression.spellMagic, { reason: 'spell' });
  emit('spell-learned', { id });
  return true;
}

export function spellCost(id) {
  const s = spells.get(id);
  if (!s) throw new Error(`Unknown spell "${id}"`);
  let cost = hasTrait('focus') ? s.cost[1] : s.cost[0];
  const blade = bladeStats();
  if (blade.specialKind === 'thrift') cost -= Math.floor(blade.special / 2);
  return Math.max(1, cost);
}

export function castSpell(id, { force = false } = {}) {
  const s = spells.get(id);
  if (!s || !getItem(id)) return 'unknown';
  if (!force && !hero.canAct()) return 'blocked';
  const cost = spellCost(id);
  if (state.magic < cost) return 'no-magic';
  if (s.cast({ spell: s, cost, hero }) === false) return 'failed'; // nothing spent
  spendMagic(cost, 'spell');
  const at = hero.position();
  emit('spell-cast', { id, cost, x: at.x, z: at.z });
  return 'cast';
}
