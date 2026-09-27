// A magic gem: restores TUNING.pickups.magic (gameplay spec 10.2). Casters
// always drop one. Placeholder model; the items stream owns this file in M2.
import { sfx } from '../../core/audio.js';
import { TUNING } from '../../core/tuning.js';
import { grant } from '../../systems/grants.js';
import { Pickup } from '../pickup.js';
import { registerEntity } from '../registry.js';
import { placeholderLook } from './coin.js';

export class MagicPickup extends Pickup {
  constructor(opts) {
    super({ life: TUNING.pickups.life, ...opts }, placeholderLook('magic', 0x9b59d0));
  }

  collect() {
    grant('magic', TUNING.pickups.magic, { source: 'pickup' });
    sfx.gem();
  }
}

registerEntity('magic', (opts) => new MagicPickup(opts));
