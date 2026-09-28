// The blade (gameplay spec 7.4 to 7.6, 7.9): the thrust, the spin, the dash
// blade, terrain clip, and hitting things along it. Every number is
// TUNING.sword's.
//
//   startSwing(p)          a thrust along the attack facing (p.facingYaw());
//                          false while the blade is still out (a new thrust may
//                          start from the first tick of the retract)
//   tickSword(p, dt, dir)  advance it; dir: the stick's 8-way direction
//                          (input.move8().dir, -1 idle) for the spin
//   bladeSweep(p, opts)    one hit test of a blade (the dash uses it)
//   isRooted(p)            extend and hold: the hero cannot walk
//
// The thrust: the blade extends in TUNING.sword.extend (2 ticks), holds
// `hold` and retracts in `retract`; it hits during the extend and the hold,
// each target once per thrust (swingId). Its length is swordStats(): the
// blade the hero holds now (hero.js sets the provider to hero.blade(), the
// full-life rule). Without pierce the blade stops at the first tile that
// stops shots (it calls onSword on the tiles it covers from the hilt out,
// once per tile per thrust); a clipped blade grows back once it clears.
//
// The spin (7.6): with the spin stat at full life, twisting the stick while
// the blade is out (extend plus hold) turns the blade toward the stick at up
// to TUNING.sword.spinRate deg/s, the short way round (an exact 180 keeps the
// turning direction, clockwise if it has not turned). The hit test is the
// sector swept this tick plus the blade. The spin-assist option turns a
// half circle of input into a full turn.
//
// What a hit does to a target is the hero's (game/hero.js sets it with
// setBladeHooks: dealDamage for enemies, collectPickup for pickups).
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { TUNING } from '../core/tuning.js';
import { state } from '../core/state.js';
import { world } from '../world/world.js';
import { entities } from '../entities/manager.js';

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

const phases = () => {
  const t = TUNING.sword;
  return { E: t.extend, H: t.hold, R: t.retract, total: t.extend + t.hold + t.retract };
};

export const isSwinging = (p) => p.attackT > 0;
// Extend and hold: rooted, and a new thrust cannot start yet.
export const isRooted = (p) => !!p.thrust && p.thrust.t < phases().E + phases().H - 1e-9;

// Thrust progress 0..1 over extend and hold.
export function swingProgress(p) {
  if (!p.thrust) return 1;
  const { E, H } = phases();
  return Math.min(1, p.thrust.t / (E + H));
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// yaw of the 8-way direction dir (0 north, clockwise); yaw 0 faces +z
const dirYaw = (dir) => wrap(Math.PI - (dir * Math.PI) / 4);

export function startSwing(p) {
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
    reach: 0,
    tiles: new Set(),
    swept: 0, // degrees swept so far (the spin disc)
    from: yaw,
  };
  p.attackT = phases().total;
  p.yaw = yaw;
  sfx.swing();
  emit('sword-swing', { player: p, stats: s });
  return true;
}

export function endSwing(p) {
  p.thrust = null;
  p.attackT = 0;
}

// Pose the arm and body for the model: the blade goes straight out along the
// thrust's angle, flat at hand height (sword-fx.js draws the blade itself).
export function poseSword(hero, p) {
  const out = p.thrust || p.dashing;
  const rel = p.thrust ? wrap(p.thrust.angle - p.yaw) : 0;
  hero.swordPivot.rotation.y = out ? rel : -0.95;
  hero.swordPivot.rotation.x = out ? 0 : -1.05;
  hero.body.rotation.y = 0;
  p.swordAngle = hero.swordPivot.rotation.y;
}

// Advance the thrust by dt; dir is the stick's 8-way direction (-1 idle).
export function tickSword(p, dt, dir = -1) {
  const th = p.thrust;
  if (!th) return;
  const { E, H, total } = phases();
  const t0 = th.t;
  th.t += dt;
  p.attackT = Math.max(0, total - th.t);
  if (p.attackT <= 1e-9) {
    endSwing(p);
    return;
  }
  const active = t0 < E + H - 1e-9;
  const prev = th.angle;
  if (active && th.spin) turnBlade(p, th, dt, dir);
  const s = swordStats();
  const ext = th.t <= E ? th.t / E : th.t <= E + H ? 1 : Math.max(0, 1 - (th.t - E - H) / phases().R);
  if (!active) {
    th.reach = Math.min(th.reach, TUNING.sword.handOffset + (s.reach - TUNING.sword.handOffset) * ext);
    return;
  }
  const source = th.turned > 0.01 ? 'spin' : 'sword';
  th.reach = bladeSweep(p, { yaw: th.angle, from: prev, ext, id: th.id, source, stats: s, tiles: th.tiles }).reach;
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
