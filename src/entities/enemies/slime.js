// Slime: hops around at random and lunges at the hero when close.
// Map marker 'e' in both prototype areas; the crypt spawns the blue variant.
import { state } from '../../core/state.js';
import { random } from '../../core/random.js';
import { slimeGeometry, SLIME_VARIANTS } from '../../models/slime.js';
import { moveBody } from '../../systems/physics.js';
import { Enemy } from '../enemy.js';
import { registerEntity } from '../registry.js';

export class Slime extends Enemy {
  constructor(opts) {
    const variant = opts.variant ?? 'red';
    super(opts, { hp: 2, r: 0.34, speed: 1.4, colors: SLIME_VARIANTS[variant].burst, geometry: slimeGeometry(variant) });
    this.variant = variant;
  }

  think(dt, { toP, dist, bounds }) {
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = 0.7 + random() * 1.1;
      if (dist < 5 && random() < 0.65) {
        this.dx = toP.x / dist;
        this.dz = toP.z / dist;
      } else if (random() < 0.25) {
        this.dx = this.dz = 0;
      } else {
        const a = random() * Math.PI * 2;
        this.dx = Math.cos(a);
        this.dz = Math.sin(a);
      }
    }
    this.hopT += dt * 8;
    const moving = this.dx || this.dz;
    const hop = moving ? Math.abs(Math.sin(this.hopT)) : 0;
    if (moving && moveBody(this, this.dx * this.speed * dt * (0.4 + hop), this.dz * this.speed * dt * (0.4 + hop), bounds))
      this.thinkT = 0;
    if (moving) this.yaw = Math.atan2(this.dx, this.dz);
    this.mesh.position.y = hop * 0.18;
    const sq = moving ? 1 + Math.sin(this.hopT * 2) * 0.1 : 1 + Math.sin(state.time * 4) * 0.05;
    this.mesh.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  }
}

registerEntity('slime', (opts) => new Slime(opts));
