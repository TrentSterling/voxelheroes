// Recovers one heart.
import { sfx } from '../../core/audio.js';
import { heartGeometry } from '../../models/pickups.js';
import { grant } from '../../systems/grants.js';
import { Pickup } from '../pickup.js';
import { registerEntity } from '../registry.js';

export class HeartPickup extends Pickup {
  constructor(opts) {
    super(opts, heartGeometry());
  }

  collect() {
    grant('heart', 1);
    sfx.heart();
  }
}

registerEntity('heart', (opts) => new HeartPickup(opts));
