// Base class for everything that moves or can be picked up: enemies,
// projectiles, pickups, NPCs. The hero (entities/player.js) extends it too.
//
// Contract:
//   x, z, r        position (world units) and collision radius
//   yaw            facing; 0 looks at +z (towards the camera)
//   kind           'enemy' | 'projectile' | 'pickup' | 'npc' | ...
//   priority       update order, lower first
//   object         THREE.Object3D the manager adds to / removes from the scene
//   screenScoped   removed when the hero leaves the screen (default true)
//   swordable      the sword tests this entity (then canBeHit/onSword apply)
//   update(dt)     called every frame in play mode
//   hurt(hit)      take a hit: { damage, fromX, fromZ, knockback, stun, source, swingId }
//   onSword(hit)   the blade touched it; default: hurt(hit)
//   onInteract(player)  optional: A pressed while facing it (NPCs, signs)
//   remove()       take it out of the world (safe at any time)
//   markDone()     never spawn this map marker again (keys, one-off enemies)
import { state } from '../core/state.js';
import { removeEntity } from './manager.js';

export class Entity {
  constructor(opts = {}) {
    this.type = null; // set by the registry
    this.kind = 'thing';
    this.priority = 30;
    this.x = opts.x ?? 0;
    this.z = opts.z ?? 0;
    this.r = opts.r ?? 0.3;
    this.yaw = opts.yaw ?? 0;
    this.object = null;
    this.screenScoped = true;
    this.swordable = false;
    this.removed = false;
    this.spawnFlag = opts.spawnFlag ?? null;
  }

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
    if (this.spawnFlag) state.flags.add(this.spawnFlag);
  }

  remove() {
    removeEntity(this);
  }

  distTo(x, z) {
    return Math.hypot(this.x - x, this.z - z);
  }
}
