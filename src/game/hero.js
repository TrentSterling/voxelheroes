// The hero API: what other streams may ask of or tell the hero. Thin
// functions over today's player (entities/player.js) and combat
// (systems/combat.js); the hero stream re-implements the insides in M2 and
// keeps every name and return value here.
//
//   hero.facing()            'north' | 'east' | 'south' | 'west' (the 4-way attack facing)
//   hero.facingVector()      { x, z } unit vector of it
//   hero.position()          { x, z } world, plus lx, lz local to the current screen
//   hero.isGuarding()        the guard is up (the guard button held, or the hero stream's rule)
//   hero.isFullLife()        life equals max life (the sword's full-life rule)
//   hero.receiveHit({ damage, from, kind, tier, source }) -> 'blocked' | 'hit' | 'ignored'
//   hero.heal(units)         -> units restored
//   hero.cheer(seconds)      the cheer pose (item get, a drop from a height)
//   hero.lockInput(seconds)  no sword, item or dash presses for a while
//   hero.respawn({ spot })   stand up somewhere with full life and magic
//   hero.fall()              a pit: 2 units of damage, back to where he entered the room
//   hero.canAct()            may attack or use an item now (not in a doorway, not locked)
//
// receiveHit is the one way foes, shots and hazards hurt the hero:
//   damage   base damage in life units (half hearts)
//   from     { x, z } or an entity: where the hit comes from (direction for the
//            shield and the knockback); null for hazards underfoot
//   kind     'contact' (bodies, swords), 'projectile' (shots) or 'hazard' (spikes,
//            lava, pits, swamp): hazards are never blocked
//   tier     for projectiles, the shield tier that blocks it: 2 arrows and basic
//            shots, 3 magic bolts, 4 fire, 5 lightning, 6 everything blockable;
//            Infinity (or unblockable: true) for shots nothing blocks
//   source   what hit (an entity or an id), passed on in events
//   knockback false: no push (a hazard's own handling moves the hero)
// Returns 'ignored' when the hero cannot be hurt now (not in play, already
// down, blinking after a hit, invulnerable), 'blocked' when the guard stopped
// it (the attacker should recoil: TUNING.guard.attackerKnock / attackerStun),
// 'hit' when it landed. Damage taken is max(1, floor(damage x difficulty x
// (1 - ring cut))), or all remaining life in one-hit mode.
import { state } from '../core/state.js';
import { input } from '../core/input.js';
import { on, emit } from '../core/events.js';
import { sfx } from '../core/audio.js';
import { TUNING } from '../core/tuning.js';
import { currentScreen } from '../world/world.js';
import { player } from '../entities/player.js';
import { hurtPlayer } from '../systems/combat.js';
import { moveBody } from '../systems/physics.js';
import { registerPlayHook } from '../systems/flow.js';
import { registerGrant } from '../systems/grants.js';
import * as vitals from './vitals.js';
import { damageMultiplier, isOneHit } from './progress.js';
import { spotHere, goToSpot, respawnSpot, roomEntry, currentRect } from './places.js';
import { effectActive } from './effects.js';
import { bladeStats, bladeSize } from './swords.js';
import './fields.js';

export const FACINGS = ['north', 'east', 'south', 'west'];
export const FACING_VECTORS = { north: { x: 0, z: -1 }, east: { x: 1, z: 0 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 } };
export const FACING_YAW = { north: Math.PI, east: Math.PI / 2, south: 0, west: -Math.PI / 2 };

// The cardinal nearest a yaw (yaw 0 faces +z, south).
export function facingFromYaw(yaw) {
  const x = Math.sin(yaw);
  const z = Math.cos(yaw);
  if (Math.abs(x) > Math.abs(z)) return x > 0 ? 'east' : 'west';
  return z > 0 ? 'south' : 'north';
}

export const HIT_KINDS = ['contact', 'projectile', 'hazard'];

const status = new Map(); // name -> seconds left
let lockLeft = 0;
let posed = null; // { pose, left }

const pointOf = (from) => (from && Number.isFinite(from.x) && Number.isFinite(from.z) ? { x: from.x, z: from.z } : null);

// Is point p inside the guard's arc (TUNING.guard.arc either side of the facing)?
function inGuardArc(p) {
  if (!p) return false;
  const dx = p.x - player.x;
  const dz = p.z - player.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return true;
  const f = FACING_VECTORS[hero.facing()];
  return (dx * f.x + dz * f.z) / d >= Math.cos((TUNING.guard.arc * Math.PI) / 180) - 1e-9;
}

