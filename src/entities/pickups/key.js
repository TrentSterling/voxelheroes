// A small key for the dungeon it was found in. Never despawns; spawned with
// `once: true` it does not come back after being taken.
import { sfx } from '../../core/audio.js';
import { keyGeometry } from '../../models/pickups.js';
import { grant } from '../../systems/grants.js';
import { showBanner } from '../../ui/banner.js';
import { Pickup } from '../pickup.js';
import { registerEntity } from '../registry.js';

export class KeyPickup extends Pickup {
  constructor(opts) {
    super({ ...opts, life: Infinity }, keyGeometry());
  }

  collect() {
    grant('key', 1);
    this.markDone();
    sfx.fanfare();
    showBanner('Found a small key');
  }
}

registerEntity('key', (opts) => new KeyPickup(opts));
