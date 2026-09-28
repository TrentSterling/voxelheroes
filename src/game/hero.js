// The hero API: what other streams may ask of or tell the hero, over the
// player (entities/player.js: movement, facing, thrust, spin, guard, dash;
// systems/hero-body.js, sword.js, sword-fx.js) and combat
// (systems/combat.js). M2 hero stream: the kit is in; every name and return
// value is the contract's (CONTRACTS 8.1).
//
//   hero.facing()            'north' | 'east' | 'south' | 'west': the 4-way attack facing
//   hero.facingVector()      { x, z } unit vector of it
//   hero.setFacing(dir)      turn the attack facing (and the body) to a cardinal
//   hero.faceToward(x, z)    face a world point (the cardinal nearest its direction)
//   hero.position()          { x, z } world, plus lx, lz local to the current screen
//   hero.isGuarding()        the guard is up (the guard button held, or the hero stream's rule)
//   hero.isFullLife()        life equals max life (the sword's full-life rule)
//   hero.receiveHit({ damage, from, kind, tier, source, knockback, iframes, lock })
//                            -> 'blocked' | 'hit' | 'ignored'
//   hero.heal(units)         -> units restored
//   hero.setPose(pose, s)    one of POSES for s seconds (null: back to walking)
//   hero.cheer(seconds)      the cheer pose (item get, a ledge hop)
//   hero.lockInput(seconds)  no sword, item or dash presses for a while
//   hero.pull({ toX, toZ, speed })  the grapple drags him there -> Promise<'arrived' | 'blocked' | 'cancelled'>
//   hero.respawn({ spot })   stand up somewhere with full life and magic
//   hero.fall({ damage, to }) a pit or a dark puddle: damage, then back to 'entry',
//                            the last 'safe' tile, or a spot
//   hero.canAct()            may attack or use an item now (not in a doorway, not locked)
//
// receiveHit is the one way foes, shots and hazards hurt the hero:
//   damage    base damage in life units (half hearts)
//   from      { x, z } or an entity: where the hit comes from (direction for the
//             shield and the knockback); null for hazards underfoot
//   kind      'contact' (bodies, swords), 'projectile' (shots) or 'hazard' (spikes,
//             lava, pits, swamp, blasts): hazards are never blocked
//   tier      the shield tier that blocks it: projectiles default to 2 (arrows and
//             basic shots; 3 magic bolts, 4 fire, 5 lightning, 6 everything
//             blockable), contact to 1 (any shield); Infinity (or unblockable:
//             true) for shots nothing blocks
//   source    what hit (an entity or an id), passed on in events
//   knockback tiles pushed away from `from` over TUNING.damage.knockTime
//             (true: TUNING.damage.knock; false or 0: no push)
//   iframes   seconds of blinking after the hit (default TUNING.damage.iframes;
//             false: none, for damage over time such as a swamp)
//   lock      seconds of locked input after the hit (default
//             TUNING.damage.knockLock; false: none)
//   ignoreIframes  lands even while he blinks (hazards that tick)
// Returns 'ignored' when the hero cannot be hurt now (not in play, already
// down, blinking after a hit, invulnerable), 'blocked' when the guard stopped
// it (the caller recoils: TUNING.guard.attackerKnock / attackerStun; the hero
// only takes the guard's push), 'hit' when it landed. Damage taken is
// max(1, floor(damage x difficulty x (1 - ring cut))), or all remaining life
// in one-hit mode.
import { state } from '../core/state.js';
import { input } from '../core/input.js';
import { on, emit } from '../core/events.js';
import { sfx } from '../core/audio.js';
import { TUNING } from '../core/tuning.js';
import { world, currentScreen } from '../world/world.js';
import { player } from '../entities/player.js';
import { hurtPlayer } from '../systems/combat.js';
import { moveHero } from '../systems/hero-body.js';
import { setSwordStats, setBladeHooks } from '../systems/sword.js';
import { flashBlade } from '../systems/sword-fx.js';
import { burst } from '../systems/particles.js';
import { registerPlayHook } from '../systems/flow.js';
import { registerGrant } from '../systems/grants.js';
import { tryInteract } from '../systems/interact.js';
import * as vitals from './vitals.js';
import { damageMultiplier, isOneHit } from './progress.js';
import { spotHere, goToSpot, respawnSpot, roomEntry, currentRect } from './places.js';
import { effectActive } from './effects.js';
import { bladeStats, bladeSize } from './swords.js';
import { dealDamage } from './damage.js';
import { collectPickup, dropCoins } from './pickups.js';
import { UNITS_PER_HEART } from './vitals.js';
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

