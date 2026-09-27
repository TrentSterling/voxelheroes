// Currency. 'gem' is worth 1 (green), 'gem5' is worth 5 (blue).
import { sfx } from '../../core/audio.js';
import { gemModel } from '../../models/pickups.js';
import { grant } from '../../systems/grants.js';
import { Pickup } from '../pickup.js';
import { registerEntity } from '../registry.js';

export const GEM_COLORS = { 1: 0x2fd36b, 5: 0x3a8ff0 };

export class GemPickup extends Pickup {
  constructor(opts) {
    const value = opts.value ?? 1;
    super(opts, gemModel(GEM_COLORS[value] ? value : 1));
    this.value = value;
  }

  collect() {
    grant('gems', this.value);
    sfx.gem();
  }
}

registerEntity('gem', (opts) => new GemPickup(opts));
registerEntity('gem5', (opts) => new GemPickup({ ...opts, value: 5 }));
