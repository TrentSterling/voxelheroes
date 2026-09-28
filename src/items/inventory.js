// What the hero carries: owned items, ammo counters, the item on B.
//
//   giveItem('bow')        own it (plus its startAmmo)
//   addAmmo('arrows', 10)  clamped to the item's maxAmmo
//   useAmmo('arrows', 1)   -> false if there is not enough
//   cycleItem(1)           next item on the quick ring (E / Q keys)
//   setOnRing('book', false)  take an item off the quick ring (the inventory's
//                          "E" tags, gameplay spec 9.1); ringItems() lists the ring
//
// state.inventory = { owned: ['bow'], ammo: { arrows: 10 }, selected: 'bow',
// off: [] } is saved with the game (defineState); off lists owned items taken
// off the ring (saves without it read as none). grant(id, n) / the test hook's give()
// work for every item id and ammo counter: grant('bow') gives the bow (with
// its startAmmo), grant('arrows', 10) adds ammo. When an item's id is also
// its ammo counter (bombs), the first grant gives the item and later ones
// add n ammo.
import { state, defineState } from '../core/state.js';
import { emit } from '../core/events.js';
import { TUNING } from '../core/tuning.js';
import { world } from '../world/world.js';
import { spawn } from '../entities/manager.js';
import { setGrantFallback } from '../systems/grants.js';
import { getItem, allItems, ammoKeys } from './registry.js';

defineState('inventory', () => ({ owned: [], ammo: {}, selected: null, off: [] }));

const inv = () => state.inventory;

export const hasItem = (id) => inv().owned.includes(id);

// Owned items in registry order; selectable ones exclude passive items.
export const ownedItems = () => allItems().filter((i) => hasItem(i.id));
export const selectableItems = () => ownedItems().filter((i) => !i.passive);

export const selectedItem = () => (inv().selected ? getItem(inv().selected) : null);

// The quick ring: selectable items not taken off it.
const offRing = () => inv().off ?? [];
export const isOnRing = (id) => hasItem(id) && !getItem(id)?.passive && !offRing().includes(id);
export const ringItems = () => selectableItems().filter((i) => !offRing().includes(i.id));

export function setOnRing(id, on = true) {
  if (!hasItem(id) || getItem(id)?.passive) return false;
  const off = offRing().filter((x) => x !== id);
  if (!on) off.push(id);
  inv().off = off;
  if (!on && inv().selected === id) {
    inv().selected = ringItems()[0]?.id ?? null;
    emit('item-selected', { id: inv().selected });
  }
  return true;
}

export function giveItem(id) {
  const item = getItem(id);
  if (!item) return false;
  if (!hasItem(id)) {
    inv().owned.push(id);
    if (item.ammo) addAmmo(item.ammo, item.startAmmo);
    if (!inv().selected && !item.passive) inv().selected = id;
    emit('item-gained', { id });
  }
  return true;
}

// The largest capacity of the items using this counter. An item's maxAmmo is
// a number or (state) => number, so a bigger bag can come from saved state:
//   defineState('bombBag', () => 1); ... maxAmmo: (s) => 10 * s.bombBag
export function maxAmmo(key) {
  const caps = allItems()
    .filter((i) => i.ammo === key)
    .map((i) => (typeof i.maxAmmo === 'function' ? i.maxAmmo(state) : i.maxAmmo));
  return caps.length ? Math.max(...caps) : Infinity;
}

export const ammo = (key) => inv().ammo[key] ?? 0;

export function addAmmo(key, n) {
  inv().ammo[key] = Math.max(0, Math.min(maxAmmo(key), ammo(key) + n));
}

export function useAmmo(key, n = 1) {
  if (ammo(key) < n) return false;
  inv().ammo[key] -= n;
  return true;
}

export function selectItem(id) {
  if (!hasItem(id) || getItem(id)?.passive) return false;
  inv().selected = id;
  emit('item-selected', { id });
  return true;
}

export function cycleItem(dir) {
  const list = ringItems();
  if (list.length < 2) return;
  const i = list.findIndex((x) => x.id === inv().selected);
  selectItem(list[(i + dir + list.length) % list.length].id);
}

function itemContext(item, player) {
  return {
    item,
    player,
    state,
    world,
    spawn,
    ammo: () => (item.ammo ? ammo(item.ammo) : Infinity),
    useAmmo: (n = 1) => (item.ammo ? useAmmo(item.ammo, n) : true),
  };
}

// B pressed in play mode. Not while the hero cannot act (locked, held, in
// a doorway: hero.canAct), and not within TUNING.items.useLock s of the last
// tool (castLock s of the last spell: gameplay spec 9.1).
// (The gate is hero.canAct, set by items/tools.js: inventory loads before
// the hero module.)
let lockedUntil = -Infinity;
let gate = () => true;
export function setItemGate(fn) {
  gate = fn;
}
export const itemLockLeft = () => Math.max(0, lockedUntil - state.time);
export function useSelectedItem(player) {
  const item = selectedItem();
  if (!item) return false;
  if (!gate() || state.time < lockedUntil - 1e-9) return false;
  const used = !!item.use(itemContext(item, player));
  if (used) {
    lockedUntil = state.time + (item.kind === 'spell' ? TUNING.items.castLock : TUNING.items.useLock);
    emit('item-used', { id: item.id });
  }
  return used;
}

// Per-frame hook for owned items that need one (called from the play mode).
export function updateItems(dt, player) {
  for (const item of ownedItems()) item.update?.(dt, itemContext(item, player));
}

// grant('bow') and grant('arrows', 10) for every registered item and ammo
// counter. An owned item whose id is also an ammo counter gets ammo instead.
setGrantFallback((id, amount) => {
  const item = getItem(id);
  if (item && !hasItem(id)) return giveItem(id);
  if (ammoKeys().includes(id)) {
    addAmmo(id, amount);
    return true;
  }
  return !!item;
});
