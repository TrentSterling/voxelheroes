// Base class for enemies (CONTRACTS 8.5). It handles what every enemy
// shares: popping in (TUNING.scroll.spawnWait, then spawnStagger between
// enemies, spec 4.3), the stagger and stun of a hit (hit.tiles over
// TUNING.enemy.knockTime, then hit.stun), the white hit flash, contact
// damage through hero.receiveHit (a guard block knocks the enemy
// TUNING.guard.attackerKnock tiles back and stuns it attackerStun s), the
// crown (TUNING.enemy.crownedChance: 1.5 x speed), the slow spell
// (effects.worldScale), the burst of cubes and the drop roll on death. A
// subclass passes its stats and implements think(dt, { toP, dist, bounds }):
//
//   class Bat extends Enemy {
//     constructor(opts) {
//       super(opts, { hp: 3, r: 0.3, speed: 4, poses: { a: m0, b: m1 }, contactDamage: 1, drops: 'pack-a' });
//     }
//     think(dt, { toP, dist, bounds }) { ...set this.yaw, call this.walk(dx, dz, dt, bounds)... }
//   }
//   registerEntity('bat', (opts) => new Bat(opts));
//
// Def fields: hp, r, speed, colors (death burst; default: the model's
// colours), model | poses | geometry, contactDamage (life units, 1 = half a
// heart), drops (a drop table), heavy (staggers TUNING.enemy.heavyKnock),
// shadow (radius), height (fliers hover this high). Fields a subclass may
// set: countsForClear = false (traps), flying (crosses water and pits),
// immune, weak, guards(hit), boss, rare, invulnerable, airborne (true while
// a hopper is in the air: it cannot be hit, spec 8.2), harmless (no
// contact damage now). Entities/ai.js has the behaviour primitives.
//
// Subclasses never call hurtPlayer: contact goes through touchHero(), which
// update() calls every tick.
import * as THREE from 'three';
import { scene } from '../core/renderer.js';
import { makeCharacterMaterial, getMaterial } from '../core/materials.js';
import { GROUND_Y } from '../core/constants.js';
import { state } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { random } from '../core/random.js';
import { lerpAngle } from '../core/math.js';
import { TUNING } from '../core/tuning.js';
import { burst, sparks, smoke } from '../systems/particles.js';
import { PoseMesh, contactShadow, settleShadow, modelMesh } from '../models/kit.js';
import { crownModel } from '../models/foes/foes.js';
import { moveBody } from '../systems/physics.js';
import { rollDrop } from '../systems/drops.js';
import { checkRoomCleared } from '../systems/combat.js';
import { registerPlayHook } from '../systems/flow.js';
import { currentScreen } from '../world/world.js';
import { hero } from '../game/hero.js';
import { dealDamage } from '../game/damage.js';
import { worldScale } from '../game/effects.js';
import { isCleared } from '../game/clears.js';
import { screenId } from '../game/places.js';
import { Entity } from './entity.js';
import { player } from './player.js';

const KNOCKBACK_DECAY = 0.85; // M1 knockback speed kept per 1/60 s (hits with no `tiles`)

// A dead foe's own die() already removes it from play at once (room-cleared,
// drops, hp checks never wait on this); its holder mesh lingers this long,
// popping (a quick scale up, then away), purely as a look: none of it is on
// the entities list any more, so it is driven by its own tiny play hook.
const DEATH_POP_TIME = 0.16;
const deathPops = [];
function stepDeathPops(dt) {
  for (let i = deathPops.length - 1; i >= 0; i--) {
    const p = deathPops[i];
    p.t += dt;
    const k = Math.min(1, p.t / DEATH_POP_TIME);
    const s = k < 0.3 ? 1 + k * 1.0 : Math.max(0, 1.3 - (k - 0.3) * (1.3 / 0.7));
    p.holder.scale.setScalar(s);
    if (k >= 1) {
      scene.remove(p.holder);
      deathPops.splice(i, 1);
    }
  }
}
registerPlayHook({ id: 'enemy-death-pop', phase: 'after', order: 5, update: stepDeathPops });