// The cardinal nearest the direction (dx, dz).
export function facingToward(dx, dz) {
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 'east' : 'west';
  return dz > 0 ? 'south' : 'north';
}

export const HIT_KINDS = ['contact', 'projectile', 'hazard'];
// Poses the hero shows (hero-pose): stand and cheer are look's, swordOut the
// thrust, item a B item or spell in use, guard the raised shield. The hero
// stream adds the item and guard models (models/hero/*; until then they
// fall back to swordOut and stand).
export const POSES = ['stand', 'cheer', 'swordOut', 'item', 'guard'];

const status = new Map(); // name -> seconds left
let posed = null; // { pose, left }
let pulling = null; // { x, z, speed, fromX, fromZ, resolve }
let lastSafe = null; // { x, z } local: the last tile he stood on that was not a hazard

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
  player.knockT = time - 1e-9; // time / TICK whole ticks, not one more from rounding
}

const ringCut = () => {
  const [quarter, half] = TUNING.progression.ringCut;
  return state.gear.ring === 'ring-half' ? half : state.gear.ring === 'ring-quarter' ? quarter : 0;
};

// Is spot s (area, screen) the screen the hero is on?
function sameScreen(s) {
  const here = spotHere();
  if (!here || !s) return false;
  if (!s.area) return true;
  return s.area === here.area && (!s.screen || (s.screen[0] === here.screen[0] && s.screen[1] === here.screen[1]));
}

// Does something high (a wall, a tree: anything that stops shots) stand at world point (x, z)?
const highAt = (x, z) => world.shotBlockedAt(x, z);

function endPull(result) {
  if (!pulling) return;
  const p = pulling;
  pulling = null;
  player.knockT = 0;
  player.kx = player.kz = 0;
  player.resetTileTracking?.(); // the tile he lands on answers onEnter
  p.resolve(result);
}

