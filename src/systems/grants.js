// Things the hero can be given: by chests, shops, NPCs, bosses, or the test
// hook's give(). Each grant is a function (amount, ctx) that applies it.
//
//   registerGrant('bombs', (n) => addAmmo('bombs', n));
//   registerGrant('shield-2', () => { state.gear.shield = 2; }, { name: 'Rivet Shield', fanfare: true });
//   grant('heart-container');                            // from a chest
//   grant({ grant: 'coins', amount: 100 });              // chest contents can be objects
//   grant('blade-2', 1, { source: 'pedestal' });         // ctx is passed on
//
// meta (optional): { name, fanfare, text, kind, model }. A fanfare grant is
// an item get (gameplay spec 12.2): after it is applied, 'item-get' { id,
// amount, name, text, source, model } is emitted and the item-get presenter
// shows it. model is a function returning a THREE.Object3D (built with
// look's kit in the owner's models/<stream>/*): the prize the hero holds
// overhead during the cheer; null until its owner makes one. The
// default presenter is the M1 banner; the ui stream replaces it with the
// cheer pose and a dialog line (setItemGetPresenter). text is a string or
// (amount, ctx) => string, read after the grant is applied. ctx.source says
// where it came from ('chest', 'shop', 'npc', 'boss', 'pickup', ...; null for
// scripts and tests), and ctx.fanfare === false (or the M1 ctx.banner ===
// false) makes any grant quiet.
//
// Registered items (src/items) are grantable by id with no extra code; a new
// item is an item get unless its registerItem def says fanfare: false (its
// registerItem `model` is the prize model). Core grants: coins (and the M1
// names gems, gem), heart (TUNING.pickups.heart units each), magic
// (TUNING.pickups.magic gems each), key, heart-container, heart-piece,
// magic-container, token. docs/CONTRACTS.md lists every grant id and its
// owner.
//
// This module imports only core modules, the banner, keys and game/vitals.js
// (M1 systems and the game modules import it).
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { TUNING } from '../core/tuning.js';
import { showBanner } from '../ui/banner.js';
import { getItem } from '../items/registry.js';
import { addKeys } from './keys.js';
import * as vitals from '../game/vitals.js';

const grants = new Map(); // id -> { fn, meta }
let fallback = null;

export function registerGrant(id, fn, meta = {}) {
  if (grants.has(id)) throw new Error(`Grant "${id}" is already registered`);
  if (typeof fn !== 'function') throw new Error(`Grant "${id}" needs a function`);
  if (meta.model != null && typeof meta.model !== 'function') throw new Error(`Grant "${id}": model must be a function returning a THREE.Object3D`);
  grants.set(id, { fn, meta: { name: id, fanfare: false, model: null, ...meta } });
}

// Used by the item registry: grant(id) for any registered item.
export function setGrantFallback(fn) {
  fallback = fn;
}

// ---------------------------------------------------------------- item gets
const bannerPresenter = (get) => {
  if (get.text) showBanner(get.text);
};
let presenter = bannerPresenter;

// fn(get) shows an item get ({ id, amount, name, text, source, model }). null
// puts the banner back.
export function setItemGetPresenter(fn) {
  presenter = fn ?? bannerPresenter;
}

function announce(id, amount, meta, ctx) {
  if (ctx.fanfare === false || ctx.banner === false) return;
  const text = typeof meta.text === 'function' ? meta.text(amount, ctx) : meta.text ?? `${meta.name}!`;
  const get = { id, amount, name: meta.name, text, source: ctx.source ?? null, model: meta.model ?? null };
  emit('item-get', get);
  presenter(get);
}

// ---------------------------------------------------------------- granting
export function grant(what, amount = 1, ctx = {}) {
  if (what && typeof what === 'object') return grant(what.grant, what.amount ?? 1, { ...ctx, ...what });
  const g = grants.get(what);
  if (g) {
    g.fn(amount, ctx);
    if (g.meta.fanfare || ctx.fanfare === true) announce(what, amount, g.meta, ctx);
    return true;
  }
  const item = getItem(what);
  const isNew = !!item && !state.inventory?.owned?.includes(what);
  if (fallback && fallback(what, amount, ctx)) {
    if (isNew && item.fanfare !== false) announce(what, amount, { name: item.name, text: item.getText, model: item.model ?? null }, ctx);
    return true;
  }
  console.warn(`grant: nothing called "${what}"`);
  return false;
}

export const grantIds = () => [...grants.keys()];
export const hasGrant = (id) => grants.has(id) || !!getItem(id);

// { name, fanfare, text, kind, model } of a grant (registered items included), or null.
export function grantMeta(id) {
  const g = grants.get(id);
  if (g) return { ...g.meta };
  const item = getItem(id);
  return item ? { name: item.name, fanfare: item.fanfare !== false, text: item.getText, kind: item.kind ?? 'item', model: item.model ?? null } : null;
}

// ---------------------------------------------------------------- core grants
const coins = (n) => vitals.addCoins(n, 'grant');
registerGrant('coins', coins, { name: 'Coins', kind: 'money' });
registerGrant('gems', coins, { name: 'Coins', kind: 'money' }); // M1 name
registerGrant('gem', coins, { name: 'Coins', kind: 'money' }); // M1 name
// A heart restores TUNING.pickups.heart units and a magic jar TUNING.pickups.magic
// gems, whether it is picked up, bought or found in a chest.
registerGrant('heart', (n) => vitals.heal(TUNING.pickups.heart * n, 'heart'), { name: 'Heart', kind: 'life' });
registerGrant('magic', (n) => vitals.restoreMagic(TUNING.pickups.magic * n, 'magic'), { name: 'Magic', kind: 'magic' });
registerGrant('key', (n) => addKeys(n), { name: 'Small Key', kind: 'key' });
registerGrant('heart-container', (n) => vitals.addMaxLife(vitals.UNITS_PER_HEART * n, { reason: 'heart-container' }), {
  name: 'Heart Container',
  fanfare: true,
  kind: 'life',
  text: 'Heart container! Max health up',
});
registerGrant('heart-piece', (n) => vitals.addHeartPiece(n), {
  name: 'Heart Piece',
  fanfare: true,
  kind: 'life',
  text: () => {
    const left = vitals.heartPiecesTowardNext();
    return left === 0 ? 'Heart piece! A new heart' : `Heart piece! ${left} of ${TUNING.progression.piecesPerHeart} toward a heart`;
  },
});
registerGrant('magic-container', (n) => vitals.addMaxMagic(n, { reason: 'magic-container' }), {
  name: 'Magic Container',
  fanfare: true,
  kind: 'magic',
  text: 'Magic container! Max magic up',
});
registerGrant('token', (n) => vitals.addTokens(n), { name: 'Sword Token', fanfare: true, kind: 'token', text: 'A sword token' });
