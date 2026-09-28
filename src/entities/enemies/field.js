// The overworld's first-slice enemies (gameplay spec 8.3; ids CONTRACTS
// 8.5): hopper, blob, blob-blue, buzzer, stump, archer, leaper, guardian,
// treasure-slime and wyrm. Numbers are TUNING.enemy.roster; behaviours are
// entities/ai.js's primitives. Map markers name them by id, or a spawn group
// lists them: { type: 'group', of: ['blob', 'hopper'], count: [2, 6], rare: ['treasure-slime'] }.
import { sfx } from '../../core/audio.js';
import { random } from '../../core/random.js';
import { TUNING } from '../../core/tuning.js';
import { slimeModel } from '../../models/characters.js';
import * as M from '../../models/foes/foes.js';
import { registerDropTable } from '../../systems/drops.js';
import { registerBestiary } from '../../game/bestiary.js';
import { Enemy } from '../enemy.js';
import { spawn } from '../manager.js';
import { registerEntity } from '../registry.js';
import { player } from '../player.js';
import { wander, aligned, charge, stepCharge, flier, hop, shoot, faceDir, stepTell, stepAlert, alert, CARDINALS } from '../ai.js';

const R = (id) => TUNING.enemy.roster[id];
const stats = (id, extra = {}) => {
  const s = R(id);
  return { hp: s.hp, r: s.r, speed: s.speed, contactDamage: s.contact, drops: 'pack-a', ...extra };
};

// The cardinal nearest the hero.
const towardHero = (e) => {
  const dx = player.x - e.x;
  const dz = player.z - e.z;
  return Math.abs(dx) > Math.abs(dz) ? { x: Math.sign(dx), z: 0 } : { x: 0, z: Math.sign(dz) || 1 };
};

// ---------------------------------------------------------------- hopper
// Wanders at 2.5 t/s; lined up within 5 tiles it crouches (the tell), then
// charges at 6 t/s for 0.6 s.
class Hopper extends Enemy {
  constructor(opts) {
    super(opts, { ...stats('hopper'), poses: { stand: M.hopperModel(0), crouch: M.hopperModel(1) } });
  }
  think(dt, { bounds }) {
    stepAlert(this, dt);
    const s = R('hopper');
    if (!this.ai.charge) {
      const dir = aligned(this, s.sight);
      if (dir) charge(this, dir, { speed: s.chargeSpeed * (this.speed / this.baseSpeed), tiles: Infinity, time: s.chargeTime });
    }
    const charging = stepCharge(this, dt, bounds);
    this.mesh.setPose(charging && this.ai.tellT > 0 ? 'crouch' : 'stand');
    if (!charging) {
      const moving = wander(this, dt, bounds);
      this.mesh.position.y = moving ? Math.abs(Math.sin((this.hopT += dt * 12))) * 0.08 : 0;
    }
  }
}
registerEntity('hopper', (opts) => new Hopper(opts));

// ---------------------------------------------------------------- blob, blob-blue
class Blob extends Enemy {
  constructor(opts, id = 'blob', variant = 'green') {
    super(opts, { ...stats(id), poses: { tall: slimeModel(0, variant), squat: slimeModel(1, variant) } });
  }
  think(dt, { bounds }) {
    const moving = wander(this, dt, bounds);
    this.hopT += dt * 8;
    const h = moving ? Math.abs(Math.sin(this.hopT)) : 0;
    this.mesh.position.y = h * 0.14;
    this.mesh.setPose(moving ? (h > 0.35 ? 'tall' : 'squat') : Math.sin(this.hopT * 0.5) > 0 ? 'tall' : 'squat');
  }
}
registerEntity('blob', (opts) => new Blob(opts));
registerEntity('blob-blue', (opts) => new Blob(opts, 'blob-blue', 'blue'));

// ---------------------------------------------------------------- buzzer
// A flier at 3.5 t/s that never goes for the hero.
class Buzzer extends Enemy {
  constructor(opts) {
    const s = R('buzzer');
    super(opts, { ...stats('buzzer'), height: s.height, poses: { a: M.buzzerModel(0), b: M.buzzerModel(1) } });
    this.flying = true;
  }
  think(dt, { bounds }) {
    flier(this, dt, bounds);
    this.hopT += dt * 30;
    this.mesh.setPose(Math.sin(this.hopT) > 0 ? 'a' : 'b');
    this.mesh.position.y = this.height + Math.sin(this.hopT * 0.1) * 0.08;
  }
}
registerEntity('buzzer', (opts) => new Buzzer(opts));

