// The hero. Reads input, walks, swings (systems/sword.js), uses the B item
// (items/inventory.js), talks (systems/interact.js), pushes against tiles and
// fires their onEnter/onLeave/onPush hooks, and scrolls at screen edges.
import { GROUND_Y, SCREEN_W, SCREEN_H } from '../core/constants.js';
import { state } from '../core/state.js';
import { input } from '../core/input.js';
import { lerpAngle } from '../core/math.js';
import { makeHero } from '../models/hero.js';
import { world } from '../world/world.js';
import { screenOrigin } from '../world/grid.js';
import { moveBody } from '../systems/physics.js';
import { startSwing, poseSword, tickSword, isSwinging } from '../systems/sword.js';
import { tryInteract } from '../systems/interact.js';
import { startScroll } from '../systems/transitions.js';
import { useSelectedItem, cycleItem } from '../items/inventory.js';
import { Entity } from './entity.js';

export const PLAYER_SPEED = 4.3;

export class Player extends Entity {
  constructor() {
    super({ r: 0.3 });
    this.type = 'player';
    this.kind = 'player';
    this.priority = -1;
    this.screenScoped = false;
    this.speed = PLAYER_SPEED;
    this.attackT = 0; // > 0 while swinging (sweep + recovery)
    this.swingId = 0; // counts swings; one swing hits an enemy once
    this.swordAngle = 0;
    this.invT = 0; // invulnerable (blinking) while > 0
    this.kx = 0;
    this.kz = 0;
    this.knockT = 0;
    this.walkT = 0;
    this.tileX = null; // tile under the hero, for onEnter/onLeave
    this.tileZ = null;
    this.hero = makeHero();
    this.object = this.hero.root;
  }

  // Forget the tile under the hero (after teleports) so onEnter fires fresh.
  resetTileTracking() {
    this.tileX = this.tileZ = null;
  }

  update(dt) {
    const mv = input.move();

    if (this.invT > 0) this.invT -= dt;
    if (input.pressed('sword') && tryInteract(this)) input.consume('sword');
    if (input.pressed('sword')) startSwing(this);
    if (input.pressed('next-item')) cycleItem(1);
    if (input.pressed('prev-item')) cycleItem(-1);
    if (input.pressed('item') && !isSwinging(this)) useSelectedItem(this);

    let vx = 0;
    let vz = 0;
    if (this.knockT > 0) {
      this.knockT -= dt;
      vx = this.kx;
      vz = this.kz;
    } else if (this.attackT <= 0) {
      vx = mv.x * this.speed;
      vz = mv.z * this.speed;
      if (mv.len > 0.1) this.yaw = lerpAngle(this.yaw, Math.atan2(mv.x, mv.z), Math.min(1, dt * 18));
    }
    moveBody(this, vx * dt, vz * dt, null);

    // Crossing the screen edge scrolls to the next screen.
    const o = screenOrigin(state.sx, state.sy);
    if (this.x < o.x) startScroll(-1, 0);
    else if (this.x > o.x + SCREEN_W) startScroll(1, 0);
    else if (this.z < o.z) startScroll(0, -1);
    else if (this.z > o.z + SCREEN_H) startScroll(0, 1);

    if (state.mode === 'play') this.touchTiles(mv, dt);

    const moving = Math.hypot(vx, vz) > 0.2 && this.knockT <= 0;
    this.animate(dt, moving);
    tickSword(this, dt);
  }

  touchTiles(mv, dt) {
    // Tile under the hero: warps, pits, floor switches.
    const tx = Math.floor(this.x);
    const tz = Math.floor(this.z);
    if (tx !== this.tileX || tz !== this.tileZ) {
      const px = this.tileX;
      const pz = this.tileZ;
      this.tileX = tx;
      this.tileZ = tz;
      if (px !== null) world.trigger(px, pz, 'onLeave', { player: this });
      world.trigger(tx, tz, 'onEnter', { player: this });
    }
    // Walking into the tile ahead: locked doors, chests, push blocks.
    if (state.mode === 'play' && mv.len > 0.1 && this.attackT <= 0) {
      const fx = Math.floor(this.x + Math.sin(this.yaw) * 0.55);
      const fz = Math.floor(this.z + Math.cos(this.yaw) * 0.55);
      world.trigger(fx, fz, 'onPush', { player: this, dt });
    }
  }

  animate(dt, moving) {
    const hero = this.hero;
    if (moving) this.walkT += dt * 13;
    else this.walkT = 0;
    const w = Math.sin(this.walkT);
    hero.legL.rotation.x = w * 0.7;
    hero.legR.rotation.x = -w * 0.7;
    hero.armL.rotation.x = -w * 0.3;
    hero.body.position.y = Math.abs(Math.sin(this.walkT)) * 0.04;
    poseSword(hero, this, w);
    hero.root.position.set(this.x, GROUND_Y, this.z);
    hero.root.rotation.y = this.yaw;
    hero.root.visible = this.invT <= 0 || state.mode === 'dead' || Math.floor(this.invT * 16) % 2 === 0;
  }
}

export const player = new Player();