// One tick of the pull, in the 'after' phase: move toward the target; stop
// at anything high; land where he can stand.
function stepPull(dt) {
  const p = pulling;
  const dx = p.x - player.x;
  const dz = p.z - player.z;
  const d = Math.hypot(dx, dz);
  const step = p.speed * dt;
  const k = d <= step ? 1 : step / d;
  const nx = player.x + dx * k;
  const nz = player.z + dz * k;
  let result = k >= 1 ? 'arrived' : null;
  if (highAt(nx, nz) || (!p.overLow && world.blocked(nx, nz, player.r, player))) result = 'blocked';
  else {
    player.x = nx;
    player.z = nz;
    player.tileX = Math.floor(nx); // no onEnter for what he flies over
    player.tileZ = Math.floor(nz);
  }
  if (!result) return;
  // Land: back along the way until he can stand.
  const bx = p.fromX - player.x;
  const bz = p.fromZ - player.z;
  const back = Math.hypot(bx, bz);
  for (let t = 0; t <= back && world.blocked(player.x, player.z, player.r, player); t += 1 / 16) {
    player.x += (bx / (back || 1)) / 16;
    player.z += (bz / (back || 1)) / 16;
  }
  endPull(result);
}

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
  // The attack facing (gameplay spec 7.3), kept in player.facing apart from
  // the 8-way body yaw (player.yaw).
  facing: () => (FACINGS.includes(player.facing) ? player.facing : facingFromYaw(player.yaw)),
  facingVector: () => ({ ...FACING_VECTORS[hero.facing()] }),
  // Turn the attack facing to `dir` and the body with it.
  setFacing(dir) {
    if (!FACINGS.includes(dir)) throw new Error(`setFacing: ${FACINGS.join(', ')}, not "${dir}"`);
    player.setFacing(dir);
    return dir;
  },
  // Face the world point (x, z): the attack facing becomes the cardinal
  // nearest its direction; the body turns to that cardinal.
  faceToward(x, z) {
    const dx = x - player.x;
    const dz = z - player.z;
    if (Math.hypot(dx, dz) < 1e-6) return hero.facing();
    return hero.setFacing(facingToward(dx, dz));
  },

  // ---- condition
  isGuarding: () => !!player.guarding,
  isDashing: () => !!player.dashing,
  isFullLife: () => vitals.isFullLife(),
  isAlive: () => state.hp > 0 && state.mode !== 'dead',
  isInvulnerable: () => player.invT > 0 || hero.hasStatus('invulnerable') || effectActive('star'),

  // ---- damage and healing
  receiveHit({
    damage = 1,
    from = null,
    kind = 'contact',
    tier = kind === 'projectile' ? 2 : 1,
    source = null,
    knockback = true,
    iframes = TUNING.damage.iframes,
    lock = TUNING.damage.knockLock,
    unblockable = false,
    ignoreIframes = false,
  } = {}) {
    if (!HIT_KINDS.includes(kind)) throw new Error(`receiveHit: kind must be ${HIT_KINDS.join(', ')}, not "${kind}"`);
    if (state.mode !== 'play' || state.hp <= 0) return 'ignored';
    if (!ignoreIframes && hero.isInvulnerable()) return 'ignored';
    const p = pointOf(from);
    const shield = state.gear.shield ?? 0;
    const blockable = !unblockable && kind !== 'hazard' && tier !== Infinity;
    if (blockable && shield >= Math.max(1, tier) && hero.isGuarding() && inGuardArc(p)) {
      pushAway(p, TUNING.guard.pushBack, TUNING.guard.pushTime);
      sfx.block();
      emit('hero-hit', { result: 'blocked', damage: 0, kind, source, from: p });
      return 'blocked';
    }
    const amount = damageTaken(damage);
    const f = FACING_VECTORS[hero.facing()];
    const fx = p ? p.x : player.x + f.x;
    const fz = p ? p.z : player.z + f.z;
    const blink = player.invT;
    hurtPlayer(amount, fx, fz, { kind, source, knockback: false });
    // TUNING.damage over M1's fixed blink and push (combat.js)
    player.invT = iframes ? Math.max(blink, iframes) : blink;
    const tiles = knockback === true ? TUNING.damage.knock : Number(knockback) || 0;
    if (tiles > 0 && p && state.hp > 0) pushAway(p, tiles, TUNING.damage.knockTime);
    if (state.hp > 0 && lock) hero.lockInput(lock);
    emit('hero-hit', { result: 'hit', damage: amount, kind, source, from: p });
    return 'hit';
  },
  heal: (units, reason = 'heal') => vitals.heal(units, reason),

  // ---- poses: hero.js is the one pose authority. The hero's model shows
  // pose() while it is set, else walking or the thrust (the hero stream
  // wires player.animate to it; look builds the models).
  setPose(pose, seconds = 1) {
    if (pose && !POSES.includes(pose)) throw new Error(`setPose: ${POSES.join(', ')}, not "${pose}"`);
    posed = pose ? { pose, left: seconds } : null;
    emit('hero-pose', { pose: pose ?? null, seconds });
  },
  pose: () => posed?.pose ?? null,
  cheer: (seconds = 1) => hero.setPose('cheer', seconds),

  // ---- control
  // No sword, item or dash presses for `seconds` (and no walking once the
  // hero stream's player reads inputLocked()).
  lockInput(seconds) {
    player.lockT = Math.max(player.lockT, seconds);
  },
  inputLocked: () => player.lockT > 0,
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
  move: (dx, dz) => moveHero(player, dx, dz, { assist: false }).hit,
  // Put him at local (x, z) of the current screen without re-entering it.
  place(x, z, yaw = player.yaw) {
    const r = currentRect();
    player.x = r.x0 + x;
    player.z = r.z0 + z;
    player.yaw = yaw;
    player.knockT = 0;
    player.stopDash?.();
    player.resetTileTracking?.();
  },
  // The grapple's pull (gameplay spec 9.2): drag him to the world point (toX,
  // toZ) at `speed` t/s over water, pits and every tile hazard (overLow),
  // with walking and the sword, item and dash buttons held off. Walls and
  // other tiles that stop shots end it early ('blocked'). He lands on the
  // target, or on the nearest spot back along the way that he can stand on.
  // A new pull, a death or a warp cancels one in flight ('cancelled').
  pull({ toX, toZ, speed = TUNING.items.grapple.pull, overLow = true } = {}) {
    if (!Number.isFinite(toX) || !Number.isFinite(toZ)) throw new Error('pull: toX and toZ (world tiles) are needed');
    endPull('cancelled');
    return new Promise((resolve) => {
      pulling = { x: toX, z: toZ, speed, overLow, fromX: player.x, fromZ: player.z, resolve };
    });
  },
  isPulled: () => pulling !== null,
  warp: (spot, opts) => goToSpot(spot, opts),
  // Stand up at `spot` (default: where he respawns) with full life and magic.
  respawn({ spot = respawnSpot('death'), refill = true } = {}) {
    if (refill) vitals.refill({ reason: 'respawn' });
    goToSpot(spot, { fade: false });
    player.invT = 1;
    emit('hero-respawn', { spot, via: 'respawn' });
  },
  // A bottomless pit (to 'entry': where he came into this room), lava (to
  // 'safe': the last tile he stood on that was no hazard), a dark puddle
  // (to: a spot, such as the floor's start; another screen is a warp), or
  // nothing (to: null). The damage is a hazard that ignores the blink.
  fall({ damage = TUNING.damage.pit, to = 'entry' } = {}) {
    endPull('cancelled');
    const result = hero.receiveHit({ damage, kind: 'hazard', knockback: false, ignoreIframes: true });
    if (state.hp <= 0 || state.mode !== 'play' || !to) return result;
    if (to === 'entry' || to === 'safe') {
      const e = to === 'safe' ? hero.safeSpot() : roomEntry();
      if (e) hero.place(e.x, e.z, e.yaw ?? player.yaw);
    } else if (sameScreen(to)) {
      const r = currentRect();
      hero.place(to.x ?? player.x - r.x0, to.z ?? player.z - r.z0, to.yaw ?? player.yaw);
    } else goToSpot(to, { fade: true });
    return result;
  },
  // Where lava puts him back: the last tile he stood on that was no hazard
  // (in this screen), else where he came in.
  safeSpot: () => (lastSafe ? { ...spotHere(), ...lastSafe } : roomEntry()),

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

