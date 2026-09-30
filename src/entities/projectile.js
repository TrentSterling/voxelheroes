// Base class for everything that flies: enemy shots (rocks, arrows, magic
// bolts, fireballs, lightning), the hero's arrows, sword beams and fire
// bolts, and reflected shots. One class, so walls, screen edges, the shield,
// the reflect spell and damage work the same for every shot.
//
//   class Arrow extends Projectile {
//     constructor(opts) {
//       super(opts, { owner: 'hero', damage: 4, speed: 12, source: 'arrow', geometry: arrowGeometry() });
//     }
//   }
//   registerEntity('arrow', (opts) => new Arrow(opts));
//   spawn('arrow', { x, z, dir: hero.facingVector() });      // or vx, vz in tiles per second
//
// Fields (def from the subclass, overridden by spawn opts):
//   owner        'enemy' (hurts the hero) | 'hero' (hurts enemies)
//   damage       enemy shots: base life units (receiveHit applies rings and
//                difficulty); hero shots: damage points (dealDamage)
//   speed, dir   tiles per second along dir; or vx, vz
//   tier         the shield tier that blocks it (hero.receiveHit): 2 arrows and
//                basic shots, 3 magic bolts, 4 fireballs, 5 lightning; Infinity
//                for shots nothing blocks. Default 2
//   source       the damage source for enemies' immunities ('arrow', 'beam',
//                'fire', ...); enemy shots default to 'enemy'
//   reflectable  blocked while the reflect spell is on, it flies back at
//                TUNING.guard.reflectSpeed x and hurts enemies (default true
//                for enemy shots)
//   deflectable  the blade knocks it apart (default true for enemy shots)
//   pierce       flies on through what it hits (each target once)
//   passWalls    ignores walls (teleporters' shots pass blocks)
//   range        tiles before it fizzles (default TUNING.scroll.projectileRange)
//   r            hit radius (0.16); height above the ground (0.35)
//   geometry (+ material) or object: how it looks
//   hitOpts      extra dealDamage options (stun for the boomerang, freeze, ...)
//
// Each tick: move (dt scaled by effects.worldScale: half speed under the slow
// spell, unless the hero owns the shot); past its range or out of the current screen: fizzle();
// in a tile that blocks shots: that tile's onShot hook, then onHitWall();
// enemy shots touching the hero: hero.receiveHit({ kind: 'projectile', tier }),
// then 'blocked' -> reflect or break, 'hit' -> break, 'ignored' -> fly on;
// hero shots touching an enemy: dealDamage, then break unless pierce.
// Subclasses may override animate(dt), onHitWall(tx, tz), onHitHero(result),
// onHitEnemy(entity, result), onReflect() and shatter(colors).
import * as THREE from 'three';
import { voxelMaterial } from '../core/voxel.js';
import { GROUND_Y } from '../core/constants.js';
import { state } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { TUNING } from '../core/tuning.js';
import { world, currentScreen } from '../world/world.js';
import { followsHero, currentCameraPreset } from '../core/camera.js';
import { burst } from '../systems/particles.js';
import { hero } from '../game/hero.js';
import { dealDamage } from '../game/damage.js';
import { effectActive, worldScale } from '../game/effects.js';
import { currentRect } from '../game/places.js';
import { Entity } from './entity.js';
import { entities } from './manager.js';
import { player } from './player.js';
import { partyHooks } from '../multiplayer/adapters.js';

export const SPARK = [0xffffff, 0xf1c232];
export const DUST = [0xb4a894, 0x8a7e6c];

let shots = 0;

// Does something at world point (x, z) stop a shot? Room side walls count
// from their visible face, half a tile in (world.shotBlockerAt names the
// tile that stops it).
export const shotBlocked = (x, z) => world.shotBlockedAt(x, z);

export class Projectile extends Entity {
  constructor(opts = {}, def = {}) {
    const o = { ...def, ...opts };
    super({ ...o, r: o.r ?? 0.16 });
    this.kind = 'projectile';
    this.priority = 10;
    this.owner = o.owner ?? 'enemy';
    this.hostile = this.owner !== 'hero';
    this.damage = o.damage ?? 1;
    this.tier = o.tier ?? 2;
    this.source = o.source ?? (this.owner === 'hero' ? 'arrow' : 'enemy');
    this.reflectable = o.reflectable ?? this.owner !== 'hero';
    this.deflectable = o.deflectable ?? this.owner !== 'hero';
    this.swordable = this.deflectable;
    this.pierce = !!o.pierce;
    this.passWalls = !!o.passWalls;
    this.flying = true;
    this.range = o.range ?? TUNING.scroll.projectileRange;
    this.travelled = 0;
    this.height = o.height ?? 0.35;
    this.hitOpts = o.hitOpts ?? {};
    this.shotId = `shot-${++shots}`;
    this.struck = new Set();
    this.reflected = false;
    const speed = o.speed ?? 6;
    if (o.dir) {
      const d = Math.hypot(o.dir.x, o.dir.z) || 1;
      this.vx = (o.dir.x / d) * speed;
      this.vz = (o.dir.z / d) * speed;
    } else {
      this.vx = o.vx ?? 0;
      this.vz = o.vz ?? 0;
    }
    if (o.object) this.object = o.object;
    else if (o.geometry) {
      this.mesh = new THREE.Mesh(o.geometry, o.material ?? voxelMaterial);
      this.mesh.castShadow = true;
      this.object = this.mesh;
    }
    this.yaw = Math.atan2(this.vx, this.vz);
    this.place();
  }

