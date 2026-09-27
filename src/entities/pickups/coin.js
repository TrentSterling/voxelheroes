// Coins worth 1, 10 and 100 (gameplay spec 10.3). Placeholder looks until
// look builds the coin kit; the items stream owns this file in M2.
import { sfx } from '../../core/audio.js';
import { TUNING } from '../../core/tuning.js';
import * as pickupModels from '../../models/pickups.js';
import { grant } from '../../systems/grants.js';
import { Pickup } from '../pickup.js';
import { registerEntity } from '../registry.js';

export const COIN_COLORS = { 1: 0xc98a3c, 10: 0xcfd6dc, 100: 0xf1c232 };

// A stand-in look for coins and magic gems. On main models/pickups.js has
// gemGeometry(color) (the M1 gem, recoloured); the look-kits branch replaces
// it with models (coinModel(), gemModel(value)) that its Pickup takes. The
// helpers are looked up by name so this file builds against either.
const modelFn = (name) => (typeof pickupModels[name] === 'function' ? pickupModels[name] : null);
export function placeholderLook(kind, color) {
  const geometry = modelFn('gemGeometry');
  if (geometry) return geometry(color);
  if (kind === 'coin' && modelFn('coinModel')) return modelFn('coinModel')();
  return modelFn('gemModel')(kind === 'magic' ? 5 : 1);
}

export class CoinPickup extends Pickup {
  constructor(opts) {
    const value = opts.value ?? 1;
    super({ life: TUNING.pickups.life, ...opts }, placeholderLook('coin', COIN_COLORS[value] ?? COIN_COLORS[1]));
    this.value = value;
  }

  collect() {
    grant('coins', this.value, { source: 'pickup' });
    sfx.gem();
  }
}

for (const v of [1, 10, 100]) registerEntity(`coin-${v}`, (opts) => new CoinPickup({ ...opts, value: v }));
