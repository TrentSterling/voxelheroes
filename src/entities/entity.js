// Base class for everything that moves or can be picked up: enemies,
// projectiles, pickups, NPCs. The hero (entities/player.js) extends it too.
//
// Contract:
//   x, z, r        position (world units) and collision radius
//   yaw            facing; 0 looks at +z (towards the camera)
//   kind           'enemy' | 'projectile' | 'pickup' | 'npc' | ...
//   priority       update order, lower first
//   object         THREE.Object3D the manager adds to / removes from the scene
//   screenScoped   belongs to the screen it is on (default true): kept with it
//                  outdoors when the hero walks on (entities/manager.js buckets),
//                  removed when he leaves a room or the screen leaves the live ring
//   onWake()       optional: placed or woken where nobody watched (its screen came
//                  into the live ring, or the hero came back near it)
//   solid          blocks the hero and every body moved with moveBody, like a
//                  wall (NPCs, push blocks). Default false: enemies, pickups
//                  and shots overlap freely. A solid body that moves is also
//                  stopped by the hero.
//   flying         passes over low tiles (tiles with blocksShots: false:
//                  water, pits, lava) when moved with moveBody. Default false.
//   swordable      the sword tests this entity (then canBeHit/onSword apply)
//   update(dt)     called every frame in play mode
//   hurt(hit)      take a hit: { damage, fromX, fromZ, knockback, stun, source, swingId }
//   onSword(hit)   the blade touched it; default: hurt(hit)
//   onBomb(explosion)   optional: an 'explosion' covers it (systems/blast.js);
//                  Enemy's default takes a bomb hit
//   onInteract(player)  optional: A pressed while facing it (NPCs, signs)
//   remove()       take it out of the world (safe at any time)
//   markDone()     never spawn this map marker again (keys, one-off enemies)
import { setFlag } from '../core/state.js';
import { removeEntity } from './manager.js';
import { partyHooks } from '../multiplayer/adapters.js';

export class Entity {
  constructor(opts = {}) {
    this.spawnOptions = opts;
    this.netId = opts.netId ?? null;
    this.type = null; // set by the registry
    this.kind = 'thing';
    this.priority = 30;
    this.x = opts.x ?? 0;
    this.z = opts.z ?? 0;
    this.r = opts.r ?? 0.3;
    this.yaw = opts.yaw ?? 0;
    this.object = null;
    this.screenScoped = true;
    this.solid = false;
    this.flying = false;
    this.swordable = false;
    this.removed = false;
    this.spawnFlag = opts.spawnFlag ?? null;
  }

  targetHero() { return partyHooks.target(this); }

  update(_dt) {}

  canBeHit(_hit) {
    return true;
  }

  onSword(hit) {
    return this.hurt(hit);
  }

  hurt(_hit) {
    return false;
  }

  markDone() {
    if (this.spawnFlag) setFlag(this.spawnFlag);
  }

  remove() {
    removeEntity(this);
  }

  distTo(x, z) {
    return Math.hypot(this.x - x, this.z - z);
  }
}
