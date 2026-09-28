// The hero (gameplay spec 7.2 to 7.11). Reads input, walks 8-way at a
// constant speed with the 0.8 box and corner assist (systems/hero-body.js),
// keeps the 4-way attack facing, thrusts and spins (systems/sword.js),
// guards, dashes, uses the B item (items/inventory.js), talks
// (systems/interact.js), applies the tile fields under him (hazards, stairs,
// conveyors), fires tile hooks (onEnter/onLeave/onPush), and leaves the
// screen at its edges. Every number is TUNING.hero, .sword, .guard, .dash or
// .damage. game/hero.js is the API over it and the one pose authority.
//
// New fields (CONTRACTS 5): facing ('north' | 'east' | 'south' | 'west'),
// guarding, dashing (null or { dir, speed, neutralT, rehitT }), thrust
// (sword.js), lockT (locked input), stallT (a dash crash's stall), stickDir.
import { GROUND_Y } from '../core/constants.js';
import { state } from '../core/state.js';
import { input } from '../core/input.js';
import { on } from '../core/events.js';
import { sfx } from '../core/audio.js';
import { TUNING } from '../core/tuning.js';
import { makeHero } from '../models/hero.js';
import { world, currentScreen } from '../world/world.js';
import { moveHero } from '../systems/hero-body.js';
import { startSwing, poseSword, tickSword, isRooted, endSwing, bladeSweep, swordStats } from '../systems/sword.js';
import { updateBladeFx } from '../systems/sword-fx.js';
import { tryInteract } from '../systems/interact.js';
import { crossEdge, edgeCrossed } from '../systems/transitions.js';
import { burst, smoke } from '../systems/particles.js';
import { toast } from '../ui/toast.js';
import { useSelectedItem, cycleItem } from '../items/inventory.js';
import { makeGuardShield } from '../models/hero/shield.js';
import { Entity } from './entity.js';

// M1 name; the walking speed is TUNING.hero.walk.
export const PLAYER_SPEED = 4.5;

const FACING_YAW = { north: Math.PI, east: Math.PI / 2, south: 0, west: -Math.PI / 2 };
const FACING_VEC = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
const H_OF = (x) => (x > 0 ? 'east' : 'west');
const V_OF = (z) => (z > 0 ? 'south' : 'north');
const CARDINAL = ['north', null, 'east', null, 'south', null, 'west', null];
// The cardinal nearest a yaw (yaw 0 faces +z, south).
function facingOfYaw(yaw) {
  const x = Math.sin(yaw);
  const z = Math.cos(yaw);
  if (Math.abs(x) > Math.abs(z)) return x > 0 ? 'east' : 'west';
  return z > 0 ? 'south' : 'north';
}
const BOOTS = ['boots-dash', 'boots-swamp'];

// Standing still he keeps cycling with half the sway (M1's idle ratio): the
// camera's hero outline (core/camera.js HERO_OUTLINE, which the camera
// play-test holds the model to) leaves no room for a full 6-degree lean at
// rest by the south line. Walking sways the full TUNING.hero.sway.
const IDLE_SWAY = 0.5;
const DASH_REV = 0.2; // seconds of running in place before a dash charges
const DASH_BRAKE = 0.1; // seconds held against a dash to stop it

