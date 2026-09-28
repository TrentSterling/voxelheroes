// Mossbrook's shop and inn (overworld stream; gameplay spec 10.4, tier 1).
import { registerShop } from '../game/shops.js';
import { registerInn } from '../game/services.js';
import { TUNING } from '../core/tuning.js';

registerShop({
  id: 'v1-shop',
  name: 'Tallow & Twine',
  place: 'v1',
  tier: 1,
  entries: [
    { id: 'heart', grant: 'heart', price: 5 },
    { id: 'magic', grant: 'magic', price: 10 },
    { id: 'bombs', grant: 'bombs', price: 30, stock: 1 }, // the bag and 10 bombs (the items registry's grant fallback)
    { id: 'key-red', grant: 'key-red', price: 1000, stock: 1 },
  ],
});

registerInn({ id: 'inn-1', name: 'The Mossy Kettle', place: 'inn-1', price: TUNING.economy.inn[0], bed: { area: 'v1', screen: [1, 1], x: 5.5, z: 10, yaw: 0 } });
