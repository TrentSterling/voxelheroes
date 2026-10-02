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
import { watchSentinelModel, watchBoltModel } from '../../models/watch.js';

const marks = new THREE.PlaneGeometry(.1, .3).rotateX(-Math.PI / 2);
const amber = new THREE.MeshBasicMaterial({ color: 0xffcb70, transparent: true, opacity: .85, depthWrite: false, toneMapped: false });
class WatchSentinel extends Enemy {
  constructor(opts) {
    super({ ...opts, crowned: false }, { hp: 18, r: .46, speed: 1.15, contactDamage: 1, heavy: true, drops: 'pack-c',
      poses: { closed: watchSentinelModel(), open: watchSentinelModel(true) } });
    this.ai.watch = { phase: 'hunt', t: .75, dx: 0, dz: 1, openT: 0, volleys: 0 };
    this.cue = new THREE.Group();
    for (const angle of [-.14, 0, .14]) for (let i = 0; i < 16; i++) {
      const d = .8 + i * .4, mark = new THREE.Mesh(marks, amber);
      mark.position.set(Math.sin(angle) * d, .20, Math.cos(angle) * d);
      mark.rotation.y = angle; mark.userData.sharedGeometry = true; this.cue.add(mark);
    }
    this.holder.add(this.cue); this.present();
  }
  guards(hit) {
    const a = this.ai.watch;
    if (a.openT > 0 || a.phase === 'recover' || this.stunT > 0 || this.knockT > 0 || this.frozenT > 0) return false;
    if (!['sword', 'spin', 'beam', 'arrow', 'dash'].includes(hit.source)) return false;
    const dx = hit.fromX - this.x, dz = hit.fromZ - this.z;
    return (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / (Math.hypot(dx, dz) || 1) > .35;
  }
  onBlocked(hit) { if (hit.swingId !== undefined) this.hitSwing = hit.swingId; sfx.block(); }
  onHurt(hit) {
    const a = this.ai.watch;
    a.openT = Math.max(a.openT, hit.source === 'grapple' ? 4 : hit.source === 'pot' ? 2 : 1.25);
    a.phase = 'recover'; a.t = 1.25; this.harmless = true; this.present();
  }
  clearLine(toP, dist) {
    for (let i = 1, n = Math.ceil(dist * 4); i <= n; i++) if (world.shotBlockedAt(this.x + toP.x * i / n, this.z + toP.z * i / n)) return false;
    return true;
  }
  think(dt, { toP, dist, bounds }) {
    const a = this.ai.watch;
    a.t -= dt;
    if (a.phase === 'tell') {
      if (a.t <= 0) {
        const yaw = Math.atan2(a.dx, a.dz);
        for (const angle of [-.14, 0, .14]) {
          const dir = { x: Math.sin(yaw + angle), z: Math.cos(yaw + angle) };
          spawn('watch-bolt', { x: this.x + dir.x * .7, z: this.z + dir.z * .7, dir });
        }
        a.volleys++; a.phase = 'recover'; a.t = 1.25; sfx.shoot();
      }
      return;
    }
    if (a.phase === 'recover') {
      if (a.t <= 0 && a.openT <= 0) { a.phase = 'hunt'; a.t = .65; this.harmless = false; }
      return;
    }
    if (dist < .05) return;
    this.yaw = Math.atan2(toP.x, toP.z);
    if (dist < 7.5 && a.t <= 0 && this.clearLine(toP, dist)) {
      a.phase = 'tell'; a.t = .9; a.dx = toP.x / dist; a.dz = toP.z / dist; this.harmless = true;
    } else if (dist > 3.5) this.walk(toP.x / dist * this.speed * dt, toP.z / dist * this.speed * dt, bounds);
  }
  update(dt) {
    this.ai.watch.openT = Math.max(0, this.ai.watch.openT - dt * worldScale(this));
    super.update(dt); this.present();
  }
  // Replica presentation runs without advancing the owner's attack clock.
  present() {
    const a = this.ai.watch;
    this.mesh.setPose(a.openT > 0 || a.phase === 'recover' ? 'open' : 'closed');
    this.cue.visible = this.spawned && a.phase === 'tell' && this.stunT <= 0 && this.knockT <= 0 && !(this.frozenT > 0);
    this.cue.rotation.y = Math.atan2(a.dx, a.dz) - this.holder.rotation.y;
  }
}
class WatchBolt extends Projectile {
  constructor(opts) { super(opts, { owner: 'enemy', damage: 1, speed: 7, tier: 2, range: 11, r: .14, height: .45, object: modelMesh(watchBoltModel()) }); }
}
registerEntity('watch-sentinel', opts => new WatchSentinel(opts));
registerEntity('watch-bolt', opts => new WatchBolt(opts));
registerBestiary({ id: 'watch-sentinel', name: 'Meridian Sentry', hp: 18, where: 'The Buried Watch',
  text: 'Brass shutters guard its front. Hook them open, flank it, or strike after its marked three-bolt volley. Pots also interrupt it.' });
