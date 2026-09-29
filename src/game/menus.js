// Menus that one stream opens and another draws: the shop list, the counter
// (buying one thing on a shop counter), the blacksmith, the inn and the warp
// feather's list. Shopkeepers, shop counters, the smith and innkeepers
// (overworld) and the warp feather (items) open them by id; the ui stream
// draws the real screens and registers them in M2. Each has a dialog
// fallback, so buying works from the first day of M2, and tests reach the
// fallback on purpose with { fallback: true } once a screen is registered.
//
//   await openMenu('shop', { shop: 'v1-shop', speaker: 'Mags' })     resolves when the hero leaves
//   await openMenu('counter', { shop: 'v1-shop', entry: 'bow' })       -> true if he bought it
//   await openMenu('smith', { speaker: 'Brannoc' })                   levels for the equipped sword
//                                                                     ({ sword } for another owned one)
//   await openMenu('inn', { inn: 'inn-1', speaker: 'Tamsin' })        -> true if he stayed the night
//   await openMenu('warp', { kinds: ['village', 'inn', 'dungeon'] })   -> the place picked (places.js), or undefined
//   await openMenu('shop', args, { fallback: true })                  the dialog fallback even when a screen is registered
//   registerMenu('shop', async ({ shop, speaker }) => { ... })        the ui's screen replaces the fallback
//   registerFallback('probe-menu', async (args) => { ... })            a dialog fallback for a new id (tests, stand-ins)
//
// open(args) returns a promise; it settles when the menu closes, with what
// the menu reports (the inn and the counter: whether he stayed or bought;
// the warp list: the place; the others: undefined). A screen is a mode
// pushed over play (core/modes.js), so play waits, as it does for a dialog.
// The data and the buying live in the registries (shops.js shopEntries /
// buy, swords.js swordStars / canBuyLevel / buyLevel / resetSword,
// services.js innRest, places.js warpPlaces); a menu only shows them and
// calls them. Each id takes one registerMenu and one registerFallback; new
// ids (a token trader) need no fallback.
import { showDialog, ask } from '../ui/dialog.js';
import { getShop, shopEntries, buy } from './shops.js';
import { getInn, innRest } from './services.js';
import { SWORD_STATS, equippedId, getSword, hasSword, swordStars, levelPrice, buyLevel, resetSword, spentOn } from './swords.js';
import { warpPlaces } from './places.js';

const menus = new Map(); // id -> { open, fallback }

export function registerMenu(id, open) {
  if (typeof open !== 'function') throw new Error(`registerMenu("${id}"): open(args) must be a function`);
  const m = menus.get(id);
  if (m?.open) throw new Error(`Menu "${id}" is already registered`);
  menus.set(id, { fallback: m?.fallback ?? null, open });
}

// The dialog stand-in for an id: it answers until a screen is registered,
// and after that only for openMenu(id, args, { fallback: true }).
export function registerFallback(id, fn) {
  if (typeof fn !== 'function') throw new Error(`registerFallback("${id}"): fn(args) must be a function`);
  const m = menus.get(id);
  if (m?.fallback) throw new Error(`Menu "${id}" already has a fallback`);
  menus.set(id, { open: m?.open ?? null, fallback: fn });
}

export function openMenu(id, args = {}, { fallback = false } = {}) {
  const m = menus.get(id);
  const fn = fallback ? m?.fallback : m?.open ?? m?.fallback;
  if (!fn) throw new Error(fallback ? `Menu "${id}" has no fallback` : `Unknown menu "${id}" (${[...menus.keys()].join(', ')})`);
  return Promise.resolve(fn(args));
}

export const hasMenu = (id) => menus.has(id);
export const menuIds = () => [...menus.keys()];
// True while only the dialog fallback answers for `id`.
export const usesFallback = (id) => !!menus.get(id) && !menus.get(id).open;
export const hasFallback = (id) => !!menus.get(id)?.fallback;

// What a refusal sounds like in the fallbacks (a can() reason of a shop's
// own, like 'no-bottle', is shown as is unless listed here).
export const REFUSALS = {
  coins: 'You are short of coins.',
  'sold-out': 'That is all gone.',
  unavailable: 'Not today.',
  'no-bottle': 'You need an empty bottle for that.',
  max: 'This blade will not take more of that.',
  budget: 'This blade has taken all the work it can.',
  'not-sold': 'That is not something I can do to this blade.',
  'not-owned': 'Bring me the blade first.',
  unknown: 'Not today.',
};
export const refusal = (reason) => REFUSALS[reason] ?? `Not now (${reason}).`;