export class Player extends Entity {
  constructor() {
    super({ r: TUNING.hero.box / 2 });
    this.type = 'player';
    this.kind = 'player';
    this.priority = -1;
    this.screenScoped = false;
    this.speed = TUNING.hero.walk;
    this.facing = 'south';
    this.attackT = 0; // > 0 while the blade is out (extend, hold, retract)
    this.thrust = null;
    this.swingId = 0;
    this.swordAngle = 0;
    this.invT = 0; // invulnerable (blinking) while > 0
    this.kx = 0;
    this.kz = 0;
    this.knockT = 0;
    // status lookup, set by game/hero.js (hero.hasStatus): player.js reads
    // 'paralyzed' for walking without importing the API module
    this.statusOf = null;
    this.lockT = 0; // no walking, sword, item or dash
    this.stallT = 0; // a dash crash's stall
    this.guarding = false;
    this.dashing = null;
    this.dashReach = 0;
    this.stickDir = -1;
    this.axisT = { x: 0, z: 0 }; // tick an axis was last pressed (the diagonal facing rule)
    this.tick = 0;
    this.walkT = 0; // cels shown so far (the walk cycle)
    this.cheerT = 0; // > 0 while cheering
    this.posed = null; // { pose, left }: hero.js setPose
    this.tileX = null; // tile under the hero, for onEnter/onLeave
    this.tileZ = null;
    this.swampT = 0;
    this.hero = makeHero();
    this.object = this.hero.root;
    this.guardShield = makeGuardShield(); // in the rig only while the guard is up
    // game/hero.js is the one pose authority (CONTRACTS.md 8.1): item gets and
    // other moments reach the model through its 'hero-pose' event.
    on('hero-pose', (e) => {
      const pose = e?.pose ?? null;
      this.posed = pose ? { pose, left: e.seconds ?? 1 } : null;
      if (pose === 'cheer') this.cheer(e.seconds);
      else if (pose == null) this.cheerT = 0;
    });
    on('mode-change', ({ to }) => {
      if (to !== 'play') this.stopDash();
    });
  }

  // Hold the cheer pose (both hands up) for a while: item get, victory.
  cheer(seconds = 1.2) {
    this.cheerT = Math.max(this.cheerT, seconds);
  }

  facingYaw() {
    return FACING_YAW[this.facing] ?? this.yaw;
  }

  setFacing(dir) {
    this.facing = dir;
    this.yaw = this.lastYaw = FACING_YAW[dir];
  }

  // Forget the tile under the hero (after teleports) so onEnter fires fresh.
  resetTileTracking() {
    this.tileX = this.tileZ = null;
  }

  // ---- the attack facing (spec 7.3)
  updateFacing(raw, m8) {
    this.tick++;
    const sx = Math.abs(raw.x) > 1e-6 ? Math.sign(raw.x) : 0;
    const sz = Math.abs(raw.z) > 1e-6 ? Math.sign(raw.z) : 0;
    if (sx && sx !== this.lastSx) this.axisT.x = this.tick;
    if (sz && sz !== this.lastSz) this.axisT.z = this.tick;
    this.lastSx = sx;
    this.lastSz = sz;
    if (m8.dir < 0) return;
    const card = CARDINAL[m8.dir];
    if (card) {
      this.facing = card;
      return;
    }
    const h = H_OF(m8.x);
    const v = V_OF(m8.z);
    if (this.facing === h || this.facing === v) return;
    // the half pressed last; on a stick, the half nearer its angle (a tie: horizontal)
    const ax = Math.abs(raw.x);
    const az = Math.abs(raw.z);
    if (Math.abs(ax - az) > 1e-3 && !(ax >= 0.999 && az >= 0.999)) this.facing = ax >= az ? h : v;
    else this.facing = this.axisT.z > this.axisT.x ? v : h;
  }

  canDash() {
    return BOOTS.includes(state.gear?.boots) && !this.dashing && this.stallT <= 0 && this.knockT <= 0;
  }

  // The dash (Sprint Boots) revs first: he runs in place kicking up dust for DASH_REV seconds, then
  // charges with the blade out until he hits something, reverses, or presses another button. It
  // no longer stops on a released stick: a tap of the button was a 0.15 s blade poke that read as
  // a swing.
  startDash() {
    this.guarding = false;
    endSwing(this);
    this.yaw = this.facingYaw();
    this.dashing = { dir: this.facing, speed: TUNING.dash.start * this.walkSpeed(), neutralT: 0, rehitT: 0, id: 0, tiles: new Set(), rev: DASH_REV, dustT: 0, backT: 0 };
    this.newDashHit();
    sfx.dashRev?.();
  }

  newDashHit() {
    const d = this.dashing;
    d.id++;
    d.hitId = `dash-${this.swingId}-${d.id}`;
    d.tiles = new Set();
    d.rehitT = TUNING.dash.enemyRehit;
  }

  stopDash() {
    this.dashing = null;
    this.dashReach = 0;
  }

