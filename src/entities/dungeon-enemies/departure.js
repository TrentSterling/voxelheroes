import * as THREE from 'three';
import { Enemy } from '../enemy.js';
import { Projectile } from '../projectile.js';
import { registerEntity } from '../registry.js';
import { spawn } from '../manager.js';
import { registerBestiary } from '../../game/bestiary.js';
import { worldScale } from '../../game/effects.js';
import { world } from '../../world/world.js';
import { sfx } from '../../core/audio.js';
import { modelMesh } from '../../models/kit.js';
import { departureCourierModel, departureProp } from '../../models/departure.js';

const angles = [-.22, 0, .22];
const markGeometry = new THREE.PlaneGeometry(.12, .27).rotateX(-Math.PI / 2);
const markMaterial = new THREE.MeshBasicMaterial({ color: 0xefb5cd, transparent: true, opacity: .65, depthWrite: false, toneMapped: false });
class BellCourier extends Enemy {
  constructor(opts) {
    super({ ...opts, crowned: false }, { hp: 24, r: .58, speed: .8, contactDamage: 1, heavy: true, drops: 'pack-c',
      poses: { closed: departureCourierModel(), open: departureCourierModel(true) } });
    this.ai.departure = { phase: 'wait', t: 1, dx: 0, dz: 1, shots: 0, openT: 0, volleys: 0 };
    this.cue = new THREE.Group();
    for (const angle of angles) for (let i = 0; i < 15; i++) {
      const d = .9 + i * .38, m = new THREE.Mesh(markGeometry, markMaterial);
      m.position.set(Math.sin(angle) * d, .21, Math.cos(angle) * d); m.rotation.y = angle;
      m.userData.sharedGeometry = true; this.cue.add(m);
    }
    this.holder.add(this.cue); this.present();
  }
  guards(hit) {
    const a = this.ai.departure;
    if (a.phase === 'recover' || a.openT > 0 || this.stunT > 0 || this.knockT > 0 || this.frozenT > 0) return false;
    if (!['sword', 'spin', 'beam', 'arrow', 'dash'].includes(hit.source)) return false;
    const dx = hit.fromX - this.x, dz = hit.fromZ - this.z;
    return (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / (Math.hypot(dx, dz) || 1) > .25;
  }
  onBlocked(hit) { if (hit.swingId !== undefined) this.hitSwing = hit.swingId; sfx.block(); }
  onHurt(hit) {
    const a = this.ai.departure;
    a.openT = Math.max(a.openT, hit.source === 'grapple' ? 3 : hit.source === 'pot' ? 2.5 : hit.source === 'fire' ? 3 : 1.1);
    a.phase = 'recover'; a.t = Math.max(1.1, a.openT); this.harmless = true; this.present();
  }
  think(dt, { toP, dist, bounds }) {
    const a = this.ai.departure; a.t -= dt;
    if (a.phase === 'recover') {
      if (a.t <= 0 && a.openT <= 0) { a.phase = 'wait'; a.t = .6; this.harmless = false; }
      return;
    }
    if (a.phase === 'call') {
      if (a.t <= 0) {
        const dir = { x: Math.sin(this.yaw + angles[a.shots]), z: Math.cos(this.yaw + angles[a.shots]) };
        spawn('departure-bolt', { x: this.x + dir.x * .85, z: this.z + dir.z * .85, dir }); sfx.shoot();
        if (++a.shots === angles.length) { a.volleys++; a.phase = 'recover'; a.t = this.hp <= 12 ? 1.8 : 2.3; }
        else a.t = .18;
      }
      return;
    }
    if (dist < .01) return;
    this.yaw = Math.atan2(toP.x, toP.z);
    let lineClear = true;
    const samples = Math.ceil(dist * 4);
    for (let i = 1; i <= samples; i++) {
      if (world.shotBlockedAt(this.x + toP.x * i / samples, this.z + toP.z * i / samples)) { lineClear = false; break; }
    }
    if (dist < 6.5 && a.t <= 0 && lineClear) {
      a.phase = 'call'; a.t = this.hp <= 12 ? .75 : 1; a.dx = toP.x / dist; a.dz = toP.z / dist; a.shots = 0; this.harmless = true;
    } else if (dist > 3) this.walk(toP.x / dist * this.speed * dt, toP.z / dist * this.speed * dt, bounds);
  }
  update(dt) { this.ai.departure.openT = Math.max(0, this.ai.departure.openT - dt * worldScale(this)); super.update(dt); this.present(); }
  present() {
    const a = this.ai.departure;
    this.mesh.setPose(a.phase === 'recover' || a.openT > 0 ? 'open' : 'closed');
    this.cue.visible = this.spawned && a.phase === 'call' && this.stunT <= 0 && this.knockT <= 0 && !(this.frozenT > 0);
    this.cue.rotation.y = Math.atan2(a.dx, a.dz) - this.holder.rotation.y;
  }
}
class DepartureBolt extends Projectile {
  constructor(opts) { super(opts, { owner: 'enemy', damage: 1, speed: 5.5, tier: 1, range: 9, r: .14, height: .5, object: modelMesh(departureProp('tag')) }); this.object.scale.setScalar(.26); }
}
registerEntity('bell-courier', opts => new BellCourier(opts));
registerEntity('departure-bolt', opts => new DepartureBolt(opts));
registerBestiary({ id: 'bell-courier', name: 'Waiting Bell Courier', hp: 24, where: 'The Last Platform',
  text: 'The three marked notes aim once, then its shutters open. Dodge the fan, flank its closed front, or interrupt with pottery, a hook or fire. Bell Shelter stops the notes.' });
