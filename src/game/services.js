// Services: inns (overworld stream) and resting in the open (bedrolls and
// the tent, items stream). A night refills and moves the respawn point
// (gameplay spec 9.3, 10.4, 11).
//
//   registerInn({
//     id: 'inn-1', name: 'The Tarred Keel', place: 'inn-1',
//     price: TUNING.economy.inn[0],                                     // coins a night
//     bed: { area: 'inn-1', screen: [0, 0], x: 5, z: 4, yaw: 0 },       // where the hero gets up
//   });
//   innRest('inn-1')           -> { ok, reason: null | 'coins' | 'unknown', price }
//                                 pays, full life and magic, respawn at the bed, 'inn-rest'
//   restHere({ life, magic })  a bedroll (life), magic bedroll (magic) or tent (both):
//                                 refill and respawn where the hero stands; free
import { emit } from '../core/events.js';
import { spendCoins, refill } from './vitals.js';
import { setRespawn, spotHere } from './places.js';

const inns = new Map();

export function registerInn(def) {
  if (!def?.id) throw new Error('registerInn: an inn needs an id');
  if (inns.has(def.id)) throw new Error(`Inn "${def.id}" is already registered`);
  if (!(Number.isFinite(def.price) && def.price >= 0)) throw new Error(`Inn "${def.id}": price must be 0 or more coins`);
  const full = { name: def.id, place: def.id, bed: null, ...def };
  inns.set(def.id, full);
  return full;
}

export const getInn = (id) => inns.get(id) ?? null;
export const allInns = () => [...inns.values()];

export function innRest(id, { price } = {}) {
  const inn = inns.get(id);
  if (!inn) return { ok: false, reason: 'unknown', price: price ?? 0 };
  const cost = price ?? inn.price; // an innkeeper who drops the price passes it
  if (!spendCoins(cost, 'inn')) return { ok: false, reason: 'coins', price: cost };
  refill({ reason: 'inn' });
  setRespawn(inn.bed ?? spotHere());
  emit('inn-rest', { inn: id, price: cost });
  return { ok: true, reason: null, price: cost };
}

export function restHere({ life = true, magic = true } = {}) {
  refill({ life, magic, reason: 'rest' });
  return setRespawn(spotHere());
}
