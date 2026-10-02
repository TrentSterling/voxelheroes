// D1's room enemies (gameplay spec 8.3, 6.4; ids CONTRACTS 8.5): skeleton,
// bat, gazer. Numbers are TUNING.enemy.roster.
import * as THREE from 'three';
import { sfx } from '../../core/audio.js';
import { TUNING } from '../../core/tuning.js';
import { CHARACTER_MODELS } from '../../models/characters.js';
import * as M from '../../models/foes/foes.js';
import { barrowGuardModel } from '../../models/foes/barrow-guard.js';
import { registerBestiary } from '../../game/bestiary.js';
import { Enemy } from '../enemy.js';
import { spawn } from '../manager.js';
import { registerEntity } from '../registry.js';
import { wander, flier, aligned, faceDir, alert, stepAlert } from '../ai.js';
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
const eyeCueMaterial = new THREE.MeshBasicMaterial({ color: 0xff766b, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
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
// A committed coral sight line gives a full second to sidestep or interrupt.
// It closes its lid after firing; hits cancel the pending shot. The complete
// attack clock lives in ai so a different room owner can continue the tell.
class Gazer extends Enemy {
  constructor(opts) {
    super(opts, { ...stats('gazer', { drops: 'pack-c' }), poses: { shut: M.gazerModel(0), open: M.gazerModel(1) } });
    this.ai.eye = { phase: 'roam', cool: R('gazer').cooldown, t: 0, dx: 0, dz: 1, reach: 0 };
    this.sightCue = new THREE.Group();
    this.sightCue.visible = false;
    for (let i = 0; i < 18; i++) for (const side of [-1, 1]) {
      const mark = new THREE.Mesh(cueGeometry, eyeCueMaterial);
      mark.position.set(side * 0.5, 0.025, 0.7 + i * 0.4);
      mark.rotation.y = side * -Math.PI / 5;
      mark.userData.sharedGeometry = true;
      this.sightCue.add(mark);
    }
    this.holder.add(this.sightCue);
  }
  sightReach(dir) {
    const reach = R('gazer').sight;
    for (let d = 0.5; d <= reach; d += 0.25) {
      if (world.shotBlockerAt(this.x + dir.x * d, this.z + dir.z * d)) return Math.max(0, d - 0.25);
    }
    return reach;
  }
  recover() {
    Object.assign(this.ai.eye, { phase: 'recover', t: R('gazer').recovery, cool: R('gazer').cooldown });
    this.mesh.position.x = 0;
    this.present();
  }
  onHurt() { this.recover(); }
  present() {
    const eye = this.ai.eye;
    const warning = eye.phase === 'aim' && this.spawned && !(this.stunT > 0 || this.knockT > 0 || this.frozenT > 0);
    this.sightCue.visible = warning;
    this.mesh.setPose(warning ? 'open' : 'shut');
    this.harmless = eye.phase === 'recover';
    if (!warning) return;
    // Compensate the body's smoothed turn: the marks always show the exact shot.
    this.sightCue.rotation.y = Math.atan2(eye.dx, eye.dz) - this.holder.rotation.y;
    for (const mark of this.sightCue.children) {
      const x = this.x + eye.dx * mark.position.z + eye.dz * mark.position.x;
      const z = this.z + eye.dz * mark.position.z - eye.dx * mark.position.x;
      mark.visible = mark.position.z + 0.15 <= eye.reach && !world.shotBlockedAt(x, z);
    }
  }
  update(dt) {
    if (this.ai.eye.phase === 'aim' && (this.frozenT > 0 || this.stunT > 0 || this.knockT > 0)) this.recover();
    super.update(dt); this.present();
  }
  think(dt, { bounds, toP }) {
    const s = R('gazer'), eye = this.ai.eye;
    this.mesh.position.y = 0.15 + Math.sin((this.hopT += dt * 3)) * 0.05;
    if (eye.phase === 'aim') {
      eye.t -= dt;
      this.mesh.position.x = Math.sin(eye.t * 45) * 0.025;
      if (eye.t <= 0) {
        const dir = { x: eye.dx, z: eye.dz };
        if (this.sightReach(dir) >= 0.5) {
          spawn('gazer-shot', { x: this.x + dir.x * 0.5, z: this.z + dir.z * 0.5, dir, speed: s.boltSpeed, damage: s.boltDamage });
          sfx.shoot();
        }
        this.recover();
      }
      return;
    }
    if (eye.phase === 'recover') {
      eye.t -= dt;
      if (eye.t <= 0) eye.phase = 'roam';
      return;
    }
    eye.cool -= dt;
    const dir = aligned(this, s.sight);
    const facing = dir && Math.abs(Math.atan2(Math.sin(this.yaw - Math.atan2(dir.x, dir.z)), Math.cos(this.yaw - Math.atan2(dir.x, dir.z)))) < 0.3;
    const reach = dir ? this.sightReach(dir) : 0;
    const distance = dir ? toP.x * dir.x + toP.z * dir.z : Infinity;
    if (dir && eye.cool <= 0 && facing && distance <= reach && distance > 0.5) {
      Object.assign(eye, { phase: 'aim', t: s.tell, dx: dir.x, dz: dir.z, reach });
      return;
    }
    if (dir && eye.cool <= 0 && distance <= reach) faceDir(this, dir);
    else wander(this, dt, bounds);
  }
}
registerEntity('gazer', (opts) => new Gazer(opts));

for (const [id, name, text] of [
  ['skeleton', 'Rattle Guard', 'Raises its blade, lunges in a straight line, then pauses. Sidestep and strike.'],
  ['barrow-warden', 'Barrow Warden', 'Red steel guards its front. Flank it, punish a missed lunge, or stagger it with a pot.'],
  ['bat', 'Cave Flutter', 'Darts about the dark rooms. Hard to pin down.'],
  ['gazer', 'Stone Eye', 'Coral marks show its next shot. Sidestep, interrupt it with a boomerang, or strike while its lid closes.'],
])
  registerBestiary({ id, name, hp: R(id).hp, text, where: 'dungeon' });
