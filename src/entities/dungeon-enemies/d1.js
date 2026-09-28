// D1's room enemies (gameplay spec 8.3, 6.4; ids CONTRACTS 8.5): skeleton,
// bat, gazer. Numbers are TUNING.enemy.roster.
import { sfx } from '../../core/audio.js';
import { TUNING } from '../../core/tuning.js';
import { CHARACTER_MODELS } from '../../models/characters.js';
import * as M from '../../models/foes/foes.js';
import { registerBestiary } from '../../game/bestiary.js';
import { hero } from '../../game/hero.js';
import { Enemy } from '../enemy.js';
import { spawn } from '../manager.js';
import { registerEntity } from '../registry.js';
import { player } from '../player.js';
import { wander, flier, aligned, faceDir, tell, stepTell } from '../ai.js';

const R = (id) => TUNING.enemy.roster[id];
const stats = (id, extra = {}) => {
  const s = R(id);
  return { hp: s.hp, r: s.r, speed: s.speed, contactDamage: s.contact, drops: 'pack-a', ...extra };
};

// ---------------------------------------------------------------- skeleton
// Wanders at 2 t/s, with a 25% chance of a random turn in each leg.
class Skeleton extends Enemy {
  constructor(opts) {
    super(opts, { ...stats('skeleton'), model: CHARACTER_MODELS.skeleton() });
  }
  think(dt, { bounds }) {
    const moving = wander(this, dt, bounds, this.speed, { turnChance: R('skeleton').turnChance });
    this.mesh.position.y = moving ? Math.abs(Math.sin((this.hopT += dt * 12))) * 0.06 : 0;
  }
}
registerEntity('skeleton', (opts) => new Skeleton(opts));

// ---------------------------------------------------------------- bat
// A flier at 4 t/s that drifts toward the hero now and then.
class Bat extends Enemy {
  constructor(opts) {
    const s = R('bat');
    super(opts, { ...stats('bat'), height: s.height, poses: { a: CHARACTER_MODELS.bat0(), b: CHARACTER_MODELS.bat1() } });
    this.flying = true;
  }
  think(dt, { bounds }) {
    flier(this, dt, bounds, this.speed, { toward: 0.35 });
    this.hopT += dt * 24;
    this.mesh.setPose(Math.sin(this.hopT) > 0 ? 'a' : 'b');
    this.mesh.position.y = this.height + Math.sin(this.hopT * 0.15) * 0.1;
  }
}
registerEntity('bat', (opts) => new Bat(opts));

// ---------------------------------------------------------------- gazer
// Gaze (spec 8.2): when lined up with the hero and facing him, it opens its
// eye, holds him still for gazeParalyze s, then fires a shot of 1 heart
// (a magic shot: tier 3). Drops magic (pack C).
class Gazer extends Enemy {
  constructor(opts) {
    super(opts, { ...stats('gazer', { drops: 'pack-c' }), poses: { shut: M.gazerModel(0), open: M.gazerModel(1) } });
    this.cool = R('gazer').cooldown;
    this.gaze = null; // the direction it stares while the hero is held
  }
  think(dt, { bounds }) {
    const s = R('gazer');
    this.cool -= dt;
    this.mesh.position.y = 0.15 + Math.sin((this.hopT += dt * 3)) * 0.05;
    if (this.gaze) {
      this.mesh.setPose('open');
      if (stepTell(this, dt)) return;
      spawn('gazer-shot', { x: this.x + this.gaze.x * 0.5, z: this.z + this.gaze.z * 0.5, dir: this.gaze, speed: s.boltSpeed, damage: s.boltDamage });
      sfx.shoot();
      this.gaze = null;
      this.cool = s.cooldown;
      return;
    }
    this.mesh.setPose(this.cool > 0 ? 'shut' : 'open');
    const dir = aligned(this, s.sight);
    const facing = dir && Math.abs(Math.atan2(Math.sin(this.yaw - Math.atan2(dir.x, dir.z)), Math.cos(this.yaw - Math.atan2(dir.x, dir.z)))) < 0.3;
    if (dir && this.cool <= 0 && facing) {
      this.gaze = dir;
      const t = TUNING.enemy.ai.gazeParalyze;
      hero.addStatus('paralyzed', t);
      // hold his walking off while he is held (the hero reads the status for presses)
      player.knockT = Math.max(player.knockT, t);
      player.kx = player.kz = 0;
      tell(this, t);
      return;
    }
    if (dir && this.cool <= 0) faceDir(this, dir); // turn to him first; the gaze comes next tick
    else wander(this, dt, bounds);
  }
}
registerEntity('gazer', (opts) => new Gazer(opts));

for (const [id, name, text] of [
  ['skeleton', 'Rattle Guard', 'Shambles about and turns on a whim.'],
  ['bat', 'Cave Flutter', 'Darts about the dark rooms. Hard to pin down.'],
  ['gazer', 'Stone Eye', 'Holds you in its stare, then fires. Keep off its lines.'],
])
  registerBestiary({ id, name, hp: R(id).hp, text, where: 'dungeon' });
