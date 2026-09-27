// Shops: one file per shop in src/shops/ (overworld stream). A shop is a list
// of entries that pay out through grants, so anything grantable can be sold.
//
//   registerShop({
//     id: 'v1-shop',
//     name: 'Tallow & Twine',
//     place: 'v1',                          // place id (gameplay spec Appendix B)
//     tier: 1,                              // price tier (spec 10.4)
//     entries: [
//       { id: 'heart', grant: 'heart', price: 5 },
//       { id: 'arrows-10', grant: 'arrows', amount: 10, price: 8, when: () => hasFlag('boss:d1') },
//       { id: 'bow', grant: 'bow', price: 30, stock: 1 },
//       { id: 'potion-life', grant: 'potion-life', price: 80, can: () => hasEmptyBottle() || 'no-bottle' },
//     ],
//   });
//
// Entry fields: id (unique in the shop), grant (a grant id) and amount
// (default 1), price in coins, name (default: the grant's name), stock (how
// many can ever be bought; default unlimited), when() (false: not on the
// shelf), can() (true, or a reason string: not buyable right now).
//
//   shopEntries('v1-shop') -> the entries on the shelf, each with { price, left, ok, reason }
//   buy('v1-shop', 'bow')  -> { ok, reason: null | 'coins' | 'sold-out' | 'unavailable' | <can() reason>, price }
//                             pays, grants (ctx.source 'shop'), counts stock, 'shop-buy'
// Bought counts are saved in state.shops.
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { grant, grantMeta } from '../systems/grants.js';
import { canAfford, spendCoins } from './vitals.js';
import './fields.js';

const shops = new Map();

export function registerShop(def) {
  if (!def?.id) throw new Error('registerShop: a shop needs an id');
  if (shops.has(def.id)) throw new Error(`Shop "${def.id}" is already registered`);
  const ids = new Set();
  const entries = (def.entries ?? []).map((e) => {
    if (!e?.id || !e.grant) throw new Error(`Shop "${def.id}": every entry needs an id and a grant`);
    if (ids.has(e.id)) throw new Error(`Shop "${def.id}": entry "${e.id}" appears twice`);
    if (!(Number.isFinite(e.price) && e.price >= 0)) throw new Error(`Shop "${def.id}" entry "${e.id}": price must be 0 or more coins`);
    ids.add(e.id);
    return { amount: 1, stock: Infinity, ...e };
  });
  const full = { name: def.id, place: null, tier: 1, ...def, entries };
  shops.set(def.id, full);
  return full;
}

export const getShop = (id) => shops.get(id) ?? null;
export const allShops = () => [...shops.values()];

const boughtCount = (shopId, entryId) => state.shops[shopId]?.[entryId] ?? 0;

function status(shop, e) {
  const left = e.stock === Infinity ? Infinity : Math.max(0, e.stock - boughtCount(shop.id, e.id));
  let reason = null;
  if (e.when && !e.when()) reason = 'unavailable';
  else if (left <= 0) reason = 'sold-out';
  else {
    const can = e.can ? e.can() : true;
    if (can !== true) reason = typeof can === 'string' ? can : 'unavailable';
    else if (!canAfford(e.price)) reason = 'coins';
  }
  return { left, ok: reason === null, reason };
}

// The entries on the shelf now (when() true), with what the menu shows.
export function shopEntries(shopId) {
  const shop = shops.get(shopId);
  if (!shop) throw new Error(`Unknown shop "${shopId}"`);
  return shop.entries
    .filter((e) => !e.when || e.when())
    .map((e) => ({ ...e, name: e.name ?? grantMeta(e.grant)?.name ?? e.grant, ...status(shop, e) }));
}

export function buy(shopId, entryId) {
  const shop = shops.get(shopId);
  if (!shop) throw new Error(`Unknown shop "${shopId}"`);
  const e = shop.entries.find((x) => x.id === entryId);
  if (!e) throw new Error(`Shop "${shopId}" has no entry "${entryId}"`);
  const s = status(shop, e);
  if (!s.ok) return { ok: false, reason: s.reason, price: e.price };
  spendCoins(e.price, 'shop');
  (state.shops[shop.id] ??= {})[e.id] = boughtCount(shop.id, e.id) + 1;
  grant(e.grant, e.amount, { source: 'shop', shop: shop.id });
  emit('shop-buy', { shop: shop.id, entry: e.id, price: e.price });
  return { ok: true, reason: null, price: e.price };
}
