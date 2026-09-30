// D1's room enemies (gameplay spec 8.3, 6.4; ids CONTRACTS 8.5): skeleton,
// bat, gazer. Numbers are TUNING.enemy.roster.
import * as THREE from 'three';
import { sfx } from '../../core/audio.js';
import { TUNING } from '../../core/tuning.js';
import { CHARACTER_MODELS } from '../../models/characters.js';
import * as M from '../../models/foes/foes.js';
import { barrowGuardModel } from '../../models/foes/barrow-guard.js';
import { registerBestiary } from '../../game/bestiary.js';
import { hero } from '../../game/hero.js';
import { Enemy } from '../enemy.js';
import { spawn } from '../manager.js';
import { registerEntity } from '../registry.js';
import { wander, flier, aligned, faceDir, tell, stepTell, alert, stepAlert } from '../ai.js';
import { world } from '../../world/world.js';

const R = (id) => TUNING.enemy.roster[id];
const stats = (id, extra = {}) => {
  const s = R(id);
  return { hp: s.hp, r: s.r, speed: s.speed, contactDamage: s.contact, drops: 'pack-a', ...extra };
};

// ---------------------------------------------------------------- skeleton
// Approach, raise the blade, commit to a line, then leave a counterattack window.
// AI and cue transforms are part of the room snapshot, so guests see the same tell.
const cueGeometry = new THREE.PlaneGeometry(0.16, 0.3).rotateX(-Math.PI / 2);
const cueMaterial = new THREE.MeshBasicMaterial({ color: 0xf5b34f, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false });
class Skeleton extends Enemy {
  constructor(opts, id = 'skeleton') {
    const armored = id === 'barrow-warden';
    super(opts, { ...stats(id), heavy: armored, poses: Object.fromEntries(['idle', 'aim', 'rush'].map(pose => [pose, barrowGuardModel(pose, armored)])) });
    this.guardType = id;
    this.ai.melee = { phase: 'hunt', t: 0.4, dx: 0, dz: 1, left: 0 };
    this.cue = new THREE.Group();
    this.cue.visible = false;
    for (let i = 0; i < 6; i++) for (const x of [-0.4, 0.4]) {
      const mark = new THREE.Mesh(cueGeometry, cueMaterial);
      mark.position.set(x, 0.015, 0.5 + i * 0.4);
      mark.userData.sharedGeometry = true;
      this.cue.add(mark);
    }
    this.holder.add(this.cue);
  }
  recover(seconds = R(this.guardType).recovery) {
    this.ai.melee.phase = 'recover';
    this.ai.melee.t = seconds;
    this.harmless = true;
    this.cue.visible = false;
    this.mesh.position.x = 0;
    this.mesh.setPose('idle');
  }
  onHurt() { this.recover(); }
  clearLine(toP, distance) {
    const n = Math.ceil(distance * 4);
    for (let i = 1; i <= n; i++) if (world.blocked(this.x + toP.x * i / n, this.z + toP.z * i / n, 0.1, this)) return false;
    return true;
  }
  think(dt, { bounds, toP, dist }) {
    const spec = R(this.guardType), m = this.ai.melee;
    stepAlert(this, dt);
    this.mesh.position.x = 0;
    if (m.phase === 'aim') {
      m.t -= dt;
      this.mesh.position.x = Math.sin(m.t * 45) * 0.025;
      if (m.t <= 0) {
        m.phase = 'rush'; m.left = spec.rushTiles;
        this.harmless = false; this.cue.visible = false; this.mesh.setPose('rush');
      }
      return;
    }
    if (m.phase === 'rush') {
      const step = Math.min(m.left, spec.rushSpeed * dt);
      m.left -= step;
      if (this.walk(m.dx * step, m.dz * step, bounds) || m.left <= 0) this.recover();
      return;
    }
    if (m.phase === 'recover') {
      m.t -= dt;
      if (m.t <= 0) { m.phase = 'hunt'; m.t = 0.35; this.harmless = false; }
      return;
    }
    m.t -= dt;
    if (dist <= spec.attackReach && dist > 0.05 && m.t <= 0 && this.clearLine(toP, dist)) {
      m.phase = 'aim'; m.t = spec.tell; m.dx = toP.x / dist; m.dz = toP.z / dist;
      faceDir(this, { x: m.dx, z: m.dz });
      this.harmless = true; this.cue.visible = true; this.mesh.setPose('aim'); alert(this, spec.tell);
      return;
    }
    let moving;
    if (dist < spec.sight && dist > 0.05 && this.clearLine(toP, dist)) {
      moving = true;
      this.walk(toP.x / dist * this.speed * dt, toP.z / dist * this.speed * dt, bounds);
      faceDir(this, toP);
    } else moving = wander(this, dt, bounds, this.speed, { turnChance: 0.25 });
    this.mesh.position.y = moving ? Math.abs(Math.sin((this.hopT += dt * 12))) * 0.06 : 0;
  }
}
registerEntity('skeleton', (opts) => new Skeleton(opts));

class BarrowWarden extends Skeleton {
  constructor(opts) { super({ ...opts, crowned: false }, 'barrow-warden'); }
  guards(hit) {
    if (this.ai.melee.phase === 'recover' || this.stunT > 0 || this.knockT > 0 || this.frozenT > 0) return false;
    if (!['sword', 'spin', 'beam', 'arrow', 'dash'].includes(hit.source)) return false;
    const dx = hit.fromX - this.x, dz = hit.fromZ - this.z;
    return (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / (Math.hypot(dx, dz) || 1) > 0.45;
  }
  onBlocked(hit) {
    if (hit.swingId !== undefined) this.hitSwing = hit.swingId;
    sfx.block(); alert(this, 0.25);
  }
}
registerEntity('barrow-warden', opts => new BarrowWarden(opts));

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
      hero.addStatus('paralyzed', t); // player.js holds his walking, hero.canAct his presses
      tell(this, t);
      return;
    }
    if (dir && this.cool <= 0) faceDir(this, dir); // turn to him first; the gaze comes next tick
    else wander(this, dt, bounds);
  }
}
registerEntity('gazer', (opts) => new Gazer(opts));

for (const [id, name, text] of [
  ['skeleton', 'Rattle Guard', 'Raises its blade, lunges in a straight line, then pauses. Sidestep and strike.'],
  ['barrow-warden', 'Barrow Warden', 'Red steel guards its front. Flank it, punish a missed lunge, or stagger it with a pot.'],
  ['bat', 'Cave Flutter', 'Darts about the dark rooms. Hard to pin down.'],
  ['gazer', 'Stone Eye', 'Holds you in its stare, then fires. Keep off its lines.'],
])
  registerBestiary({ id, name, hp: R(id).hp, text, where: 'dungeon' });
