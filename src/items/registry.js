// Item registry: the sub-items used with the B button. One file per item in
// src/items/ (loaded automatically), for example src/items/bombs.js:
//
//   registerItem({
//     id: 'bombs',
//     name: 'Bombs',
//     icon: '<svg viewBox="0 0 8 8">...</svg>',  // pixel icon for HUD and menus
//     order: 20,                                 // position in the item list
//     ammo: 'bombs',                             // counter in state.inventory.ammo
//     maxAmmo: 10,                               // or (state) => number (bag upgrades)
//     startAmmo: 5,                              // given with the item
//     use(ctx) {                                 // B pressed; return true if used
//       if (!ctx.useAmmo(1)) return false;
//       ctx.spawn('bomb', { x: ctx.player.x, z: ctx.player.z });
//       return true;
//     },
//   });
//
// use(ctx) gets { item, player, state, world, spawn, useAmmo(n), ammo() }.
// Optional: update(dt, ctx) runs every play frame while the item is owned
// (a lit lantern), passive: true for owned-but-not-selectable items.
// Nothing is registered in M1: the B button and its HUD slot stay hidden
// until the inventory holds something.

const items = new Map();

export function registerItem(def) {
  if (!def?.id) throw new Error('registerItem: an item needs an id');
  if (items.has(def.id)) throw new Error(`Item "${def.id}" is already registered`);
  if (!def.passive && typeof def.use !== 'function') throw new Error(`Item "${def.id}" needs use(ctx) (or passive: true)`);
  const full = { name: def.id, icon: '', order: 100, ammo: null, maxAmmo: 99, startAmmo: 0, passive: false, ...def };
  items.set(def.id, full);
  return full;
}

export const getItem = (id) => items.get(id) ?? null;

export const allItems = () => [...items.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

// Ammo counter names used by any registered item.
export const ammoKeys = () => [...new Set(allItems().map((i) => i.ammo).filter(Boolean))];
