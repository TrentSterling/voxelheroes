// The blade (gameplay spec 7.4 to 7.6, 7.9): the thrust, the spin, the dash
// blade, terrain clip, and hitting things along it. Every number is
// TUNING.sword's.
//
//   startSwing(p)          a swipe along the attack facing (p.facingYaw());
//                          false while the blade is still out (a new swipe may
//                          start from the first tick of the retract)
//   tickSword(p, dt, dir)  advance it; dir: the stick's 8-way direction
//                          (input.move8().dir, -1 idle) for the spin
//   bladeSweep(p, opts)    one hit test of a blade (the dash uses it)
//   isRooted(p)            extend and hold: the hero cannot walk
//
// The swipe (ALttP as the teacher, fun audit): a press extends the blade in
// TUNING.sword.extend (2 ticks), holds `hold` and retracts in `retract`; on
// the way it sweeps TUNING.sword.swipe degrees across the facing, starting
// half that to one side, so it reads and connects like a real swing instead
// of an instant thrust down one exact line (0 restores the old straight
// thrust). It hits during the extend and the hold, each target once per
// thrust (swingId). Its length is swordStats(): the blade the hero holds now
// (hero.js sets the provider to hero.blade(), the full-life rule). Without
// pierce the blade stops at the first tile that stops shots (it calls
// onSword on the tiles it covers from the hilt out, once per tile per
// thrust); a clipped blade grows back once it clears. At full life a swipe
// also fires a short sword beam (entities/projectiles/beam.js) straight down
// the facing; none below full life.
//
// The spin (7.6): with the spin stat at full life, twisting the stick while
// the blade is out (extend plus hold) turns the blade toward the stick at up
// to TUNING.sword.spinRate deg/s, the short way round (an exact 180 keeps the
// turning direction, clockwise if it has not turned), and takes over from the
// automatic swipe for the rest of that thrust. The hit test is the sector
// swept this tick plus the blade. The spin-assist option turns a half circle
// of input into a full turn.
//
// What a hit does to a target is the hero's (game/hero.js sets it with
// setBladeHooks: dealDamage for enemies, collectPickup for pickups).
import { sfx, registerSfx, tone, noise } from '../core/audio.js';
import { emit } from '../core/events.js';
import { TUNING } from '../core/tuning.js';
import { state } from '../core/state.js';
import { world } from '../world/world.js';
import { entities, spawn } from '../entities/manager.js';

// A bigger, airier whoosh for the swipe, layered on top of sfx.swing's (more
// juice, not a replacement: nothing that already keys off swing goes quiet).
registerSfx('swordSwipe', () => {
  noise(0.16, { vol: 0.16, freq: 1500, q: 0.6 });
  tone(900, 0.1, { to: 300, vol: 0.05, type: 'sine' });
});

// M1's stand-in stats, kept for code that still reads them.
export const SWORD = {
  id: 'starter',
  swing: 0.24,
  recover: 0.08,
  reach: [0.4, 0.7, 1.0, 1.3],
  hitPad: 0.14,
  damage: 1,
  knockback: 9,
  stun: 0.28,
  traits: [],
};

// Without a provider: the small blade of a strength-1 sword.
const smallBlade = () => {
  const t = TUNING.sword;
  return { small: true, strength: 1, spin: 0, pierce: 0, length: t.smallLength, hitWidth: t.smallHitWidth, reach: t.handOffset + t.smallLength };
};
let provider = smallBlade;

export const swordStats = () => provider();

export function setSwordStats(fn) {
  provider = fn;
}

// What a blade hit does: hitEntity(entity, hit) -> result or null, collect(pickup).
let hooks = {
  hitEntity: (e, hit) => (e.onSword(hit) ? 'hit' : null),
  collect: () => false,
};
export function setBladeHooks(h) {
  hooks = { ...hooks, ...h };
}

const LUNGE = 0.14; // tiles the body leans into a thrust
const SPIN_EXTRA = 0.15; // seconds a spin adds to the hold, so a full turn fits
const SPIN_COMMIT = (100 * Math.PI) / 180; // turned past this, the thrust is a spin
const holdOf = (th) => TUNING.sword.hold + (th?.extra ?? 0);