// ---------------------------------------------------------------- stump
// Still (and asleep) until the hero comes within 3 tiles, then chases at 2 t/s.
class Stump extends Enemy {
  constructor(opts) {
    super(opts, { ...stats('stump'), poses: { asleep: M.stumpModel(0), awake: M.stumpModel(1) } });
    this.yaw = 0;
    this.awake = false;
  }
  think(dt, { toP, dist, bounds }) {
    stepAlert(this, dt);
    if (!this.awake && dist <= R('stump').wake) {
      this.awake = true;
      alert(this);
      this.mesh.setPose('awake');
    }
    if (!this.awake) return;
    const d = dist || 1;
    this.walk((toP.x / d) * this.speed * dt, (toP.z / d) * this.speed * dt, bounds);
    faceDir(this, toP);
    this.mesh.position.y = Math.abs(Math.sin((this.hopT += dt * 10))) * 0.05;
  }
}
registerEntity('stump', (opts) => new Stump(opts));

// ---------------------------------------------------------------- archer
// A shooter: lined up within 7 tiles it stops for 0.4 s, then looses an
// arrow at 8 t/s (tier 2: a raised guard with the tier-2 shield blocks it).
class Archer extends Enemy {
  constructor(opts) {
    super(opts, { ...stats('archer', { drops: 'pack-b' }), poses: { idle: M.archerModel(0), draw: M.archerModel(1) } });
  }
  think(dt, { bounds }) {
    const s = R('archer');
    const holding = shoot(this, dt, {
      reach: s.sight,
      fire: (dir) => {
        spawn('archer-arrow', { x: this.x + dir.x * 0.5, z: this.z + dir.z * 0.5, dir, speed: s.arrowSpeed, damage: s.arrowDamage });
        sfx.shoot();
      },
    });
    this.mesh.setPose(holding ? 'draw' : 'idle');
    if (!holding) wander(this, dt, bounds);
  }
}
registerEntity('archer', (opts) => new Archer(opts));

// ---------------------------------------------------------------- leaper
// A hopper: 3-tile hops every 1.4 s, often toward the hero. It can't be hit
// in the air; its shadow shows where it lands.
class Leaper extends Enemy {
  constructor(opts) {
    super(opts, { ...stats('leaper'), poses: { sit: M.leaperModel(1), jump: M.leaperModel(0) } });
  }
  think(dt, { bounds }) {
    const s = R('leaper');
    const k = this.speed / this.baseSpeed;
    const phase = hop(this, dt, bounds, { every: s.hopEvery / k, tiles: s.hopTiles, dirFn: () => (random() < 0.5 ? towardHero(this) : CARDINALS[Math.floor(random() * 4)]) });
    this.mesh.setPose(phase === 'air' ? 'jump' : 'sit');
  }
}
registerEntity('leaper', (opts) => new Leaper(opts));

// ---------------------------------------------------------------- guardian
// The prologue's pair: they stomp round a circle; each takes 3 hits (any
// weapon, any damage). After 2 hits they take long leaps at the hero with a
// landing shadow. Each drops a heart.
class Guardian extends Enemy {
  constructor(opts) {
    super({ ...opts, crowned: false }, { ...stats('guardian', { drops: 'heart-drop' }), heavy: true, poses: { a: M.guardianModel(0), b: M.guardianModel(1) } });
    this.hits = R('guardian').hp;
    this.hp = this.maxHp = this.hits;
    this.cx = this.x;
    this.cz = this.z;
    this.angle = opts.phase ?? random() * Math.PI * 2;
  }
  hurt(hit) {
    return super.hurt({ ...hit, damage: 1 }); // counts hits, not points
  }
  think(dt, { bounds }) {
    const s = R('guardian');
    this.hopT += dt * 6;
    this.mesh.setPose(Math.sin(this.hopT) > 0 ? 'a' : 'b');
    if (this.maxHp - this.hp >= s.leapAfter) {
      hop(this, dt, bounds, { tiles: s.leapTiles, air: TUNING.enemy.ai.hopAir * 2, dirFn: () => towardHero(this) });
      return;
    }
    this.angle += (this.speed / s.circle) * dt;
    const tx = this.cx + Math.cos(this.angle) * s.circle;
    const tz = this.cz + Math.sin(this.angle) * s.circle;
    faceDir(this, { x: tx - this.x, z: tz - this.z });
    this.walk(tx - this.x, tz - this.z, bounds);
  }
}
registerEntity('guardian', (opts) => new Guardian(opts));