  // A dash crash: bounce back, then stall; the speed resets (spec 7.9).
  crash() {
    const D = TUNING.dash;
    const [fx, fz] = FACING_VEC[this.dashing.dir];
    this.stopDash();
    this.kx = (-fx * D.crashBounce) / D.crashBounceTime;
    this.kz = (-fz * D.crashBounce) / D.crashBounceTime;
    this.knockT = D.crashBounceTime - 1e-9;
    this.stallT = D.crashBounceTime + D.crashStall;
    sfx.block();
    burst(this.x + fx * 0.6, GROUND_Y + 0.4, this.z + fz * 0.6, [0xffffff, 0xd8d8d8], 6, { speed: 2, size: 0.06, life: 0.3 });
  }

  walkSpeed() {
    const s = swordStats();
    const swift = s.specialKind === 'swift' ? 1 + 0.1 * (s.special ?? 0) : 1;
    return TUNING.hero.walk * swift;
  }

  update(dt) {
    // something else turned him (a warp, a teleport, a test): the facing follows
    if (this.yaw !== this.lastYaw) this.facing = facingOfYaw(this.yaw);
    const raw = input.move();
    const m8 = input.move8();
    const stick = this.lockT > 0 ? { x: 0, z: 0, dir: -1 } : m8;
    this.stickDir = stick.dir;
    if (this.invT > 0) this.invT = this.invT - dt > 1e-9 ? this.invT - dt : 0;
    if (this.lockT > 0) this.lockT = Math.max(0, this.lockT - dt);
    if (this.stallT > 0) this.stallT = Math.max(0, this.stallT - dt);

    const rooted = isRooted(this);
    if (!this.guarding && !rooted && !this.dashing && this.lockT <= 0) this.updateFacing(raw, stick);
    else this.updateFacing({ x: 0, z: 0 }, { dir: -1 });

    // ---- buttons
    if (input.pressed('sword') && tryInteract(this)) input.consume('sword');
    if (input.pressed('sword')) {
      if (this.dashing) this.stopDash();
      startSwing(this);
    }
    if (input.pressed('next-item')) cycleItem(1);
    if (input.pressed('prev-item')) cycleItem(-1);
    if (input.pressed('item')) {
      if (this.dashing) this.stopDash();
      if (!state.inventory?.selected) toast('No item yet: find one and it goes on K');
      else if (!rooted) useSelectedItem(this);
    }
    const shield = (state.gear?.shield ?? 0) > 0;
    if (input.pressed('guard') && !shield) toast('No shield yet: the king has one for you');
    if (input.pressed('dash') && !BOOTS.includes(state.gear?.boots)) toast('No boots yet: Tinker Wyll in Mossbrook makes them');
    // (locked input stops walking, the sword, items and the dash, not the guard)
    const wantGuard = input.held('guard') && shield;
    if (this.dashing && input.pressed('guard')) this.stopDash();
    if (this.dashing && state.settings?.dashHold && !input.held('dash')) this.stopDash();
    if (input.pressed('dash') && this.canDash() && !isRooted(this)) this.startDash();
    // the guard drops for a thrust and comes back if the button is still held
    const guardNow = wantGuard && !this.dashing && !this.thrust;
    if (guardNow && !this.guarding) this.yaw = this.facingYaw(); // the body snaps to the facing
    this.guarding = guardNow;

    // ---- moving
    let vx = 0;
    let vz = 0;
    let stepHit = null;
    if (this.knockT > 0) {
      this.knockT -= dt;
      vx = this.kx;
      vz = this.kz;
      if (this.dashing) this.stopDash();
    } else if (this.paralyzed()) {
      // held fast (a gazer's stare): no walking, no dash, facing kept
      if (this.dashing) this.stopDash();
    } else if (this.dashing) {
      this.stepDash(dt, stick);
      vx = this.dashVx;
      vz = this.dashVz;
    } else if (!isRooted(this) && this.stallT <= 0 && this.lockT <= 0) {
      let sp = this.walkSpeed() * (this.guarding ? TUNING.guard.speed : 1) * this.tileSpeed();
      vx = stick.x * sp;
      vz = stick.z * sp;
      // the body's yaw snaps to the 8-way direction (not while guarding: it faces the attack facing)
      if (stick.dir >= 0 && !this.guarding && !this.thrust) this.yaw = Math.atan2(stick.x, stick.z);
    }
    stepHit = moveHero(this, vx * dt, vz * dt, { assist: state.settings?.cornerAssist !== false });
    if (this.dashing && !(this.dashing.rev > 0)) this.dashBlade(dt, stepHit);

    // Crossing the screen's edge changes screen (a follow change past the
    // dead band, or a slide), or loads the next area; at a south edge before
    // any of him drops out of frame (transitions.js edgeCrossed).
    const edge = edgeCrossed(currentScreen());
    if (edge) crossEdge(edge);

    if (state.mode === 'play') this.touchTiles(stick, dt);

    const revving = this.dashing?.rev > 0; // running in place before the charge
    const moving = (Math.hypot(vx, vz) > 0.2 || revving) && this.knockT <= 0;
    tickSword(this, dt, stick.dir);
    this.animate(dt, moving);
    this.lastYaw = this.yaw;
  }

