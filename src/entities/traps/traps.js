// Dungeon traps (gameplay spec 6.4; CONTRACTS 8.5): turret, blade-trap,
// arrow-trap. They are invulnerable (immune to every source), never hold a
// room shut (countsForClear = false) and wear no crown. Numbers are
// TUNING.traps.
//
//   turret      a statue that glows for turret.glow s, then fires a
//               turret-bolt at the hero every turret.period s (magic: tier 3)
//   blade-trap  slides out at bladeTrap.out t/s when the hero lines up with
//               it, back home at bladeTrap.back t/s; 1 heart on contact
//   arrow-trap  a slot in a wall that looses a trap-arrow along `dir` every
//               arrowTrap.period s while the hero is lined up with it
//               (marker opts: dir 'north' | 'east' | 'south' | 'west')
import { sfx } from '../../core/audio.js';
import { TUNING } from '../../core/tuning.js';
import { statueModel, spikeBallModel } from '../../models/props.js';
import { arrowTrapModel } from '../../models/foes/foes.js';
import { SOURCES } from '../../game/damage.js';
import { Enemy } from '../enemy.js';
import { spawn } from '../manager.js';
import { registerEntity } from '../registry.js';
import { player } from '../player.js';
import { aligned, faceDir } from '../ai.js';

const DIRS = { north: { x: 0, z: -1 }, east: { x: 1, z: 0 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 } };
const T = () => TUNING.traps;

class Trap extends Enemy {
  constructor(opts, def) {
    super({ ...opts, crowned: false }, { speed: 0, hp: 1, drops: null, contactDamage: 0, ...def });
    this.countsForClear = false;
    this.immune = SOURCES;
    this.invulnerable = true;
    this.spawnT = 0;
  }
  // traps never budge
  recoil() {}
  knockAway() {}
  hurt() {
    return false;
  }
  onImmune() {
    sfx.block();
  }
}

// ---------------------------------------------------------------- turret
class Turret extends Trap {
  constructor(opts) {
    super(opts, { r: 0.45, model: statueModel(), shadow: 0.55 });
    this.solid = true;
    this.t = opts.phase ?? T().turret.period;
  }
  think(dt) {
    const P = T().turret;
    this.t -= dt;
    faceDir(this, { x: player.x - this.x, z: player.z - this.z });
    const glowing = this.t <= P.glow;
    this.mat.emissive.setHex(glowing ? 0x3a8aff : 0x000000);
    this.glowing = glowing;
    if (this.t > 0) return;
    this.t += P.period;
    const dx = player.x - this.x;
    const dz = player.z - this.z;
    const d = Math.hypot(dx, dz) || 1;
    spawn('turret-bolt', { x: this.x + (dx / d) * 0.6, z: this.z + (dz / d) * 0.6, dir: { x: dx, z: dz }, speed: P.bolt, damage: T().turretBolt.damage, tier: T().turretBolt.tier });
    sfx.shoot();
  }
}
registerEntity('turret', (opts) => new Turret(opts));

// ---------------------------------------------------------------- blade-trap
class BladeTrap extends Trap {
  constructor(opts) {
    super(opts, { r: 0.42, model: spikeBallModel(), contactDamage: T().bladeTrapDamage });
    this.homeX = this.x;
    this.homeZ = this.z;
    this.dir = null;
    this.back = false;
  }
  think(dt, { bounds }) {
    const B = T().bladeTrap;
    if (!this.dir && !this.back) {
      const dir = aligned(this, T().bladeTrapReach);
      if (dir) this.dir = dir;
      return;
    }
    if (this.dir) {
      if (this.walk(this.dir.x * B.out * dt, this.dir.z * B.out * dt, bounds)) {
        this.dir = null;
        this.back = true;
        sfx.block();
      }
      this.mesh.rotation.y += dt * 12;
      return;
    }
    const dx = this.homeX - this.x;
    const dz = this.homeZ - this.z;
    const d = Math.hypot(dx, dz);
    const step = B.back * dt;
    if (d <= step) {
      this.x = this.homeX;
      this.z = this.homeZ;
      this.back = false;
    } else {
      this.x += (dx / d) * step;
      this.z += (dz / d) * step;
    }
  }
}
registerEntity('blade-trap', (opts) => new BladeTrap(opts));

// ---------------------------------------------------------------- arrow-trap
class ArrowTrap extends Trap {
  constructor(opts) {
    super(opts, { r: 0.3, model: arrowTrapModel(), shadow: 0.01 });
    this.dir = DIRS[opts.dir] ?? DIRS.south;
    this.yaw = Math.atan2(this.dir.x, this.dir.z);
    this.t = 0;
    this.shadow.visible = false;
  }
  think(dt) {
    const P = T().arrowTrap;
    this.t -= dt;
    const d = aligned(this, TUNING.scroll.projectileRange);
    if (!d || d.x !== this.dir.x || d.z !== this.dir.z || this.t > 0) return;
    this.t = P.period;
    spawn('trap-arrow', { x: this.x + this.dir.x * 0.9, z: this.z + this.dir.z * 0.9, dir: this.dir, speed: P.speed, damage: P.damage, tier: P.tier });
    sfx.shoot();
  }
  update(dt) {
    super.update(dt);
    this.holder.rotation.y = this.yaw;
  }
}
registerEntity('arrow-trap', (opts) => new ArrowTrap(opts));
