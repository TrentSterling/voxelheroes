// Spitter: walks in straight lines, stops, turns to face the hero along an
// axis and spits a rock. Map marker 'o'.
import { DEG } from '../../core/constants.js';
import { sfx } from '../../core/audio.js';
import { random } from '../../core/random.js';
import { spitterGeometry } from '../../models/spitter.js';
import { moveBody } from '../../systems/physics.js';
import { Enemy } from '../enemy.js';
import { spawn } from '../manager.js';
import { registerEntity } from '../registry.js';

const CARDINALS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export const ROCK_SPEED = 5.5;

export class Spitter extends Enemy {
  constructor(opts) {
    super(opts, { hp: 3, r: 0.36, speed: 1.6, colors: [0x8e4fd0, 0xb07ae8, 0x5d2e94], geometry: spitterGeometry() });
    this.phase = 'walk'; // walk | aim
    this.aimT = 0;
  }

  think(dt, { toP, dist, bounds }) {
    this.thinkT -= dt;
    if (this.phase === 'walk') {
      if (this.thinkT <= 0) {
        this.phase = 'aim';
        this.aimT = 0.55;
        const horiz = Math.abs(toP.x) > Math.abs(toP.z);
        this.yaw = horiz ? (toP.x > 0 ? 90 : -90) * DEG : toP.z > 0 ? 0 : Math.PI;
      } else {
        this.hopT += dt * 10;
        if (moveBody(this, this.dx * this.speed * dt, this.dz * this.speed * dt, bounds)) {
          const [cx, cz] = CARDINALS[Math.floor(random() * 4)];
          this.dx = cx;
          this.dz = cz;
        }
        if (this.dx || this.dz) this.yaw = Math.atan2(this.dx, this.dz);
        this.mesh.position.y = Math.abs(Math.sin(this.hopT)) * 0.05;
      }
    } else {
      this.aimT -= dt;
      this.mesh.scale.setScalar(1 + Math.max(0, 0.3 - this.aimT) * 0.4);
      if (this.aimT <= 0) {
        this.mesh.scale.setScalar(1);
        if (dist < 9) this.fire();
        this.phase = 'walk';
        this.thinkT = 1.2 + random() * 1.5;
        const [cx, cz] = CARDINALS[Math.floor(random() * 4)];
        this.dx = cx;
        this.dz = cz;
      }
    }
  }

  fire() {
    const dx = Math.sin(this.yaw);
    const dz = Math.cos(this.yaw);
    spawn('rock-shot', { x: this.x + dx * 0.55, z: this.z + dz * 0.55, vx: dx * ROCK_SPEED, vz: dz * ROCK_SPEED });
    sfx.shoot();
  }
}

registerEntity('spitter', (opts) => new Spitter(opts));