// ---------------------------------------------------------------- the kit
// entities/player.js walks, thrusts, spins, guards and dashes; this wires
// what his blade does to the game (spec 7.4 to 7.7), the full-life swap
// (7.5), the tiles under him (CONTRACTS 11) and the low-life beep (7.10).

// The blade the sword system swings: the equipped sword at the current life.
setSwordStats(() => hero.blade());

const units = () => state.hp;
setBladeHooks({
  // Enemies take the blade through dealDamage (immunities, guards, specials);
  // other swordable things (shots) answer onSword themselves.
  hitEntity(e, hit) {
    if (e.kind !== 'enemy') return e.onSword?.(hit) ? 'hit' : null;
    const s = hit.stats ?? bladeStats();
    let amount = hit.damage;
    let crit = false;
    let freeze = 0;
    const kind = s.specialKind;
    const lv = s.special ?? 0;
    if (kind === 'pinch' && units() <= state.maxHp * 0.25) {
      amount = Math.ceil(amount * 1.5);
      crit = true;
    }
    if (kind === 'freeze' && lv > 0) freeze = lv * TUNING.sword.freezePerLevel;
    if (kind === 'rare-slayer' && lv > 0 && e.rare) amount = Math.max(amount, e.hp ?? amount);
    const r = dealDamage(e, { amount, source: hit.source, from: player, swingId: hit.swingId, freeze, crit });
    if (kind === 'coin-burst' && lv > 0 && (r.result === 'hit' || r.result === 'killed')) dropCoins(e.x, e.z, lv, { spread: 0.8 });
    return r.result;
  },
  collect: (e) => collectPickup(e, { by: 'blade' }),
});

