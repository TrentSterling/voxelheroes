import * as THREE from 'three';
import { Enemy } from '../enemy.js';
import { registerEntity } from '../registry.js';
import { registerBestiary } from '../../game/bestiary.js';
import { TUNING } from '../../core/tuning.js';
import { world } from '../../world/world.js';
import { wander } from '../ai.js';
import { pollinatorModel } from '../../models/pollinator.js';

const geometry = new THREE.PlaneGeometry(.18, .3).rotateX(-Math.PI / 2);
const material = new THREE.MeshBasicMaterial({ color: 0xffa7a0, transparent: true, opacity: .95, depthWrite: false, toneMapped: false });
const spec = () => TUNING.enemy.roster['nursery-pollinator'];

class NurseryPollinator extends Enemy {
  constructor(opts) {
    const s = spec();
    super({ ...opts, crowned: false }, { hp: s.hp, r: s.r, speed: s.speed, contactDamage: s.contact, drops: 'pack-a',
      poses: Object.fromEntries(['hover', 'tell', 'dive', 'rest'].map(p => [p, pollinatorModel(p)])) });
    this.ai.pollinator = { phase: 'hover', t: .9, clock: 0, dx: 0, dz: 1, reach: 0, left: 0, dives: 0 };
    this.cue = new THREE.Group();
    for (let i = 0; i < 12; i++) for (const side of [-1, 1]) {
      const mark = new THREE.Mesh(geometry, material);
      mark.position.set(side * .48, .03, .6 + i * .32);
      mark.rotation.y = -side * Math.PI / 5;
      mark.userData.sharedGeometry = true;
      this.cue.add(mark);
    }
    this.holder.add(this.cue);
    this.present();
  }
  recover() {
    const a = this.ai.pollinator;
    a.phase = 'rest'; a.t = spec().recovery; a.left = 0;
    this.present();
  }
  onHurt() { this.recover(); }
  // Low flight stays above walkable ground, making every resting moth reachable.
  clearReach(dx, dz, length) {
    let clear = 0;
    for (let d = .25; d <= length; d += .25) {
      if (world.blocked(this.x + dx * d, this.z + dz * d, this.r, this)) break;
      clear = d;
    }
    return clear;
  }
  think(dt, { toP, dist, bounds }) {
    const a = this.ai.pollinator, s = spec();
    a.clock += dt; a.t -= dt;
    if (a.phase === 'tell') {
      if (a.t <= 0) { a.phase = 'dive'; a.left = a.reach; a.dives++; }
      return;
    }
    if (a.phase === 'dive') {
      const step = Math.min(a.left, s.diveSpeed * dt);
      a.left -= step;
      if (this.walk(a.dx * step, a.dz * step, bounds) || a.left <= .001) this.recover();
      return;
    }
    if (a.phase === 'rest') {
      if (a.t <= 0) { a.phase = 'hover'; a.t = s.cooldown; }
      return;
    }
    if (dist > .05 && dist < s.sight) {
      this.yaw = Math.atan2(toP.x, toP.z);
      const dx = toP.x / dist, dz = toP.z / dist;
      const reach = this.clearReach(dx, dz, Math.min(s.diveTiles, dist + .8));
      if (a.t <= 0 && reach >= dist - .25 && reach >= 1) {
        Object.assign(a, { phase: 'tell', t: s.tell, dx, dz, reach });
      } else if (dist > 2 && reach >= Math.min(dist, 1)) {
        this.walk(dx * this.speed * dt, dz * this.speed * dt, bounds);
      } else if (reach < Math.min(dist, 1)) wander(this, dt, bounds, this.speed);
    } else wander(this, dt, bounds, this.speed);
  }
  update(dt) {
    const a = this.ai.pollinator;
    if (['tell', 'dive'].includes(a.phase) && (this.stunT > 0 || this.knockT > 0 || this.frozenT > 0)) this.recover();
    super.update(dt);
    this.present();
  }
  // Guests display the owner's committed line and resting pose without AI ticks.
  present() {
    const a = this.ai.pollinator;
    this.harmless = a.phase !== 'dive';
    this.mesh.setPose(a.phase === 'rest' ? 'rest' : a.phase === 'tell' ? 'tell' : a.phase === 'dive' ? 'dive' : 'hover');
    this.mesh.position.y = a.phase === 'rest' ? .02 : a.phase === 'dive' ? .08 : .35 + Math.sin(a.clock * 6) * .06;
    this.cue.visible = this.spawned && a.phase === 'tell' && !(this.stunT > 0 || this.knockT > 0 || this.frozenT > 0);
    if (!this.cue.visible) return;
    this.cue.rotation.y = Math.atan2(a.dx, a.dz) - this.holder.rotation.y;
    for (const mark of this.cue.children) {
      const x = this.x + a.dx * mark.position.z + a.dz * mark.position.x;
      const z = this.z + a.dz * mark.position.z - a.dx * mark.position.x;
      mark.visible = mark.position.z + .15 <= a.reach && !world.blocked(x, z, .05, this);
    }
  }
}
registerEntity('nursery-pollinator', opts => new NurseryPollinator(opts));
registerBestiary({ id: 'nursery-pollinator', name: 'Nursery Pollinator', hp: 9, where: 'Rootglass Hive',
  text: 'Raised leaf wings and pink marks warn of a straight dive. Sidestep, then strike its resting brass body. Returning wood and clay interrupt it.' });
