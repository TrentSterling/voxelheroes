import { Npc } from '../npc.js';
import { registerEntity } from '../registry.js';
import { hasFlag } from '../../core/state.js';
import { makeMara } from '../../models/mara.js';
import { MARA_TRAVEL, talkToMara } from '../../game/companions.js';

class Mara extends Npc {
  constructor(opts) {
    super(opts, { name: 'Keeper Mara', schedule: 'always', wander: 0, rig: makeMara() });
  }
  update(dt) {
    if (hasFlag(MARA_TRAVEL)) {
      if (this.holder.visible) this.bubble.dispose();
      this.holder.visible = false; this.out = false; this.solid = false; return;
    }
    this.holder.visible = true; this.out = true; this.solid = true; super.update(dt);
  }
  talk() { return talkToMara(); }
}
registerEntity('npc-mara', opts => new Mara(opts));