  paralyzed() {
    return !!this.statusOf?.('paralyzed');
  }

  // ---- the dash (spec 7.9)
  stepDash(dt, stick) {
    const D = TUNING.dash;
    const d = this.dashing;
    const walk = this.walkSpeed();
    const [fx0, fz0] = FACING_VEC[d.dir];
    d.dustT -= dt;
    if (d.dustT <= 0) {
      d.dustT = d.rev > 0 ? 0.05 : 0.07;
      smoke(this.x - fx0 * 0.3, GROUND_Y + 0.05, this.z - fz0 * 0.3, d.rev > 0 ? 2 : 1, { radius: 0.09, spread: 0.2, life: 0.35 });
    }
    if (d.rev > 0) {
      // revving: turn freely to aim, no movement, no blade
      d.rev -= dt;
      const aim = stick.dir >= 0 ? CARDINAL[stick.dir] ?? null : null;
      if (aim) d.dir = aim;
      this.facing = d.dir;
      this.yaw = FACING_YAW[d.dir];
      this.dashVx = this.dashVz = 0;
      if (d.rev <= 0) {
        sfx.swing();
        smoke(this.x - fx0 * 0.2, GROUND_Y + 0.05, this.z - fz0 * 0.2, 5, { radius: 0.12, spread: 0.35, life: 0.45 });
      }
      return;
    }
    d.speed = Math.min(D.cap * walk, d.speed + D.perSecond * walk * dt);
    const card = stick.dir >= 0 ? CARDINAL[stick.dir] ?? this.facingFromDiagonal(stick, d.dir) : null;
    const reverse = card && FACING_VEC[card][0] === -fx0 && FACING_VEC[card][1] === -fz0;
    if (card && card !== d.dir && !reverse) {
      d.dir = card; // a 90-degree turn
      d.speed = Math.min(D.cap * walk, d.speed + D.perTurn * walk);
      this.newDashHit();
    }
    this.facing = d.dir;
    this.yaw = FACING_YAW[d.dir];
    // pulling back brakes: held against the charge for DASH_BRAKE, it stops
    d.backT = reverse ? d.backT + dt : 0;
    const [fx, fz] = FACING_VEC[d.dir];
    this.dashVx = fx * d.speed;
    this.dashVz = fz * d.speed;
    if (d.backT >= DASH_BRAKE - 1e-9) {
      this.stopDash();
      this.dashVx = this.dashVz = 0;
    }
  }

  // A diagonal while dashing steers to its half that is not the current direction.
  facingFromDiagonal(stick, dir) {
    const h = H_OF(stick.x);
    const v = V_OF(stick.z);
    return dir === h || dir === 'east' || dir === 'west' ? v : h;
  }

  // The dash blade hits like a thrust at the current blade size, each enemy
  // at most once per TUNING.dash.enemyRehit; a solid in the way crashes.
  dashBlade(dt, stepHit) {
    const d = this.dashing;
    if (!d) return;
    d.rehitT -= dt;
    if (d.rehitT <= 0) this.newDashHit();
    const s = swordStats();
    const r = s.none ? { reach: 0, clipped: false } : bladeSweep(this, { yaw: this.yaw, id: d.hitId, source: 'dash', stats: s, tiles: d.tiles });
    this.dashReach = r.reach;
    const [fx, fz] = FACING_VEC[d.dir];
    const blocked = (fx && stepHit.hitX) || (fz && stepHit.hitZ);
    if (blocked || r.clipped) this.crash();
  }