// Push the hero `dist` tiles away from p over `time` seconds (M1 knockback fields).
function pushAway(p, dist, time) {
  const f = FACING_VECTORS[hero.facing()];
  const dx = p ? player.x - p.x : -f.x;
  const dz = p ? player.z - p.z : -f.z;
  const d = Math.hypot(dx, dz) || 1;
  player.kx = (dx / d) * (dist / time);
  player.kz = (dz / d) * (dist / time);
  player.knockT = time;
}

const ringCut = () => {
  const [quarter, half] = TUNING.progression.ringCut;
  return state.gear.ring === 'ring-half' ? half : state.gear.ring === 'ring-quarter' ? quarter : 0;
};

// Damage the hero takes from a hit of `base` units (difficulty, rings, one-hit mode).
export function damageTaken(base) {
  if (isOneHit()) return Math.max(1, state.hp);
  return Math.max(1, Math.floor(base * damageMultiplier() * (1 - ringCut())));
}

export const hero = {
  get entity() {
    return player;
  },

  // ---- where and which way
  position() {
    const r = currentRect();
    return { x: player.x, z: player.z, lx: r ? player.x - r.x0 : null, lz: r ? player.z - r.z0 : null };
  },
  spot: () => spotHere(),
  // The hero stream keeps player.facing up to date (the 4-way rule of the
  // gameplay spec 7.3); until then it is the cardinal nearest the body's yaw.
  facing: () => (FACINGS.includes(player.facing) ? player.facing : facingFromYaw(player.yaw)),
  facingVector: () => ({ ...FACING_VECTORS[hero.facing()] }),

  // ---- condition
  isGuarding: () => !!player.guarding,
  isDashing: () => !!player.dashing,
  isFullLife: () => vitals.isFullLife(),
  isAlive: () => state.hp > 0 && state.mode !== 'dead',
  isInvulnerable: () => player.invT > 0 || hero.hasStatus('invulnerable') || effectActive('star'),

  // ---- damage and healing
  receiveHit({ damage = 1, from = null, kind = 'contact', tier = 1, source = null, knockback = true, unblockable = false, ignoreIframes = false } = {}) {
    if (!HIT_KINDS.includes(kind)) throw new Error(`receiveHit: kind must be ${HIT_KINDS.join(', ')}, not "${kind}"`);
    if (state.mode !== 'play' || state.hp <= 0) return 'ignored';
    if (!ignoreIframes && hero.isInvulnerable()) return 'ignored';
    const p = pointOf(from);
    const shield = state.gear.shield ?? 0;
    const blockable = !unblockable && kind !== 'hazard' && tier !== Infinity;
    const tierOk = kind === 'contact' ? shield >= 1 : shield >= tier;
    if (blockable && tierOk && hero.isGuarding() && inGuardArc(p)) {
      pushAway(p, TUNING.guard.pushBack, TUNING.guard.pushTime);
      sfx.block();
      emit('hero-hit', { result: 'blocked', damage: 0, kind, source });
      return 'blocked';
    }
    const amount = damageTaken(damage);
    const f = FACING_VECTORS[hero.facing()];
    const fx = p ? p.x : player.x + f.x;
    const fz = p ? p.z : player.z + f.z;
    hurtPlayer(amount, fx, fz, { kind, source, knockback: knockback !== false && !!p });
    if (state.hp > 0) hero.lockInput(TUNING.damage.knockLock);
    emit('hero-hit', { result: 'hit', damage: amount, kind, source });
    return 'hit';
  },
  heal: (units, reason = 'heal') => vitals.heal(units, reason),

  // ---- poses (the hero stream draws them; look builds the models)
  setPose(pose, seconds = 1) {
    posed = pose ? { pose, left: seconds } : null;
    emit('hero-pose', { pose: pose ?? null, seconds });
  },
  pose: () => posed?.pose ?? null,
  cheer: (seconds = 1) => hero.setPose('cheer', seconds),

  // ---- control
  // No sword, item or dash presses for `seconds` (and no walking once the
  // hero stream's player reads inputLocked()).
  lockInput(seconds) {
    lockLeft = Math.max(lockLeft, seconds);
  },
  inputLocked: () => lockLeft > 0,
  addStatus(name, seconds) {
    status.set(name, Math.max(status.get(name) ?? 0, seconds));
  },
  statusLeft: (name) => status.get(name) ?? 0,
  hasStatus: (name) => (status.get(name) ?? 0) > 0,
  clearStatus: (name) => status.delete(name),
  // Doorways: the wall band of a dungeon room (gameplay spec 4.5): no attacks,
  // items or spells there.
  inDoorway() {
    const s = currentScreen();
    if (!s?.area?.rooms) return false;
    const r = currentRect();
    const x = player.x - r.x0;
    const z = player.z - r.z0;
    return z < 1 || z > r.h - 1 || x < 1.5 || x > r.w - 1.5;
  },
  canAct: () => state.mode === 'play' && state.hp > 0 && !hero.inputLocked() && !hero.hasStatus('paralyzed') && !hero.inDoorway(),

  // ---- moving him
  // Move by (dx, dz) tiles against walls and solid bodies (conveyors, currents).
  // Returns true if something stopped him.
  move: (dx, dz) => moveBody(player, dx, dz, null),
  // Put him at local (x, z) of the current screen without re-entering it.
  place(x, z, yaw = player.yaw) {
    const r = currentRect();
    player.x = r.x0 + x;
    player.z = r.z0 + z;
    player.yaw = yaw;
    player.knockT = 0;
    player.resetTileTracking?.();
  },
  warp: (spot, opts) => goToSpot(spot, opts),
  // Stand up at `spot` (default: where he respawns) with full life and magic.
  respawn({ spot = respawnSpot('death'), refill = true } = {}) {
    if (refill) vitals.refill({ reason: 'respawn' });
    goToSpot(spot, { fade: false });
    player.invT = 1;
    emit('hero-respawn', { spot, via: 'respawn' });
  },
  // A bottomless pit: damage, then back to where he came into this room.
  fall({ damage = TUNING.damage.pit } = {}) {
    const result = hero.receiveHit({ damage, kind: 'hazard', knockback: false, ignoreIframes: true });
    if (state.hp > 0 && state.mode === 'play') {
      const e = roomEntry();
      if (e) hero.place(e.x, e.z, e.yaw);
    }
    return result;
  },

  // ---- the blade now (swords.js): stats and size at the current life
  blade: () => ({ ...bladeStats(), ...bladeSize(bladeStats()) }),
};