  // A point one tile back along the flight: where the shot comes from.
  tail() {
    const v = Math.hypot(this.vx, this.vz) || 1;
    return { x: this.x - this.vx / v, z: this.z - this.vz / v };
  }

  place() {
    if (!this.object) return;
    this.object.position.set(this.x, GROUND_Y + this.height, this.z);
    this.object.rotation.y = this.yaw;
  }

  animate(_dt) {}

  // Hold presets and rooms: the shot dies at the screen's edge. Follow
  // presets (A, D outdoors): 20 tiles from the hero (spec 4.3), since the
  // frame crosses screen lines with him.
  outOfScreen() {
    const s = currentScreen();
    if (s && !s.area.rooms && followsHero(currentCameraPreset(), s))
      return Math.hypot(this.x - player.x, this.z - player.z) > TUNING.scroll.projectileRange;
    const r = currentRect();
    return !r || this.x < r.x0 || this.x > r.x1 || this.z < r.z0 || this.z > r.z1;
  }

  update(rawDt) {
    const dt = rawDt * worldScale(this);
    const dx = this.vx * dt;
    const dz = this.vz * dt;
    this.x += dx;
    this.z += dz;
    this.travelled += Math.hypot(dx, dz);
    this.animate(dt);
    this.place();
    if (this.travelled > this.range || this.outOfScreen()) {
      this.fizzle();
      return;
    }
    const wall = this.passWalls ? null : world.shotBlockerAt(this.x, this.z);
    if (wall) {
      // the tile that stops it: by a room's side wall that is the wall, not
      // the floor tile the shot is over
      const [tx, tz] = wall;
      const hit = { damage: this.damage, fromX: this.x - dx, fromZ: this.z - dz, source: this.source, projectile: this };
      world.trigger(tx, tz, 'onShot', { projectile: this, hit });
      if (this.onHitWall(tx, tz) !== false) this.shatter(DUST);
      return;
    }
    if (this.owner === 'hero') this.hitEnemies();
    else this.hitHero();
  }

  hitHero() {
    if (state.mode !== 'play' || this.removed) return;
    if (Math.hypot(this.x - player.x, this.z - player.z) > this.r + player.r) return;
    const result = hero.receiveHit({ damage: this.damage, from: this.tail(), kind: 'projectile', tier: this.tier, source: this });
    if (this.onHitHero(result) === false) return;
    if (result === 'blocked') {
      if (this.reflectable && effectActive('reflect')) this.reflect();
      else this.shatter(SPARK);
    } else if (result === 'hit') this.shatter(DUST);
  }

  hitEnemies() {
    for (const e of [...entities]) {
      if (this.removed) return;
      if (e.removed || e === this || e.kind !== 'enemy' || this.struck.has(e)) continue;
      if (Math.hypot(e.x - this.x, e.z - this.z) > e.r + this.r) continue;
      const r = dealDamage(e, { amount: this.damage, source: this.source, from: this.tail(), swingId: this.shotId, by: this.reflected ? 'reflect' : 'hero', ...this.hitOpts });
      if (r.result === 'ignored') continue;
      this.struck.add(e);
      if (this.onHitEnemy(e, r) === false) continue;
      if (!this.pierce) {
        this.shatter(r.result === 'immune' || r.result === 'blocked' ? SPARK : DUST);
        return;
      }
    }
  }

  // Sent back by a guard under the reflect spell: now the hero's, faster.
  reflect() {
    const k = TUNING.guard.reflectSpeed;
    this.vx = -this.vx * k;
    this.vz = -this.vz * k;
    this.yaw = Math.atan2(this.vx, this.vz);
    this.owner = 'hero';
    this.hostile = false;
    this.reflected = true;
    this.deflectable = false;
    this.swordable = false;
    this.source = 'reflect';
    this.travelled = 0;
    this.struck.clear();
    sfx.block();
    this.onReflect();
  }

  // The blade knocks enemy shots apart.
  onSword() {
    if (!this.deflectable) return false;
    if (partyHooks.deflect(this)) return true;
    sfx.block();
    this.shatter(SPARK);
    return true;
  }

  // Hooks: return false from onHitWall / onHitHero / onHitEnemy to keep the
  // shot flying (a bouncing bolt, a boomerang).
  onHitWall(_tx, _tz) {}
  onHitHero(_result) {}
  onHitEnemy(_entity, _result) {}
  onReflect() {}

  shatter(colors = DUST) {
    if (this.removed) return;
    this.remove();
    burst(this.x, GROUND_Y + this.height, this.z, colors, 8, { speed: 2, size: 0.07, life: 0.5, up: 3 });
  }

  fizzle() {
    this.remove();
  }
}