// What the smith says after a level lands (fun audit: buying coins felt like
// nothing happened). Keyed by stat; a stat with no line here still gets a
// plain one.
const SMITH_LINES = {
  length: 'There. A longer reach for you.',
  width: 'Broader steel now; it should bite wider.',
  strength: 'Ground hard. That will hit harder.',
  spin: 'Balanced up nicely for the spin.',
  beam: 'That edge should throw a truer beam.',
  pierce: 'It should punch clean through, now.',
  special: 'There. That ought to do something new.',
};
const smithLine = (stat) => SMITH_LINES[stat] ?? 'There, that should help.';

// ---------------------------------------------------------------- fallbacks
registerFallback('shop', async ({ shop, speaker = null } = {}) => {
  const s = getShop(shop);
  if (!s) throw new Error(`openMenu('shop'): unknown shop "${shop}"`);
  for (;;) {
    const list = shopEntries(shop);
    const pick = await ask(`${s.name}. What will it be?`, [...list.map((e) => `${e.name} ${e.price}`), 'Leave'], { speaker });
    if (pick === undefined || pick >= list.length) return undefined;
    const r = buy(shop, list[pick].id);
    if (!r.ok) await showDialog(refusal(r.reason), { speaker });
  }
});

// One thing on a shop counter (gameplay spec 5.6): face it, press A, yes or no.
registerFallback('counter', async ({ shop, entry, speaker = null } = {}) => {
  if (!getShop(shop)) throw new Error(`openMenu('counter'): unknown shop "${shop}"`);
  const e = shopEntries(shop).find((x) => x.id === entry);
  if (!e) throw new Error(`openMenu('counter'): shop "${shop}" has no entry "${entry}"`);
  const pick = await ask(`${e.name} for ${e.price}?`, ['Buy', 'No'], { speaker });
  if (pick !== 0) return false;
  const r = buy(shop, entry);
  if (!r.ok) await showDialog(refusal(r.reason), { speaker });
  return r.ok;
});

registerFallback('smith', async ({ speaker = null, sword = equippedId() } = {}) => {
  if (!getSword(sword) || !hasSword(sword)) {
    await showDialog(refusal('not-owned'), { speaker });
    return undefined;
  }
  const name = getSword(sword).name;
  // The line he opens with; a bought level swaps it for a reaction to that
  // stat until he is asked again (fun audit: buying coins felt like nothing
  // happened). Kept as the next prompt, not an extra dialog, so buying stays
  // one beat: pick a level, see the shelf update.
  let greeting = `The ${name}. What shall I work on?`;
  for (;;) {
    const stars = swordStars(sword);
    const sold = SWORD_STATS.filter((k) => levelPrice(sword, k) !== null);
    if (!sold.length) {
      await showDialog(`There is nothing I can add to the ${name}.`, { speaker });
      return undefined;
    }
    const choices = [...sold.map((k) => `${k} ${stars[k].level}/${stars[k].max}: ${levelPrice(sword, k)}`), 'Reset', 'Leave'];
    const pick = await ask(greeting, choices, { speaker });
    if (pick === undefined || pick === sold.length + 1) return undefined;
    if (pick === sold.length) {
      const sure = await ask(`Back to how it was made? The ${spentOn(sword)} coins you spent on it are gone for good.`, ['Reset', 'Keep it'], { speaker });
      if (sure === 0) resetSword(sword);
      greeting = `The ${name}. What shall I work on?`;
      continue;
    }
    const r = buyLevel(sword, sold[pick]);
    if (!r.ok) await showDialog(refusal(r.reason), { speaker });
    greeting = r.ok ? smithLine(sold[pick]) : `The ${name}. What shall I work on?`;
  }
});

registerFallback('inn', async ({ inn, speaker = null, price } = {}) => {
  const i = getInn(inn);
  if (!i) throw new Error(`openMenu('inn'): unknown inn "${inn}"`);
  const cost = price ?? i.price;
  const pick = await ask(`${i.name}. A bed is ${cost} coins a night. Will you stay?`, ['Stay', 'Leave'], { speaker });
  if (pick !== 0) return false;
  const r = innRest(inn, { price: cost });
  if (!r.ok) {
    await showDialog(refusal(r.reason), { speaker });
    return false;
  }
  await showDialog('Sleep well. You wake here if you fall.', { speaker });
  return true;
});

// The warp feather's list: visited places of the given kinds. Returns the
// place ({ id, name, kind, spot }); the caller warps (hero.warp(place.spot)).
registerFallback('warp', async ({ kinds, speaker = null } = {}) => {
  const list = warpPlaces(kinds);
  if (!list.length) {
    await showDialog('There is nowhere to go yet.', { speaker });
    return undefined;
  }
  const pick = await ask('Where to?', [...list.map((p) => p.name), 'Stay'], { speaker });
  return pick === undefined || pick >= list.length ? undefined : list[pick];
});
