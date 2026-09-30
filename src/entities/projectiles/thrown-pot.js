import { registerEntity } from '../registry.js';
import { Projectile } from '../projectile.js';
import { TUNING } from '../../core/tuning.js';
import { emit } from '../../core/events.js';
import { modelMesh } from '../../models/kit.js';
import { potModel } from '../../models/props.js';
import { shatterPot } from '../../systems/pot-fx.js';

class ThrownPot extends Projectile {
  constructor(opts) {
    const model = potModel();
    super(opts, { owner: 'hero', source: 'pot', speed: TUNING.pots.speed, damage: TUNING.pots.damage,
      r: TUNING.pots.radius, height: 1.15, range: TUNING.pots.speed * TUNING.pots.flightTime + 0.1,
      hitOpts: { stun: TUNING.pots.stun }, object: modelMesh(model) });
    this.colors = model.colors;
    this.loot = opts.loot !== false;
    this.age = 0;
    this.flightTime = TUNING.pots.flightTime;
  }

  update(dt) {
    // Swept motion keeps a fast throw from passing through a pot, target or thin wall.
    const steps = Math.max(1, Math.ceil(TUNING.pots.speed * dt / 0.1));
    for (let i = 0; i < steps && !this.removed; i++) super.update(dt / steps);
  }

  animate(dt) {
    this.age += dt;
    const t = Math.min(1, this.age / this.flightTime);
    this.height = 1.15 * (1 - t) + Math.sin(t * Math.PI) * 0.55;
    this.object.rotation.x = t * Math.PI * 2;
    if (t >= 1) this.shatter();
  }

  shatter() {
    if (this.removed) return;
    this.remove();
    shatterPot(this.x, this.z, Math.max(0.25, this.height), this.colors, { loot: this.loot });
    emit('pot-broken', { x: this.x, z: this.z, thrown: true });
  }
}

registerEntity('thrown-pot', (opts) => new ThrownPot(opts));
