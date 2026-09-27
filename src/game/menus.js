// Menus that one stream opens and another draws: the shop list, the
// blacksmith and the inn. Shopkeepers, the smith and innkeepers (overworld
// NPCs) open them by id; the ui stream draws the real screens and registers
// them. Until it does, each has a dialog fallback, so buying works from the
// first day of M2.
//
//   await openMenu('shop', { shop: 'v1-shop', speaker: 'Mags' })     resolves when the hero leaves
//   await openMenu('smith', { speaker: 'Brannoc' })                   levels for the equipped sword
//                                                                     ({ sword } for another owned one)
//   await openMenu('inn', { inn: 'inn-1', speaker: 'Tamsin' })        -> true if he stayed the night
//   registerMenu('shop', async ({ shop, speaker }) => { ... })        the ui's screen replaces the fallback
//
// open(args) returns a promise; it settles when the menu closes, with what
// the menu reports (the inn: whether he stayed; the others: undefined). A
// screen is a mode pushed over play (core/modes.js), so play waits, as it
// does for a dialog. The data and the buying live in the registries
// (shops.js shopEntries / buy, swords.js swordStars / canBuyLevel / buyLevel
// / resetSword, services.js innRest); a menu only shows them and calls them.
// Each id takes one registerMenu besides its fallback; new ids (a token
// trader) need no fallback.
import { showDialog, ask } from '../ui/dialog.js';
import { getShop, shopEntries, buy } from './shops.js';
import { getInn, innRest } from './services.js';
import { SWORD_STATS, equippedId, getSword, hasSword, swordStars, levelPrice, buyLevel, resetSword, spentOn } from './swords.js';

const menus = new Map(); // id -> { open, fallback }

export function registerMenu(id, open) {
  if (typeof open !== 'function') throw new Error(`registerMenu("${id}"): open(args) must be a function`);
  const m = menus.get(id);
  if (m?.open) throw new Error(`Menu "${id}" is already registered`);
  menus.set(id, { fallback: m?.fallback ?? null, open });
}

export function openMenu(id, args = {}) {
  const m = menus.get(id);
  const fn = m?.open ?? m?.fallback;
  if (!fn) throw new Error(`Unknown menu "${id}" (${[...menus.keys()].join(', ')})`);
  return Promise.resolve(fn(args));
}

export const hasMenu = (id) => menus.has(id);
export const menuIds = () => [...menus.keys()];
// True while only the dialog fallback answers for `id`.
export const usesFallback = (id) => !!menus.get(id) && !menus.get(id).open;

function fallback(id, fn) {
  menus.set(id, { fallback: fn, open: null });
}

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
const refusal = (reason) => REFUSALS[reason] ?? `Not now (${reason}).`;

// ---------------------------------------------------------------- fallbacks
fallback('shop', async ({ shop, speaker = null } = {}) => {
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

fallback('smith', async ({ speaker = null, sword = equippedId() } = {}) => {
  if (!getSword(sword) || !hasSword(sword)) {
    await showDialog(refusal('not-owned'), { speaker });
    return undefined;
  }
  const name = getSword(sword).name;
  for (;;) {
    const stars = swordStars(sword);
    const sold = SWORD_STATS.filter((k) => levelPrice(sword, k) !== null);
    if (!sold.length) {
      await showDialog(`There is nothing I can add to the ${name}.`, { speaker });
      return undefined;
    }
    const choices = [...sold.map((k) => `${k} ${stars[k].level}/${stars[k].max}: ${levelPrice(sword, k)}`), 'Reset', 'Leave'];
    const pick = await ask(`The ${name}. What shall I work on?`, choices, { speaker });
    if (pick === undefined || pick === sold.length + 1) return undefined;
    if (pick === sold.length) {
      const sure = await ask(`Back to how it was made? The ${spentOn(sword)} coins you spent on it are gone for good.`, ['Reset', 'Keep it'], { speaker });
      if (sure === 0) resetSword(sword);
      continue;
    }
    const r = buyLevel(sword, sold[pick]);
    if (!r.ok) await showDialog(refusal(r.reason), { speaker });
  }
});

fallback('inn', async ({ inn, speaker = null, price } = {}) => {
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
