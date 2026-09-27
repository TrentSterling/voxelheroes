// Base class for enemies. It handles what every enemy shares with the
// prototype's slime and spitter: popping in (staggered by spawnIndex),
// knockback and stun when hit, the white hit flash, touch damage, the burst
// of cubes and the loot roll on death. A subclass passes its stats and
// implements think(dt, { toP, dist, bounds }) for its AI:
//
//   class Bat extends Enemy {
//     constructor(opts) {
//       super(opts, { hp: 1, r: 0.3, speed: 3, colors: [...], geometry: batGeometry() });
//     }
//     think(dt, { toP, dist, bounds }) { ...set this.yaw, call moveBody(this, dx, dz, bounds)... }
//   }
//   registerEntity('bat', (opts) => new Bat(opts));
//
// Stats: hp, r, speed, colors (death burst), geometry, contactDamage (1),
// drops (drop table name, 'enemy'). Set countsForClear = false for enemies a
// room can be cleared without killing. Set flying = true for enemies that
// cross water and pits. Bombs hurt every enemy through onBomb (2 damage
// unless the explosion says otherwise); override it for bomb-proof ones.
// Knockback decays at the same rate per second at any frame rate.
import * as THREE from 'three';
import { voxelMaterial } from '../core/voxel.js';
import { GROUND_Y } from '../core/constants.js';
import { state } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { random } from '../core/random.js';
import { lerpAngle } from '../core/math.js';
import { burst } from '../systems/particles.js';
import { moveBody } from '../systems/physics.js';
import { rollDrop } from '../systems/drops.js';
import { hurtPlayer, checkRoomCleared } from '../systems/combat.js';
import { currentScreen } from '../world/world.js';
import { Entity } from './entity.js';
import { player } from './player.js';

const KNOCKBACK_DECAY = 0.85; // knockback speed kept per 1/60 s

export class Enemy extends Entity {
  constructor(opts, def) {
    super({ ...opts, r: def.r });
    this.kind = 'enemy';
    this.priority = 0;
    this.swordable = true;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.speed = def.speed;
    this.colors = def.colors;
    this.contactDamage = def.contactDamage ?? 1;
    this.drops = def.drops ?? 'enemy';
    this.mat = voxelMaterial.clone(); // own material so the hit flash is per enemy
    this.mesh = new THREE.Mesh(def.geometry, this.mat);
    this.mesh.castShadow = true;
    this.holder = new THREE.Group();
    this.holder.add(this.mesh);
    this.holder.scale.setScalar(0.001);
    this.holder.position.set(this.x, GROUND_Y, this.z);
    this.object = this.holder;
    this.dx = 0;
    this.dz = 0;
    this.yaw = random() * Math.PI * 2;
    this.thinkT = 0.5 + random();
    this.hopT = random() * 3;
    this.kx = 0;
    this.kz = 0;
    this.stunT = 0;
    this.flashT = 0;
    this.spawnT = opts.spawnDelay ?? 0.35 + (opts.spawnIndex ?? 0) * 0.12;
    this.spawned = false;
    this.growT = 0;
    this.hitSwing = -1;
  }

  // AI while not stunned. Override in subclasses.
  think(_dt, _ctx) {}

  update(dt) {
    if (!this.spawned) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawned = true;
        this.growT = 0;
        burst(this.x, GROUND_Y + 0.3, this.z, [0xffffff, 0xdddddd, 0xbbbbbb], 12, { speed: 2, up: 2, size: 0.09, life: 0.5 });
      }
      return;
    }
    if (this.growT < 1) {
      this.growT = Math.min(1, this.growT + dt * 4);
      this.holder.scale.setScalar(this.growT);
    }

    const bounds = currentScreen(); // a rect: enemies stay on their screen
    const toP = { x: player.x - this.x, z: player.z - this.z };
    const dist = Math.hypot(toP.x, toP.z);

    if (this.stunT > 0) {
      this.stunT -= dt;
      moveBody(this, this.kx * dt, this.kz * dt, bounds);
      const decay = Math.pow(KNOCKBACK_DECAY, dt * 60); // 0.85 per 1/60 s tick
      this.kx *= decay;
      this.kz *= decay;
    } else {
      this.think(dt, { toP, dist, bounds });
    }

    this.holder.position.set(this.x, GROUND_Y, this.z);
    this.holder.rotation.y = lerpAngle(this.holder.rotation.y, this.yaw, Math.min(1, dt * 12));

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.mat.emissive.setHex(this.flashT > 0 ? 0xffffff : 0x000000);
    }

    if (dist < this.r + player.r && player.invT <= 0 && state.mode === 'play') hurtPlayer(this.contactDamage, this.x, this.z);
  }

  // One sword swing hits each enemy at most once, and only once it is visible.
  canBeHit(hit) {
    return this.spawned && (hit.swingId === undefined || this.hitSwing !== hit.swingId);
  }

  hurt(hit) {
    this.hp -= hit.damage ?? 1;
    if (hit.swingId !== undefined) this.hitSwing = hit.swingId;
    this.flashT = 0.14;
    this.stunT = hit.stun ?? 0.28;
    const dx = this.x - (hit.fromX ?? this.x);
    const dz = this.z - (hit.fromZ ?? this.z);
    const d = Math.hypot(dx, dz) || 1;
    this.kx = (dx / d) * (hit.knockback ?? 9);
    this.kz = (dz / d) * (hit.knockback ?? 9);
    burst(this.x, GROUND_Y + 0.35, this.z, [0xffffff, 0xfff3b0], 6, { speed: 2.5, size: 0.06, life: 0.35, up: 3 });
    if (this.hp <= 0) this.die(hit);
    else sfx.hit();
    return true;
  }

  // An 'explosion' covers it (systems/blast.js).
  onBomb(explosion) {
    const hit = { damage: explosion.damage ?? 2, fromX: explosion.x, fromZ: explosion.z, source: 'bomb', explosion };
    if (!this.canBeHit(hit)) return false;
    return this.hurt(hit);
  }

  die(hit = null) {
    this.remove();
    burst(this.x, GROUND_Y + 0.35, this.z, this.colors, 34, { speed: 3.5, size: 0.12, up: 5, life: 1.1 });
    sfx.kill();
    rollDrop(this.drops, this.x, this.z);
    this.markDone();
    emit('enemy-killed', { entity: this, hit });
    checkRoomCleared();
  }
}