const phases = () => {
  const t = TUNING.sword;
  return { E: t.extend, H: t.hold, R: t.retract, total: t.extend + t.hold + t.retract };
};

export const isSwinging = (p) => p.attackT > 0;
// Extend and hold: rooted, and a new thrust cannot start yet.
export const isRooted = (p) => !!p.thrust && p.thrust.t < phases().E + holdOf(p.thrust) - 1e-9;

// Thrust progress 0..1 over extend and hold.
export function swingProgress(p) {
  if (!p.thrust) return 1;
  const { E } = phases();
  return Math.min(1, p.thrust.t / (E + holdOf(p.thrust)));
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// yaw of the 8-way direction dir (0 north, clockwise); yaw 0 faces +z
const dirYaw = (dir) => wrap(Math.PI - (dir * Math.PI) / 4);

// opts.silent: the charged spin builds its own thrust from this (startChargedSpin) and does its
// own sound and beam decision, so it skips both here.
export function startSwing(p, opts = {}) {
  if (isRooted(p)) return false;
  const s = swordStats();
  if (s.none) return false;
  const yaw = p.facingYaw ? p.facingYaw() : p.yaw;
  p.swingId++;
  p.thrust = {
    t: 0,
    id: `thrust-${p.swingId}`,
    angle: yaw,
    turned: 0,
    turnDir: 0,
    stick: p.stickDir ?? -1,
    twisted: false,
    spin: s.spin > 0 && !s.small,
    // The swipe (0: the old straight thrust): degrees still to auto-sweep,
    // from half to one side of the facing through to half the other; a
    // manual spin turn (turnBlade) zeroes it and takes over for good.
    swipe: (TUNING.sword.swipe * Math.PI) / 180,
    swipeStarted: false,
    reach: 0,
    tiles: new Set(),
    swept: 0, // degrees swept so far (the spin disc)
    from: yaw,
  };
  p.attackT = phases().total;
  p.yaw = yaw;
  if (!opts.silent) {
    sfx.swing();
    if (TUNING.sword.swipe) sfx.swordSwipe();
    fireBeam(p, yaw, s);
  }
  emit('sword-swing', { player: p, stats: s });
  return true;
}

// The full-life sword beam (fun audit, ALttP as the teacher): a swipe at full
// life also fires a short beam straight down the facing; none below it (or
// with no sword). Strong enough to drop a basic foe at range on its own.
function fireBeam(p, yaw, s) {
  if (!s.full || s.none) return;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  spawn('beam', {
    x: p.x + fx * (TUNING.sword.handOffset + 0.2),
    z: p.z + fz * (TUNING.sword.handOffset + 0.2),
    dir: { x: fx, z: fz },
    damage: Math.max(3, s.strength * 2),
  });
}

export function endSwing(p) {
  p.thrust = null;
  p.attackT = 0;
}

// Pose the arm and body for the model: the blade goes straight out along the
// thrust's angle, flat at hand height (sword-fx.js draws the blade itself).
export function poseSword(hero, p) {
  const out = p.thrust || p.charge || (p.dashing && !(p.dashing.rev > 0));
  const rel = p.thrust ? wrap(p.thrust.angle - p.yaw) : 0;
  hero.swordPivot.rotation.y = out ? rel : -0.95;
  hero.swordPivot.rotation.x = out ? 0 : -1.05;
  hero.body.rotation.y = 0;
  // The lunge: the body snaps forward with the extend and eases back through the hold and retract.
  let lunge = 0;
  if (p.thrust) {
    const { E, H, R } = phases();
    const t = p.thrust.t;
    lunge = t < E ? t / E : t < E + H ? 1 - ((t - E) / H) * 0.5 : Math.max(0, 0.5 * (1 - (t - E - H) / R));
  }
  hero.body.position.z = LUNGE * lunge;
  p.swordAngle = hero.swordPivot.rotation.y;
}

// Advance the thrust by dt; dir is the stick's 8-way direction (-1 idle).
export function tickSword(p, dt, dir = -1) {
  const th = p.thrust;
  if (!th) return;
  const { E, R } = phases();
  const H = holdOf(th);
  const total = E + H + R;
  const t0 = th.t;
  th.t += dt;
  p.attackT = Math.max(0, total - th.t);
  if (p.attackT <= 1e-9) {
    endSwing(p);
    return;
  }
  const active = t0 < E + H - 1e-9;
  const prev = th.angle;
  if (active && th.auto) autoSpin(p, th, dt);
  else if (active && th.spin && dir >= 0) {
    th.swipe = 0; // a manual turn takes over from the automatic swipe for good
    turnBlade(p, th, dt, dir);
  } else if (active && th.swipe) autoSwipe(p, th, dt);
  const s = swordStats();
  const ext = th.t <= E ? th.t / E : th.t <= E + H ? 1 : Math.max(0, 1 - (th.t - E - H) / phases().R);
  if (!active) {
    th.reach = Math.min(th.reach, TUNING.sword.handOffset + (s.reach - TUNING.sword.handOffset) * ext);
    return;
  }
  const source = th.turned > 0.01 ? 'spin' : 'sword';
  th.reach = bladeSweep(p, { yaw: th.angle, from: prev, ext, id: th.id, source, stats: s, tiles: th.tiles }).reach;
}

// The charged spin (A Link to the Past): hold the sword button after a thrust, the blade stays out
// while he walks slowly; held CHARGE_TIME it is ready (a flash), and letting go spins a full turn
// clockwise at spinRate, hitting everything around him. Any sword can do it.
export const CHARGE_TIME = 0.8;
export function startChargedSpin(p) {
  if (isRooted(p) || swordStats().none) return false;
  if (!startSwing(p, { silent: true })) return false;
  const th = p.thrust;
  th.angle = th.from = p.yaw; // start the full turn from the facing, not the swipe's offset
  th.swipe = 0; // the auto-sweep is superseded by the full spin
  th.auto = true;
  th.turnDir = -1;
  th.extra = (2 * Math.PI) / ((TUNING.sword.spinRate * Math.PI) / 180) + 0.05; // time for a full turn
  th.id = `spin-${p.swingId}`;
  sfx.swing();
  emit('sword-charged-spin', { player: p, stats: swordStats() });
  return true;
}

function autoSpin(p, th, dt) {
  const rate = (TUNING.sword.spinRate * Math.PI) / 180;
  const step = Math.min(rate * dt, 2 * Math.PI - th.turned);
  if (step <= 0) return;
  th.angle = wrap(th.angle + step * th.turnDir);
  th.turned += step;
  th.swept = Math.min(360, th.swept + (step * 180) / Math.PI);
  p.yaw = th.angle;
}

// The automatic swipe (fun audit, ALttP as the teacher): with no manual spin
// turn in progress, the blade sweeps th.swipe degrees on its own, at the same
// TUNING.sword.spinRate the manual spin turns at (reusing its sector test and
// its snap, so a dead-ahead target still connects almost at once). th.from is
// still the facing (set in startSwing); the sweep starts half of th.swipe to
// one side of it the first time this runs, so it plays as a real swing
// through the facing rather than jumping there at once.
function autoSwipe(p, th, dt) {
  if (!th.swipeStarted) {
    th.swipeStarted = true;
    th.angle = wrap(th.from - th.swipe / 2);
    th.swipeLeft = th.swipe;
  }
  const rate = (TUNING.sword.spinRate * Math.PI) / 180;
  const step = Math.min(rate * dt, th.swipeLeft);
  if (step <= 0) return;
  th.angle = wrap(th.angle + step);
  th.swipeLeft -= step;
  th.turned += step;
  th.swept = Math.min(360, th.swept + (step * 180) / Math.PI);
  th.turnDir = 1;
}

function turnBlade(p, th, dt, dir) {
  if (dir < 0) return;
  if (!th.twisted) {
    if (dir === th.stick) return;
    th.twisted = true;
  }
  const rate = (TUNING.sword.spinRate * Math.PI) / 180;
  let max = rate * dt;
  let target = dirYaw(dir);
  let diff = wrap(target - th.angle);
  // spin assist: past half a turn, keep going to a full one
  if (state.settings?.spinAssist && th.turned >= Math.PI - 1e-6 && th.turned < 2 * Math.PI - 1e-6) {
    diff = th.turnDir * Math.min(max, 2 * Math.PI - th.turned);
    target = null;
  }
  if (Math.abs(diff) < 1e-6) return;
  let sign = Math.sign(diff);
  if (Math.abs(Math.abs(diff) - Math.PI) < 1e-3) sign = th.turnDir || -1; // exact 180: keep turning, else clockwise
  const step = Math.min(max, Math.abs(diff)) * sign;
  th.angle = wrap(th.angle + step);
  th.turned += Math.abs(step);
  if (th.turned > SPIN_COMMIT) th.extra = SPIN_EXTRA; // a real spin, not one push to the side
  th.swept = Math.min(360, th.swept + (Math.abs(step) * 180) / Math.PI);
  th.turnDir = sign;
  p.yaw = th.angle;
}

// Distance from point (x, z) to the segment from (ax, az) along (ux, uz) for len.
function segDist(x, z, ax, az, ux, uz, len) {
  const t = Math.max(0, Math.min(len, (x - ax) * ux + (z - az) * uz));
  return Math.hypot(x - (ax + ux * t), z - (az + uz * t));
}

// Is angle a inside the arc swept from a0 by d (signed)?
function inSweep(a, a0, d, pad) {
  if (!d) return false;
  const rel = wrap(a - a0) * Math.sign(d);
  const span = Math.abs(d);
  const r = rel < -pad ? rel + 2 * Math.PI : rel;
  return r >= -pad && r <= span + pad;
}

// One hit test: the blade at world yaw `yaw`, extended `ext` of its length,
// having turned from `from` this tick. Calls onSword on the tiles it covers
// (once each per `tiles` set), stops at the first solid tile without pierce,
// hits entities along it and in the swept sector. Returns { reach, clipped }.
export function bladeSweep(p, { yaw, from = yaw, ext = 1, id, source = 'sword', stats = swordStats(), tiles = new Set() }) {
  const t = TUNING.sword;
  const hw = (stats.hitWidth ?? t.minHitWidth) / 2;
  const want = t.handOffset + (stats.reach - t.handOffset) * ext;
  const ux = Math.sin(yaw);
  const uz = Math.cos(yaw);
  const hit = { damage: stats.strength, fromX: p.x, fromZ: p.z, swingId: id, source, pierce: stats.pierce, stats, knockback: SWORD.knockback, stun: SWORD.stun };
  // terrain, from the hilt out
  let reach = want;
  let clipped = false;
  const step = 1 / 8;
  for (let r = Math.min(t.handOffset, want); ; r = Math.min(want, r + step)) {
    const px = p.x + ux * r;
    const pz = p.z + uz * r;
    const tx = Math.floor(px);
    const tz = Math.floor(pz);
    const key = `${tx},${tz}`;
    if (!tiles.has(key)) {
      tiles.add(key);
      world.trigger(tx, tz, 'onSword', { hit, player: p, px, pz });
    }
    if (!stats.pierce && world.shotBlockedAt(px, pz)) {
      reach = Math.max(t.handOffset, r - step / 2);
      clipped = true;
      break;
    }
    if (r >= want) break;
  }
  const turned = wrap(yaw - from);
  for (const e of [...entities]) {
    if (e.removed || e === p) continue;
    const pickup = e.kind === 'pickup';
    if (!pickup && !e.swordable) continue;
    const er = e.r ?? 0.3;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    // behind a wall: out of reach unless the blade pierces
    let touch = segDist(e.x, e.z, p.x, p.z, ux, uz, reach) <= hw + er;
    if (!touch && turned && d <= reach + er) {
      const pad = d > 1e-6 ? Math.asin(Math.min(1, (hw + er) / d)) : Math.PI;
      touch = inSweep(Math.atan2(e.x - p.x, e.z - p.z), from, turned, pad);
    }
    if (!touch) continue;
    if (pickup) {
      hooks.collect(e);
      continue;
    }
    if (e.canBeHit && !e.canBeHit(hit)) continue;
    const r = hooks.hitEntity(e, hit);
    if (r && r !== 'ignored') emit('sword-hit', { target: e, hit });
  }
  return { reach, clipped };
}

// M1 name: a single test of the blade at `angle` from the hero's yaw.
export function swordHitTest(p, angle = 0) {
  return bladeSweep(p, { yaw: p.yaw + angle, id: `test-${p.swingId}` });
}
