// Base class for things the hero walks over to collect. A subclass passes its
// geometry and implements collect():
//
//   class Arrows extends Pickup {
//     constructor(opts) { super(opts, arrowBundleGeometry()); }
//     collect() { addAmmo('arrows', 5); sfx.gem(); }
//   }
//   registerEntity('arrows', (opts) => new Arrows(opts));
//
// Pickups bounce in, spin, blink for their last two seconds and vanish after
// `life` seconds (default 9; Infinity for keys). They can be collected 0.25 s
// after appearing, within 0.6 tiles of the hero, in play mode.
import * as THREE from 'three';
import { voxelMaterial } from '../core/voxel.js';
import { GROUND_Y } from '../core/constants.js';
import { state } from '../core/state.js';
import { emit } from '../core/events.js';
import { Entity } from './entity.js';
import { player } from './player.js';

export class Pickup extends Entity {
  constructor(opts, geometry) {
    super({ ...opts, r: opts.r ?? 0.25 });
    this.kind = 'pickup';
    this.priority = 20;
    this.t = 0;
    this.life = opts.life ?? 9;
    this.mesh = new THREE.Mesh(geometry, voxelMaterial);
    this.mesh.castShadow = true;
    this.mesh.position.set(this.x, GROUND_Y + 0.12, this.z);
    this.mesh.scale.setScalar(0);
    this.object = this.mesh;
  }

  collect() {}

  update(dt) {
    this.t += dt;
    this.life -= dt;
    const pop = Math.min(1, this.t * 3);
    this.mesh.position.set(this.x, GROUND_Y + 0.12 + Math.abs(Math.sin(this.t * 3)) * 0.12 * (this.t < 0.6 ? 3 : 1), this.z);
    this.mesh.rotation.y = this.t * 2.5;
    this.mesh.scale.setScalar(pop);
    this.mesh.visible = this.life > 2 || Math.floor(this.life * 8) % 2 === 0;
    const got = this.t > 0.25 && Math.hypot(this.x - player.x, this.z - player.z) < 0.6 && state.mode === 'play';
    if (got) {
      this.collect();
      emit('pickup', { entity: this, type: this.type });
    }
    if (got || this.life <= 0) this.remove();
  }
}