  // Stairs slow him (spec 7.3).
  tileSpeed() {
    const def = world.tileDefAt(Math.floor(this.x), Math.floor(this.z));
    return def?.stairs ? TUNING.hero.stairs : 1;
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
    this.tileFields(tx, tz, dt);
    // Walking into the tile ahead: locked doors, chests, push blocks.
    if (state.mode === 'play' && mv.dir >= 0 && !this.thrust && !this.dashing) {
      let reach = this.r + 0.15;
      let fx = Math.floor(this.x + Math.sin(this.yaw) * reach);
      let fz = Math.floor(this.z + Math.cos(this.yaw) * reach);
      // a room's side walls stand half a tile in from their tiles (WALL_INSET):
      // a door in one is half a tile further on
      if (!world.isSolid(fx, fz, this)) {
        reach += 0.5;
        fx = Math.floor(this.x + Math.sin(this.yaw) * reach);
        fz = Math.floor(this.z + Math.cos(this.yaw) * reach);
      }
      world.trigger(fx, fz, 'onPush', { player: this, dt });
    }
  }

  // CONTRACTS 11: the fields of the tile under his centre. hero.js answers
  // the hazards (hazardHandler) so the fall and the hit go through its API.
  tileFields(tx, tz, dt) {
    const def = world.tileDefAt(tx, tz);
    if (!def || state.mode !== 'play') return;
    if (def.conveyor && this.knockT <= 0) {
      const c = TUNING.dungeon?.conveyor ?? 3;
      moveHero(this, def.conveyor[0] * c * dt, def.conveyor[1] * c * dt, { assist: false });
    }
    if (def.hazard === 'swamp') {
      if (state.gear?.boots === 'boots-swamp') return;
      this.swampT += dt;
      if (this.swampT >= 1 - 1e-9) {
        this.swampT -= 1;
        this.hazardHandler?.(def, tx, tz);
      }
      return;
    }
    this.swampT = 0;
    if (def.hazard) this.hazardHandler?.(def, tx, tz);
  }

  animate(dt, moving) {
    const hero = this.hero;
    // The walk cycle runs only while he moves; standing still he stands (marching in place read as
    // a stuck run). A fresh step starts on a stride cel so the first frame of a walk shows motion.
    if (moving) this.walkT += (dt / TUNING.hero.posePeriod) * (this.dashing ? 2 : 1);
    else this.walkT = 0;
    if (this.cheerT > 0) this.cheerT -= dt;
    if (this.posed) {
      this.posed.left -= dt;
      if (this.posed.left <= 0) this.posed = null;
    }
    // walk 1, stand, walk 2, stand while moving (spec 7.3); stand when still
    const cel = Math.floor(this.walkT) % 4;
    const step = !moving ? 'stand' : cel === 0 ? 'walk1' : cel === 2 ? 'walk2' : 'stand';
    const out = !!this.thrust || (!!this.dashing && !(this.dashing.rev > 0));
    let pose = step;
    const set = this.posed?.pose;
    if (state.mode === 'dead') pose = 'stand';
    else if (set === 'cheer' || this.cheerT > 0) pose = 'cheer';
    else if (set === 'item' && !out) pose = 'item';
    else if (set === 'item' || set === 'swordOut') pose = 'swordOut';
    else if (out) pose = 'swordOut';
    else if (set === 'guard' || this.guarding) pose = 'stand';
    else if (set === 'stand') pose = 'stand';
    hero.setPose(pose);
    const guardUp = pose === 'stand' && (set === 'guard' || this.guarding);
    if (guardUp !== !!this.guardShield.parent) {
      if (guardUp) hero.body.add(this.guardShield);
      else hero.body.remove(this.guardShield);
    }
    const walking = pose === step;
    const sway = (TUNING.hero.sway * Math.PI) / 180;
    const swayOn = state.settings?.sway !== false;
    hero.sway.rotation.z = walking && swayOn ? Math.sin((this.walkT * Math.PI) / 2) * sway * (moving ? 1 : IDLE_SWAY) : 0;
    poseSword(hero, this);
    updateBladeFx(this, dt);
    hero.root.position.set(this.x, GROUND_Y, this.z);
    hero.root.rotation.y = this.yaw;
    hero.root.visible = this.invT <= 0 || state.mode === 'dead' || Math.floor(this.invT * 16) % 2 === 0;
  }
}

export const player = new Player();