// ---------------------------------------------------------------- treasure-slime
// A rare spawn: flees at 6 t/s once the hero is within 5 tiles; has to be
// cornered. 100 coins (80%) or a token (20%).
class TreasureSlime extends Enemy {
  constructor(opts) {
    super(opts, { ...stats('treasure-slime', { drops: 'rare-slime' }), poses: { tall: M.goldBlobModel(0), squat: M.goldBlobModel(1) } });
    this.rare = true;
  }
  think(dt, { toP, dist, bounds }) {
    this.hopT += dt * 10;
    this.mesh.setPose(Math.sin(this.hopT) > 0 ? 'tall' : 'squat');
    if (dist > R('treasure-slime').flee) {
      wander(this, dt, bounds, this.speed * 0.25);
      return;
    }
    // run straight away; slide along walls when cornered
    const d = dist || 1;
    const ux = -toP.x / d;
    const uz = -toP.z / d;
    const step = this.speed * dt;
    if (this.walk(ux * step, uz * step, bounds) && this.walk(-uz * step, ux * step, bounds)) this.walk(uz * step, -ux * step, bounds);
    faceDir(this, { x: ux, z: uz });
  }
}
registerEntity('treasure-slime', (opts) => new TreasureSlime(opts));

// ---------------------------------------------------------------- wyrm
// A rare heavy that chases at 3.5 t/s. (It can't hurt a hero on another
// ledge level: levels come with M3, CONTRACTS 12.)
class Wyrm extends Enemy {
  constructor(opts) {
    super(opts, { ...stats('wyrm', { drops: 'rare-wyrm' }), heavy: true, poses: { a: M.wyrmModel(0), b: M.wyrmModel(1) } });
    this.rare = true;
  }
  think(dt, { toP, dist, bounds }) {
    this.hopT += dt * 8;
    this.mesh.setPose(Math.sin(this.hopT) > 0 ? 'a' : 'b');
    const d = dist || 1;
    this.walk((toP.x / d) * this.speed * dt, (toP.z / d) * this.speed * dt, bounds);
    faceDir(this, toP);
  }
}
registerEntity('wyrm', (opts) => new Wyrm(opts));

// ---------------------------------------------------------------- drops and the bestiary
registerDropTable('heart-drop', [{ chance: 1, type: 'heart' }]);
registerDropTable('rare-slime', [
  { chance: 0.8, type: 'coin-100' },
  { chance: 0.2, type: 'token' },
]);
registerDropTable('rare-wyrm', [
  { chance: 0.25, type: 'token' },
  { chance: 0.75 * 0.6 * 0.4, type: 'coin-10' },
  { chance: 0.75 * 0.6 * 0.3, type: 'heart' },
  { chance: 0.75 * 0.6 * 0.2, type: 'magic' },
  { chance: 0.75 * 0.6 * 0.1, type: 'coin-100' },
]);

const BESTIARY = [
  ['hopper', 'Burrow Hare', 'Charges down any row or column it shares with you.'],
  ['blob', 'Moss Blob', 'A slow jelly. Harmless alone, a nuisance in a crowd.'],
  ['blob-blue', 'Tide Blob', 'A heavier jelly that takes a few good cuts.'],
  ['buzzer', 'Thrum Beetle', 'Flits about and minds its own business.'],
  ['stump', 'Snag Stump', 'Sleeps until you come close. Then it follows.'],
  ['archer', 'Hedge Archer', 'Stops, aims along your line and looses an arrow.'],
  ['leaper', 'Spring Cricket', 'Bounds three tiles at a time. Strike it as it lands.'],
  ['guardian', 'Gate Sentinel', 'Stone guards that circle their post. Three blows each.'],
  ['treasure-slime', 'Gilded Blob', 'Rare and quick to run. Corner it for a fortune.'],
  ['wyrm', 'Moor Wyrm', 'A rare, heavy hunter. Best avoided until you are strong.'],
];
for (const [id, name, text] of BESTIARY) {
  const s = R(id);
  registerBestiary({ id, name, band: null, hp: s.hp, text, where: 'overworld' });
}
