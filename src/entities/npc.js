// Base class for people and other things the hero talks to: townsfolk, the
// smith, shopkeepers, a talking statue. An NPC is solid (the hero and enemies
// walk around it, not through it), idles on the spot, turns to face the hero
// when spoken to and says its lines.
//
//   class Smith extends Npc {
//     constructor(opts) {
//       super(opts, { model: makeHero(getMaterial('character'), SMITH_COLOURS).root, name: 'Brannoc' });
//     }
//     async talk() {
//       const choice = await showDialog('Hammer out a longer blade for 50 gems?', { speaker: this.name, choices: ['Yes', 'No'] });
//       if (choice === 0 && state.gems >= 50) { ... }
//     }
//   }
//   registerEntity('smith', (opts) => new Smith(opts));
//
// Second constructor argument (spawn-table fields win over it):
//   model  Object3D facing +z, standing on y 0 (added to this.holder)
//   name   shown on the dialog box
//   lines  what the default talk() says (a string or a list of pages)
//   r      collision radius (default 0.34)
//   yaw    facing before anyone talks to it (default 0: towards the camera)
// A generic one is registered as 'npc' (entities/npcs/npc.js).
import * as THREE from 'three';
import { GROUND_Y } from '../core/constants.js';
import { lerpAngle } from '../core/math.js';
import { showDialog } from '../ui/dialog.js';
import { Entity } from './entity.js';

export class Npc extends Entity {
  constructor(opts = {}, def = {}) {
    super({ ...opts, r: opts.r ?? def.r ?? 0.34 });
    this.kind = 'npc';
    this.priority = 30;
    this.solid = true;
    this.name = opts.name ?? def.name ?? '';
    this.lines = opts.lines ?? def.lines ?? null;
    this.yaw = opts.yaw ?? def.yaw ?? 0;
    this.idleT = (this.x * 1.7 + this.z * 2.3) % (Math.PI * 2); // idle phase, same on every visit
    this.holder = new THREE.Group();
    this.model = def.model ?? null;
    if (this.model) this.holder.add(this.model);
    this.holder.position.set(this.x, GROUND_Y, this.z);
    this.holder.rotation.y = this.yaw;
    this.object = this.holder;
  }

  update(dt) {
    this.idleT += dt;
    if (this.model) this.model.position.y = Math.abs(Math.sin(this.idleT * 1.6)) * 0.02;
    this.holder.position.set(this.x, GROUND_Y, this.z);
    this.holder.rotation.y = lerpAngle(this.holder.rotation.y, this.yaw, Math.min(1, dt * 10));
  }

  // Turn towards (x, z) at once: the game stops while a dialog box is open.
  face(x, z) {
    this.yaw = Math.atan2(x - this.x, z - this.z);
    this.holder.rotation.y = this.yaw;
  }

  // A pressed while the hero faces it (systems/interact.js).
  onInteract(player) {
    this.face(player.x, player.z);
    this.talk(player);
    return true;
  }

  // What the NPC does when spoken to. Default: say `lines`. Override it for
  // shops, quests and choices; returning showDialog's promise is enough.
  talk(_player) {
    if (!this.lines) return undefined;
    return showDialog(this.lines, this.name ? { speaker: this.name } : {});
  }
}
