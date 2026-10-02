import { Projectile } from '../projectile.js';
import { registerEntity } from '../registry.js';
import { TUNING } from '../../core/tuning.js';
import { modelMesh } from '../../models/kit.js';
import { fireBoltModel } from '../../models/items/fire-wand.js';
import { hasItem } from '../../items/inventory.js';
class FireBolt extends Projectile {
  constructor(opts) {
    super(opts,{owner:'hero',source:'fire',damage:TUNING.items.fireWand.damage,speed:TUNING.items.fireWand.speed,range:8,r:.22,object:modelMesh(fireBoltModel())});
    this.extraMelt = opts.extraMelt ?? (hasItem('ember-lens') ? 1 : 0);
  }
  ignoresWall(tx, tz) { return this.meltKey === `${tx},${tz}`; }
  onHitWall(tx, tz, def, triggered) {
    if (this.extraMelt > 0 && ['tideglass-ice', 'frozen-flame'].includes(def?.name) && triggered === true) {
      // A guest's accepted fire action reaches its room owner asynchronously.
      // Pass only this ice footprint while its tile update travels back.
      this.extraMelt--; this.meltKey = `${tx},${tz}`; return false;
    }
    return true;
  }
}
registerEntity('fire-bolt',opts=>new FireBolt(opts));
