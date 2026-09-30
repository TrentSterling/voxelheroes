import { DenseGrid } from '../../core/vox.js';
import { model } from '../../models/kit.js';
import { findErrandObject } from '../../game/errands.js';
import { Pickup } from '../pickup.js';
import { registerEntity } from '../registry.js';
import { player } from '../player.js';

const locket = () => model('quest-locket', () => {
  const grid = new DenseGrid(10, 12, 5);
  grid.ellipsoid(5, 5, 2.5, 4, 4, 2, 0xdab057);
  grid.box(4, 8, 2, 6, 11, 4, 0xf5d783);
  grid.box(4, 2, 4, 6, 8, 5, 0x528a59);
  grid.box(2, 4, 4, 8, 6, 5, 0x6aa76b);
  return grid;
});
class QuestLocket extends Pickup {
  constructor(opts) {
    super({ ...opts, life: Infinity }, locket());
    this.giver = opts.giver ?? 'Nell'; this.birthSwing = player.swingId;
  }
  canCollect(by) { return by === 'party' || (this.t > 0.25 && (by !== 'blade' || player.swingId !== this.birthSwing)); }
  collect() { findErrandObject(this.giver); this.markDone(); }
}
registerEntity('quest-locket', opts => new QuestLocket(opts));
