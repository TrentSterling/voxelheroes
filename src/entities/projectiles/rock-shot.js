// The rock a spitter spits. Breaks on walls (but flies over water), is
// blocked by the shield from the front, and the sword knocks it apart.
import * as THREE from 'three';
import { voxelMaterial } from '../../core/voxel.js';
import { GROUND_Y, SCREEN_W, SCREEN_H } from '../../core/constants.js';
import { state } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { rockGeometry } from '../../models/rock.js';
import { world } from '../../world/world.js';
import { screenOrigin } from '../../world/grid.js';
import { burst } from '../../systems/particles.js';
import { hurtPlayer, shieldBlocks } from '../../systems/combat.js';
import { Entity } from '../entity.js';
import { player } from '../player.js';
import { registerEntity } from '../registry.js';

const DUST = [0xb4a894, 0x8a7e6c];
const SPARK = [0xffffff, 0xf1c232];
const HIT_DIST = 0.42; // reaches the hero within this distance

export class RockShot extends Entity {
  constructor(opts) {
    super({ ...opts, r: 0.16 }); // r + the blade's hitPad = the prototype's 0.3 deflect range
    this.kind = 'projectile';
    this.priority = 10;
    this.swordable = true;
    this.hostile = true;
    this.vx = opts.vx ?? 0;
    this.vz = opts.vz ?? 0;
    this.spin = 0;
    this.mesh = new THREE.Mesh(rockGeometry(), voxelMaterial);
    this.mesh.castShadow = true;
    this.mesh.position.set(this.x, GROUND_Y + 0.35, this.z);
    this.object = this.mesh;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.spin += dt * 12;
    this.mesh.position.set(this.x, GROUND_Y + 0.35, this.z);
    this.mesh.rotation.set(this.spin, this.spin * 0.5, 0);
    const b = screenOrigin(state.sx, state.sy);
    const out = this.x < b.x || this.x > b.x + SCREEN_W || this.z < b.z || this.z > b.z + SCREEN_H;
    if (out || world.blocksShot(Math.floor(this.x), Math.floor(this.z))) {
      this.shatter();
      return;
    }
    if (Math.hypot(this.x - player.x, this.z - player.z) < HIT_DIST && state.mode === 'play') {
      if (shieldBlocks(this.vx, this.vz)) {
        sfx.block();
        this.shatter(SPARK);
      } else if (player.invT <= 0) {
        this.shatter();
        hurtPlayer(1, this.x - this.vx, this.z - this.vz);
      }
    }
  }

  onSword() {
    sfx.block();
    this.shatter(SPARK);
    return true;
  }

  shatter(colors = DUST) {
    this.remove();
    burst(this.x, GROUND_Y + 0.3, this.z, colors, 8, { speed: 2, size: 0.07, life: 0.5, up: 3 });
  }
}

registerEntity('rock-shot', (opts) => new RockShot(opts));