// ---------------------------------------------------------------- gear grants
// Shields, boots and rings are gear (state.gear), not B items. Names are
// placeholders for the hero stream to replace.
const SHIELDS = ['Plank Shield', 'Rivet Shield', 'Sigil Shield', 'Kiln Shield', 'Storm Shield', 'Bastion Shield'];
SHIELDS.forEach((name, i) =>
  registerGrant(
    `shield-${i + 1}`,
    () => {
      state.gear.shield = i + 1;
    },
    { name, fanfare: true }
  )
);
registerGrant(
  'boots-dash',
  () => {
    if (state.gear.boots !== 'boots-swamp') state.gear.boots = 'boots-dash';
  },
  { name: 'Sprint Boots', fanfare: true }
);
registerGrant(
  'boots-swamp',
  () => {
    state.gear.boots = 'boots-swamp';
  },
  { name: 'Bog Boots', fanfare: true }
);
registerGrant(
  'ring-quarter',
  () => {
    if (state.gear.ring !== 'ring-half') state.gear.ring = 'ring-quarter';
  },
  { name: 'Ward Ring', fanfare: true }
);
registerGrant(
  'ring-half',
  () => {
    state.gear.ring = 'ring-half';
  },
  { name: 'Bulwark Ring', fanfare: true }
);

// An item get holds the prize overhead in the cheer pose (gameplay spec 12.2).
const CHEER_TIME = 1.0;
on('item-get', () => {
  if (state.mode === 'play' || state.mode === 'dialog') hero.cheer(CHEER_TIME);
});

// ---------------------------------------------------------------- per tick
// Stand-in until the hero stream lands: the guard is up while the guard
// button is held in play and the hero is not thrusting. Locked input eats
// sword, item and dash presses.
registerPlayHook({
  id: 'hero-api-input',
  phase: 'input',
  order: 1,
  update() {
    if (lockLeft > 0) for (const a of ['sword', 'item', 'dash']) input.consume(a);
    player.guarding = input.held('guard') && !(player.attackT > 0);
  },
});

registerPlayHook({
  id: 'hero-api-timers',
  phase: 'after',
  order: 1,
  update(dt) {
    lockLeft = Math.max(0, lockLeft - dt);
    for (const [k, v] of status) {
      if (v - dt > 0) status.set(k, v - dt);
      else status.delete(k);
    }
    if (posed) {
      posed.left -= dt;
      if (posed.left <= 0) posed = null;
    }
  },
});