export class Enemy extends Entity {
  constructor(opts, def) {
    super({ ...opts, r: def.r });
    this.kind = 'enemy';
    this.priority = 0;
    this.swordable = true;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.crowned = opts.crowned ?? random() < TUNING.enemy.crownedChance;
    this.baseSpeed = def.speed;
    this.speed = def.speed * (this.crowned ? TUNING.enemy.crownedSpeed : 1);
    this.colors = def.colors ?? (def.poses ? Object.values(def.poses)[0] : def.model)?.colors ?? [0xffffff];
    this.contactDamage = def.contactDamage ?? 1;
    this.drops = def.drops ?? 'enemy';
    this.heavy = !!def.heavy;
    this.rare = !!opts.rare || !!def.rare;
    this.height = def.height ?? 0;
    this.homeScreen = opts.screen ?? null;
    this.mat = makeCharacterMaterial(); // own material so the hit flash is per enemy
    this.mesh = def.poses ? new PoseMesh(def.poses, this.mat) : new THREE.Mesh(def.geometry ?? def.model.geometry, this.mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.y = this.height;
    this.holder = new THREE.Group();
    this.holder.add(this.mesh);
    this.shadowR = def.shadow ?? def.r * 1.15;
    this.shadow = contactShadow(this.shadowR);
    this.holder.add(this.shadow);
    if (this.crowned) {
      this.crown = modelMesh(crownModel(), getMaterial('character'));
      this.crown.position.y = this.height + TUNING.enemy.crownHeight;
      this.holder.add(this.crown);
    }
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
    this.knockT = 0;
    this.stunT = 0;
    this.flashT = 0;
    this.spawnT = opts.spawnDelay ?? TUNING.scroll.spawnWait + (opts.spawnIndex ?? 0) * TUNING.scroll.spawnStagger;
    this.spawned = false;
    this.growT = 0;
    this.hitSwing = -1;
    this.ai = {}; // entities/ai.js keeps its state here
  }

  // A screen remembered as cleared (game/clears.js) places no enemies.
  onAdd() {
    const s = this.homeScreen ?? currentScreen();
    if (this.countsForClear !== false && !this.boss && s && isCleared(screenId(s))) this.remove();
  }

  // AI while not stunned. Override in subclasses.
  think(_dt, _ctx) {}

  // Move by (dx, dz) tiles against walls and the screen; true if stopped.
  walk(dx, dz, bounds = currentScreen()) {
    return moveBody(this, dx, dz, bounds);
  }

  update(rawDt) {
    const dt = rawDt * worldScale(this);
    if (!this.spawned) {
      this.spawnT -= rawDt;
      if (this.spawnT <= 0) {
        this.spawned = true;
        this.growT = 0;
        smoke(this.x, GROUND_Y + 0.1, this.z, 8);
      }
      return;
    }
    if (this.growT < 1) {
      this.growT = Math.min(1, this.growT + dt * 4);
      this.holder.scale.setScalar(this.growT);
    }

    const bounds = currentScreen(); // enemies stay on their screen (also while the hero is in a follow change's dead band, past its edge)
    const toP = { x: player.x - this.x, z: player.z - this.z };
    const dist = Math.hypot(toP.x, toP.z);

    if (this.knockT > 1e-9) {
      const step = Math.min(dt, this.knockT);
      this.knockT -= step;
      moveBody(this, this.kx * step, this.kz * step, bounds);
      if (this.knockT <= 1e-9) this.kx = this.kz = 0;
    } else if (this.stunT > 0) {
      this.stunT -= dt;
      if (this.kx || this.kz) {
        moveBody(this, this.kx * dt, this.kz * dt, bounds);
        const decay = Math.pow(KNOCKBACK_DECAY, dt * 60); // 0.85 per 1/60 s tick
        this.kx *= decay;
        this.kz *= decay;
      }
    } else {
      this.think(dt, { toP, dist, bounds });
    }

    this.holder.position.set(this.x, GROUND_Y, this.z);
    this.holder.rotation.y = lerpAngle(this.holder.rotation.y, this.yaw, Math.min(1, dt * 12));
    settleShadow(this.shadow, this.mesh.position.y, this.shadowR);
    if (this.crown) {
      this.crown.position.y = this.mesh.position.y + TUNING.enemy.crownHeight;
      this.crown.rotation.y += dt * 2;
    }

    if (this.flashT > 0) {
      this.flashT -= rawDt;
      this.mat.emissive.setHex(this.flashT > 0 ? 0xffffff : 0x000000);
    }
    if (dist < (this.r + player.r) * TUNING.enemy.contactReach) this.touchHero();
  }

  // Contact damage (CONTRACTS 8.5): through the hero's receiveHit; a guard
  // block knocks this enemy back and stuns it.
  touchHero() {
    if (state.mode !== 'play' || this.harmless || this.airborne || this.frozenT > 0 || !this.contactDamage) return null;
    const result = hero.receiveHit({ damage: this.contactDamage, from: this, kind: 'contact', source: this });
    if (result === 'blocked') this.recoil();
    return result;
  }

  // Knocked `tiles` away from the hero, then stunned (a guard block).
  recoil(tiles = TUNING.guard.attackerKnock, stun = TUNING.guard.attackerStun) {
    if (this.boss) return;
    this.knockAway(player.x, player.z, tiles);
    this.stunT = stun;
  }

  knockAway(fx, fz, tiles, time = TUNING.enemy.knockTime) {
    const dx = this.x - fx;
    const dz = this.z - fz;
    const d = Math.hypot(dx, dz) || 1;
    const t = time;
    this.kx = (dx / d) * (tiles / t);
    this.kz = (dz / d) * (tiles / t);
    this.knockT = tiles > 0 ? t : 0;
  }

  // One sword swing (or one shot, one blast) hits each enemy at most once,
  // and only once it is visible; hoppers in the air cannot be hit.
  canBeHit(hit) {
    return this.spawned && !this.airborne && (hit.swingId === undefined || this.hitSwing !== hit.swingId);
  }

  hurt(hit) {
    this.hp -= hit.damage ?? 1;
    if (hit.swingId !== undefined) this.hitSwing = hit.swingId;
    this.flashT = TUNING.sword.enemyFlash;
    if (hit.tiles !== undefined) {
      // dealDamage: hit.tiles of stagger over hitKnockTime (a quick shove), then the stun
      const tiles = this.boss ? 0 : hit.tiles;
      this.knockAway(hit.fromX ?? this.x, hit.fromZ ?? this.z, tiles, TUNING.enemy.hitKnockTime);
      this.stunT = Math.max(0, (hit.stun ?? 0) - (tiles > 0 ? TUNING.enemy.knockTime : 0));
      if (this.boss) this.stunT = 0;
    } else {
      // an M1 caller: knockback speed decaying while stunned
      this.stunT = hit.stun ?? 0.28;
      const dx = this.x - (hit.fromX ?? this.x);
      const dz = this.z - (hit.fromZ ?? this.z);
      const d = Math.hypot(dx, dz) || 1;
      this.kx = (dx / d) * (hit.knockback ?? 9);
      this.kz = (dz / d) * (hit.knockback ?? 9);
    }
    this.onHurt?.(hit);
    sparks(this.x, GROUND_Y + 0.35 + this.height, this.z, [0xffffff, 0xfff3b0], 8, { speed: 3, size: 0.05, life: 0.3, up: 3 });
    if ((hit.damage ?? 1) > 0) burst(this.x, GROUND_Y + 0.35 + this.height, this.z, this.colors, 4, { speed: 2.5, size: 0.07, life: 0.35, up: 3 });
    if (this.hp <= 0) this.die(hit);
    else sfx.hit();
    return true;
  }

  // An 'explosion' covers it (systems/blast.js): a bomb hit through dealDamage.
  onBomb(explosion) {
    const from = { x: explosion.x, z: explosion.z };
    return dealDamage(this, { amount: explosion.damage ?? TUNING.items.bomb.damage, source: 'bomb', from, swingId: explosion.id, by: 'hero' }).result;
  }

  die(hit = null) {
    const holder = this.holder;
    this.object = new THREE.Object3D(); // a stand-in so remove() leaves the real holder in the scene to pop
    this.remove();
    deathPops.push({ holder, t: 0 });
    burst(this.x, GROUND_Y + 0.35 + this.height, this.z, this.colors, 34, { speed: 3.5, size: 0.12, up: 5, life: 1.1 });
    smoke(this.x, GROUND_Y + 0.15, this.z, 5, { radius: 0.13 });
    sfx.kill();
    if (this.drops) rollDrop(this.drops, this.x, this.z);
    this.markDone();
    emit('enemy-killed', { entity: this, hit });
    checkRoomCleared();
  }
}
