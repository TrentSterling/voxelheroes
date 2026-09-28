// The rock a spitter spits: a basic shot on the Projectile base (CONTRACTS
// 8.4), so it reaches the hero through hero.receiveHit({ kind: 'projectile',
// tier: 2 }): only a raised guard with a tier-2 shield or better stops it
// (spec 7.8), the blade knocks it apart, walls get onShot.
import { getMaterial } from '../../core/materials.js';
import { pebbleModel } from '../../models/characters.js';
import { Projectile } from '../projectile.js';
import { registerEntity } from '../registry.js';

export class RockShot extends Projectile {
  constructor(opts) {
    super(opts, { owner: 'enemy', damage: 1, tier: 2, source: 'enemy', r: 0.16, geometry: pebbleModel().geometry, material: getMaterial('character') });
    this.spin = 0;
  }

  animate(dt) {
    this.spin += dt * 12;
  }

  place() {
    super.place();
    if (this.object) this.object.rotation.set(this.spin ?? 0, (this.spin ?? 0) * 0.5, 0);
  }
}

registerEntity('rock-shot', (opts) => new RockShot(opts));