// The swap is instant: a puff and a dull sound when the full blade is lost,
// a chime and a flash along it when it comes back.
on('life-changed', ({ full, wasFull }) => {
  if (full === wasFull || full === undefined || wasFull === undefined) return;
  const stats = bladeStats();
  emit('blade-changed', { full, stats });
  if (stats.none) return;
  if (full) {
    sfx.heart();
    flashBlade(TUNING.sword.regainFlash);
  } else {
    const f = FACING_VECTORS[hero.facing()];
    burst(player.x + f.x, 0.5, player.z + f.z, [0xe8e8ec, 0xdad8d9], 8, { speed: 2, size: 0.08, life: 0.4 });
    sfx.hit();
  }
});

// The star special: a heart picked up at full life gives a few seconds of
// invulnerability.
on('pickup', ({ type, wasFull }) => {
  const s = bladeStats();
  if (type === 'heart' && wasFull && s.specialKind === 'star' && s.special > 0) hero.addStatus('invulnerable', TUNING.sword.starTime);
});

// Hazards under his centre (CONTRACTS 11). Tile owners set the fields.
player.hazardHandler = (def, tx, tz) => {
  const D = TUNING.damage;
  switch (def.hazard) {
    case 'pit':
      return hero.fall({ damage: D.pit, to: 'entry' });
    case 'lava':
      return hero.fall({ damage: D.lava, to: 'safe' });
    case 'puddle':
      return hero.fall({ damage: D.darkPuddle, to: def.to ?? 'entry' });
    case 'spikes':
      return hero.receiveHit({ damage: D.spikes, kind: 'hazard', from: { x: tx + 0.5, z: tz + 0.5 }, source: 'spikes' });
    case 'swamp':
      return hero.receiveHit({ damage: D.swampPerSec, kind: 'hazard', knockback: false, iframes: false, lock: false, ignoreIframes: true, source: 'swamp' });
    default:
      return null;
  }
};

// The low-life beep (spec 7.10): every beepInterval while life is at or
// below the threshold for his max life.
export function lowLifeLine(maxHp = state.maxHp) {
  const maxHearts = maxHp / UNITS_PER_HEART;
  const row = TUNING.damage.beepHearts.find(([upTo]) => maxHearts <= upTo) ?? TUNING.damage.beepHearts.at(-1);
  return row[1] * UNITS_PER_HEART;
}
let beepT = 0;
let beeps = 0;
export const beepCount = () => beeps;

// Locked input and a pull eat sword, item and dash presses; with no sword
// equipped, A only talks and checks.
registerPlayHook({
  id: 'hero-api-input',
  phase: 'input',
  order: 1,
  update() {
    if (player.lockT > 0 || pulling) for (const a of ['sword', 'item', 'dash']) input.consume(a);
    if (!state.swords.equipped && input.pressed('sword')) {
      tryInteract(player);
      input.consume('sword');
    }
    if (pulling) {
      // hold his own walking off while the grapple drags him
      player.knockT = Math.max(player.knockT, 2 / 60);
      player.kx = player.kz = 0;
      player.guarding = false;
    }
  },
});

registerPlayHook({
  id: 'hero-api-timers',
  phase: 'after',
  order: 1,
  update(dt) {
    for (const [k, v] of status) {
      if (v - dt > 0) status.set(k, v - dt);
      else status.delete(k);
    }
    if (posed) {
      posed.left -= dt;
      if (posed.left <= 0) posed = null;
    }
    if (pulling) stepPull(dt);
    // the last safe tile, for lava (fall({ to: 'safe' }))
    const r = currentRect();
    const def = world.tileDefAt(Math.floor(player.x), Math.floor(player.z));
    if (r && def && !def.hazard && !pulling && !(player.knockT > 0) && !world.blocked(player.x, player.z, player.r, player))
      lastSafe = { x: player.x - r.x0, z: player.z - r.z0 };
    // the low-life beep
    if (state.hp > 0 && state.hp <= lowLifeLine()) {
      beepT -= dt;
      if (beepT <= 0) {
        beepT += TUNING.damage.beepInterval;
        beeps++;
        sfx.block();
      }
    } else beepT = 0;
  },
});

on('screen-enter', () => {
  lastSafe = null;
});
on('mode-change', ({ to }) => {
  if (to !== 'play' && to !== 'dialog') endPull('cancelled');
});
