// Things the hero can be given: by chests, shops, NPCs, or the test hook's
// give(). Each grant is a function (amount, ctx) that applies it.
//
//   registerGrant('bombs', (n) => addAmmo('bombs', n));
//   grant('heart-container');            // from a chest
//   grant({ grant: 'gems', amount: 20 }); // chest contents can be objects
//
// Registered items (src/items) are grantable by id with no extra code.
import { state } from '../core/state.js';
import { showBanner } from '../ui/banner.js';
import { addKeys } from './keys.js';

const grants = new Map();
let fallback = null;

export function registerGrant(id, fn) {
  if (grants.has(id)) throw new Error(`Grant "${id}" is already registered`);
  grants.set(id, fn);
}

// Used by the item registry: grant(id) for any registered item.
export function setGrantFallback(fn) {
  fallback = fn;
}

export function grant(what, amount = 1, ctx = {}) {
  if (what && typeof what === 'object') return grant(what.grant, what.amount ?? 1, { ...ctx, ...what });
  const fn = grants.get(what);
  if (fn) {
    fn(amount, ctx);
    return true;
  }
  if (fallback && fallback(what, amount, ctx)) return true;
  console.warn(`grant: nothing called "${what}"`);
  return false;
}

export const grantIds = () => [...grants.keys()];

registerGrant('gems', (n) => {
  state.gems += n;
});
registerGrant('gem', (n) => {
  state.gems += n;
});
registerGrant('heart', (n) => {
  state.hp = Math.min(state.maxHp, state.hp + 2 * n);
});
registerGrant('key', (n) => addKeys(n));
registerGrant('heart-container', (n, ctx) => {
  state.maxHp += 2 * n;
  state.hp = state.maxHp;
  if (ctx.banner !== false) showBanner('Heart container! Max health up');
});
