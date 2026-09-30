// Returning boomerang projectile. The filename avoids EasyPrivacy's /boomerang.js rule.
// The boomerang in flight (gameplay spec 9.2; CONTRACTS 8.4, 8.6): out at
// TUNING.items.boomerang.speed to `range` tiles, then back to the hero at
// returnSpeed, through walls. It stuns what it hits for
// TUNING.enemy.stunBoomerang s (damage `damage`), turns back at the first
// enemy or wall it meets (walls get onShot with source 'boomerang': wall
// switches), and carries pickups it touches back to the hero.
import * as THREE from 'three';
import { GROUND_Y } from '../../core/constants.js';
import { sfx } from '../../core/audio.js';
import { TUNING } from '../../core/tuning.js';
import { getMaterial } from '../../core/materials.js';
import { world } from '../../world/world.js';
import { modelMesh } from '../../models/kit.js';
import { boomerangModel } from '../../models/items/items.js';
import { collectPickup } from '../../game/pickups.js';
import { worldScale } from '../../game/effects.js';
import { Projectile } from '../projectile.js';
import { entities } from '../manager.js';
import { player } from '../player.js';
import { registerEntity } from '../registry.js';

const B = () => TUNING.items.boomerang;

export class Boomerang extends Projectile {
  constructor(opts) {
    const o = new THREE.Group();
    o.add(modelMesh(boomerangModel(), getMaterial('character')));
    super(opts, {
      owner: 'hero',
      source: 'boomerang',
      damage: B().damage,
      speed: B().speed,
      range: Infinity,
      pierce: true,
      r: 0.3,
      height: 0.45,
      object: o,
      hitOpts: { stun: TUNING.enemy.stunBoomerang, knockback: 0 },
    });
    this.back = false;
    this.out = 0;
    this.carried = [];
    this.spin = 0;
    this.screenScoped = true;
  }

  turnBack() {
    if (this.back) return;
    this.back = true;
    this.passWalls = true;
  }

  animate(dt) {
    this.spin += dt * B().spin;
    if (this.object) this.object.children[0].rotation.y = this.spin;
  }

  update(rawDt) {
    const dt = rawDt * worldScale(this);
    if (this.back) {
      const dx = player.x - this.x;
      const dz = player.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d <= B().catch) return this.caught();
      const v = B().returnSpeed;
      this.vx = (dx / d) * v;
      this.vz = (dz / d) * v;
    }
    const sx = this.vx * dt;
    const sz = this.vz * dt;
    this.x += sx;
    this.z += sz;
    this.out += Math.hypot(sx, sz);
    this.animate(dt);
    this.place();
    if (!this.back) {
      const wall = world.shotBlockerAt(this.x, this.z);
      if (wall) {
        world.trigger(wall[0], wall[1], 'onShot', { projectile: this, hit: { damage: this.damage, fromX: this.x - sx, fromZ: this.z - sz, source: 'boomerang', projectile: this } });
        this.x -= sx;
        this.z -= sz;
        sfx.block();
        this.turnBack();
      } else if (this.out >= B().range || this.outOfScreen()) this.turnBack();
    }
    this.hitEnemies();
    // pick up what it touches and carry it home
    for (const e of entities) {
      if (e.removed || e.kind !== 'pickup' || this.carried.includes(e)) continue;
      if (Math.hypot(e.x - this.x, e.z - this.z) < this.r + (e.r ?? 0.25)) {
        this.carried.push(e);
        this.turnBack();
      }
    }
    for (const e of this.carried) {
      if (e.removed) continue;
      e.x = this.x;
      e.z = this.z;
    }
  }

  onHitEnemy() {
    this.turnBack();
    return false;
  }

  caught() {
    for (const e of this.carried) if (!e.removed) collectPickup(e, { by: 'boomerang' });
    this.remove();
  }

  place() {
    if (!this.object) return;
    this.object.position.set(this.x, GROUND_Y + this.height, this.z);
  }

  // hero shots never shatter on the blade; a boomerang never breaks
  shatter() {
    this.turnBack();
  }
  fizzle() {
    this.turnBack();
  }
}

registerEntity('boomerang', (opts) => new Boomerang(opts));
