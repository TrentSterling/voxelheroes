// The items stream's pickups (CONTRACTS 8.6): `bomb-1` (one bomb, only for
// a hero who owns bombs: the drop tables check), `heart-container` (never
// despawns; the boss's prize, an item get) and `token` (the rares' prize).
import { sfx } from '../../core/audio.js';
import { TUNING } from '../../core/tuning.js';
import { bombModel, heartContainerModel, tokenModel } from '../../models/items/items.js';
import { grant } from '../../systems/grants.js';
import { Pickup } from '../pickup.js';
import { registerEntity } from '../registry.js';

class BombPickup extends Pickup {
  constructor(opts) {
    super({ life: TUNING.pickups.life, ...opts }, bombModel(0));
  }
  collect() {
    grant('bombs', TUNING.items.bomb.pickup, { source: 'pickup', fanfare: false });
    sfx.gem();
  }
}
registerEntity('bomb-1', (opts) => new BombPickup(opts));

class HeartContainerPickup extends Pickup {
  constructor(opts) {
    super({ ...opts, life: Infinity, r: 0.4 }, heartContainerModel());
  }
  collect() {
    grant('heart-container', 1, { source: 'boss' });
  }
}
registerEntity('heart-container', (opts) => new HeartContainerPickup(opts));

class TokenPickup extends Pickup {
  constructor(opts) {
    super({ life: TUNING.pickups.bossDropLife, ...opts }, tokenModel());
  }
  collect() {
    grant('token', 1, { source: 'pickup' });
  }
}
registerEntity('token', (opts) => new TokenPickup(opts));
