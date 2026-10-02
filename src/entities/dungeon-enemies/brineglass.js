import * as THREE from 'three';
import { Enemy } from '../enemy.js';
import { registerEntity } from '../registry.js';
import { registerBestiary } from '../../game/bestiary.js';
import { worldScale } from '../../game/effects.js';
import { world } from '../../world/world.js';
import { sfx } from '../../core/audio.js';
import { tideSkaterModel } from '../../models/brineglass.js';

const markGeometry = new THREE.PlaneGeometry(.65, .16).rotateX(-Math.PI / 2);
const markMaterial = new THREE.MeshBasicMaterial({ color: 0xffcb75, transparent: true, opacity: .8, depthWrite: false, toneMapped: false });
class TideglassSkater extends Enemy {
  constructor(opts) {
    super({ ...opts, crowned: false }, { hp: 18, r: .43, speed: 1.25, contactDamage: 1, heavy: true, drops: 'pack-c',
      poses: { closed: tideSkaterModel(), tell: tideSkaterModel('tell'), open: tideSkaterModel('open') } });
    this.ai.tide = { phase: 'hunt', t: .8, dx: 0, dz: 1, openT: 0, charges: 0 };
    this.cue = new THREE.Group();
    for (let i = 0; i < 15; i++) {
      const mark = new THREE.Mesh(markGeometry, markMaterial); mark.position.set(0, .20, .8 + i * .37);
      mark.userData.sharedGeometry = true; this.cue.add(mark);
    }
    this.holder.add(this.cue); this.present();
  }
  guards(hit) { return this.ai.tide.openT <= 0 && this.ai.tide.phase !== 'crash' && ['sword', 'spin', 'beam', 'arrow', 'dash'].includes(hit.source); }
  onBlocked(hit) { if (hit.swingId !== undefined) this.hitSwing = hit.swingId; sfx.block(); }
  onHurt(hit) {
    const a = this.ai.tide;
    if (hit.source === 'grapple') { a.phase = 'hunt'; a.t = .8; }
    else {
      a.openT = Math.max(a.openT, hit.source === 'fire' ? 5 : hit.source === 'pot' ? 2.5 : 1.5);
      a.phase = 'crash'; a.t = 1.1;
    }
    this.harmless = true; this.present();
  }
  crash() { const a = this.ai.tide; a.phase = 'crash'; a.t = 1.8; a.openT = Math.max(a.openT, 1.8); this.harmless = true; sfx.block(); }
  think(dt, { toP, dist, bounds }) {
    const a = this.ai.tide; a.t -= dt;
    if (a.phase === 'tell') {
      if (a.t <= 0) { a.phase = 'rush'; a.t = .72; a.charges++; this.harmless = false; }
      return;
    }
    if (a.phase === 'rush') {
      if (this.walk(a.dx * 7.5 * dt, a.dz * 7.5 * dt, bounds) || a.t <= 0) this.crash();
      return;
    }
    if (a.phase === 'crash') { if (a.t <= 0) { a.phase = 'hunt'; a.t = .65; this.harmless = false; } return; }
    this.harmless = false;
    if (dist < .05) return;
    this.yaw = Math.atan2(toP.x, toP.z);
    const clear = dist < 7 && Array.from({ length: Math.ceil(dist * 4) }, (_, i) => (i + 1) / Math.ceil(dist * 4)).every(k => !world.shotBlockedAt(this.x + toP.x * k, this.z + toP.z * k));
    if (a.t <= 0 && clear) { a.phase = 'tell'; a.t = .85; a.dx = toP.x / dist; a.dz = toP.z / dist; this.harmless = true; }
    else if (dist > 2.5) this.walk(toP.x / dist * this.speed * dt, toP.z / dist * this.speed * dt, bounds);
  }
  update(dt) { this.ai.tide.openT = Math.max(0, this.ai.tide.openT - dt * worldScale(this)); super.update(dt); this.present(); }
  // Room replicas display the owner's phase without advancing its charge.
  present() {
    const a = this.ai.tide;
    this.mesh.setPose(a.openT > 0 || a.phase === 'crash' ? 'open' : a.phase === 'tell' ? 'tell' : 'closed');
    this.cue.visible = this.spawned && a.phase === 'tell' && this.stunT <= 0 && this.knockT <= 0 && !(this.frozenT > 0);
    this.cue.rotation.y = Math.atan2(a.dx, a.dz) - this.holder.rotation.y;
  }
}
registerEntity('tideglass-skater', opts => new TideglassSkater(opts));
registerBestiary({ id: 'tideglass-skater', name: 'Tideglass Skater', hp: 18, where: 'Brineglass Temple',
  text: 'Its ice shell stops blades and arrows. Fire opens it for five seconds. Sidestep the marked charge and strike its crash recovery. Pots crack the shell; hooks only interrupt.' });
