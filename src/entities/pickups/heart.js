// Recovers one heart.
import { sfx } from '../../core/audio.js';
import { heartModel } from '../../models/pickups.js';
import { grant } from '../../systems/grants.js';
import { Pickup } from '../pickup.js';
import { registerEntity } from '../registry.js';

export class HeartPickup extends Pickup {
  constructor(opts) {
    super(opts, heartModel());
  }

  collect() {
    grant('heart', 1);
    sfx.heart();
  }
}

registerEntity('heart', (opts) => new HeartPickup(opts));
