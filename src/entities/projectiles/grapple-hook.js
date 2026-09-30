import * as THREE from 'three';
import { Projectile } from '../projectile.js';
import { registerEntity } from '../registry.js';
import { entities } from '../manager.js';
import { player } from '../player.js';
import { world } from '../../world/world.js';
import { hero } from '../../game/hero.js';
import { collectPickup } from '../../game/pickups.js';
import { dealDamage } from '../../game/damage.js';
import { TUNING } from '../../core/tuning.js';
import { GROUND_Y } from '../../core/constants.js';
import { sfx } from '../../core/audio.js';
import { getMaterial } from '../../core/materials.js';
import { modelMesh } from '../../models/kit.js';
import { grappleModel } from '../../models/items/grapple.js';

const link = new THREE.BoxGeometry(1, 1, 1);
class Hook extends Projectile {
  constructor(opts) {
    const object = new THREE.Group();
    object.add(modelMesh(grappleModel()));
    super(opts, { owner: 'hero', source: 'grapple', damage: 0, speed: TUNING.items.grapple.speed,
      range: TUNING.items.grapple.range, r: 0.22, height: 0.45, object });
    this.chain = new THREE.Mesh(link, getMaterial('prop'));
    this.chain.scale.set(1 / 16, 1 / 16, 1);
    object.add(this.chain);
    this.phase = 'out'; this.carried = []; this.screenScoped = true;
  }
  back() { this.phase = 'back'; }
  latch(tx, tz) {
    const cx = tx + .5, cz = tz + .5, dx = player.x - cx, dz = player.z - cz, d = Math.hypot(dx, dz) || 1;
    this.x = cx; this.z = cz; this.phase = 'pull';
    sfx.block();
    hero.pull({ toX: cx + dx / d * 1.02, toZ: cz + dz / d * 1.02 }).then(() => {
      if (!this.removed) this.remove();
    });
  }
  update(dt) {
    if (this.phase === 'pull') { this.place(); return; }
    if (this.phase === 'back') {
      const dx = player.x - this.x, dz = player.z - this.z, d = Math.hypot(dx, dz);
      if (d <= .4) {
        for (const e of this.carried) if (!e.removed) collectPickup(e, { by: 'grapple' });
        this.remove(); return;
      }
      const step = Math.min(d, TUNING.items.grapple.speed * dt);
      this.x += dx / d * step; this.z += dz / d * step;
    } else {
      this.x += this.vx * dt; this.z += this.vz * dt;
      this.travelled += Math.hypot(this.vx, this.vz) * dt;
      const wall = world.shotBlockerAt(this.x, this.z);
      if (wall) {
        if (world.tileDefAt(...wall)?.grapple) this.latch(...wall);
        else { sfx.block(); this.back(); }
      } else {
        for (const e of entities) {
          if (e.removed || e === this || Math.hypot(e.x - this.x, e.z - this.z) > this.r + (e.r ?? .25)) continue;
          if (e.kind === 'enemy') {
            dealDamage(e, { amount: 0, source: 'grapple', from: player, swingId: this.shotId, stun: TUNING.enemy.stunGrapple, knockback: 0 });
            this.back(); break;
          }
          if (e.kind === 'pickup') { this.carried.push(e); this.back(); break; }
        }
        if (this.travelled >= this.range || this.outOfScreen()) this.back();
      }
    }
    for (const e of this.carried) if (!e.removed) { e.x = this.x; e.z = this.z; }
    this.place();
  }
  place() {
    this.object.position.set(this.x, GROUND_Y + this.height, this.z);
    this.object.children[0].rotation.y = this.yaw;
    if (!this.chain) return; // Projectile places the hook before its chain is constructed.
    const dx = player.x - this.x, dz = player.z - this.z;
    this.chain.position.set(dx / 2, 0, dz / 2);
    this.chain.rotation.y = Math.atan2(dx, dz);
    this.chain.scale.z = Math.hypot(dx, dz);
  }
}
registerEntity('grapple-hook', opts => new Hook(opts));
