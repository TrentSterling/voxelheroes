// Behaviour primitives for enemies (gameplay spec 8.2, 12.4; CONTRACTS 8.5).
// Each works on an Enemy (entities/enemy.js) and keeps its state in e.ai,
// so an enemy's think() is a few calls:
//
//   think(dt, ctx) {
//     const dir = aligned(this, 5);                   // hero in line within 5 tiles?
//     if (dir && !this.ai.charge) charge(this, dir);  // tell, then rush
//     if (!stepCharge(this, dt, ctx.bounds)) wander(this, dt, ctx.bounds);
//   }
//
//   wander(e, dt, bounds, speed)     legs of wanderLeg s in a cardinal, pauses of
//                                    wanderPause s, reverses at walls; -> moving
//   aligned(e, range, tol)           the cardinal toward the hero when he is within
//                                    tol (TUNING.enemy.alignTol) of its row or column
//                                    and within range tiles; else null
//   charge(e, dir, opts)             start a charge: tell (chargeTell), then
//                                    speed x mult for up to `tiles`
//   stepCharge(e, dt, bounds)        -> true while charging (tell included)
//   flier(e, dt, bounds, speed)      a new heading every flierTurn s
//   hop(e, dt, bounds, opts)         jumps every hopEvery s, hopAir s in the air
//                                    (airborne: cannot be hit), a shadow that shows
//                                    where it lands; -> 'air' | 'ground'
//   shoot(e, dt, opts)               shooter: when aligned, a shooterStop s tell,
//                                    then fire(dir); cooldown shooterCooldown s
//   tell(e, seconds)                 a wind-up the hero can read: the enemy stops
//                                    and shakes; -> true while telling
//   alert(e)                         the "!" over an enemy that noticed the hero
//   faceDir(e, dir)                  turn the body to a direction
import { random } from '../core/random.js';
import { TUNING } from '../core/tuning.js';
import { getMaterial } from '../core/materials.js';
import { modelMesh } from '../models/kit.js';
import { CHARACTER_MODELS } from '../models/characters.js';
import { player } from './player.js';

export const CARDINALS = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
];

const range = ([a, b]) => a + random() * (b - a);
const A = () => TUNING.enemy.ai;

export function faceDir(e, dir) {
  if (dir && (dir.x || dir.z)) e.yaw = Math.atan2(dir.x, dir.z);
}

export function randomCardinal() {
  return CARDINALS[Math.floor(random() * 4)];
}

// Wander (spec 8.2): legs in a random cardinal, pauses between; reverse at walls.
export function wander(e, dt, bounds, speed = e.speed, { turnChance = 0 } = {}) {
  const newLeg = () => {
    const t = range(A().wanderLeg);
    // the skeleton: a chance of one random turn somewhere in each leg
    return { dir: randomCardinal(), t, pause: false, turnAt: turnChance && random() < turnChance ? t * random() : -1 };
  };
  const s = (e.ai.wander ??= newLeg());
  s.t -= dt;
  if (s.t <= 0) {
    if (s.pause) e.ai.wander = newLeg();
    else {
      s.pause = true;
      s.t = range(A().wanderPause);
    }
  }
  const w = e.ai.wander;
  if (w.pause) return false;
  if (w.turnAt >= 0 && w.t <= w.turnAt) {
    w.dir = randomCardinal();
    w.turnAt = -1;
  }
  if (e.walk(w.dir.x * speed * dt, w.dir.z * speed * dt, bounds)) w.dir = { x: -w.dir.x, z: -w.dir.z };
  faceDir(e, w.dir);
  return true;
}

// The hero within tol of this enemy's row or column, within range: the
// cardinal toward him, else null.
export function aligned(e, reach = Infinity, tol = TUNING.enemy.alignTol) {
  const target = e.targetHero?.() ?? player;
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  if (Math.abs(dz) <= tol && Math.abs(dx) <= reach) return { x: Math.sign(dx) || 1, z: 0 };
  if (Math.abs(dx) <= tol && Math.abs(dz) <= reach) return { x: 0, z: Math.sign(dz) || 1 };
  return null;
}

// A wind-up: stands still and shakes for `seconds`.
export function tell(e, seconds) {
  e.ai.tellT = seconds;
  return true;
}
export function stepTell(e, dt) {
  if (!(e.ai.tellT > 0)) {
    e.mesh.position.x = 0;
    return false;
  }
  e.ai.tellT -= dt;
  e.mesh.position.x = Math.sin(e.ai.tellT * 80) * 0.03;
  return true;
}

// Charger: a tell, then speed x mult toward dir for up to `tiles` (or `time` s).
export function charge(e, dir, { mult = range(A().chargeMult), speed = null, tiles = A().chargeMax, time = Infinity, tellTime = TUNING.enemy.tells.chargeTell } = {}) {
  e.ai.charge = { dir, speed: speed ?? e.speed * mult, left: tiles, time };
  tell(e, tellTime);
  alert(e);
  faceDir(e, dir);
}
export function stepCharge(e, dt, bounds) {
  const c = e.ai.charge;
  if (!c) return false;
  if (stepTell(e, dt)) return true;
  const step = c.speed * dt;
  c.left -= step;
  c.time -= dt;
  const hit = e.walk(c.dir.x * step, c.dir.z * step, bounds);
  if (hit || c.left <= 0 || c.time <= 0) e.ai.charge = null;
  return true;
}

// Flier: a new heading every flierTurn s (any angle), bouncing off walls.
export function flier(e, dt, bounds, speed = e.speed, { toward = 0 } = {}) {
  const s = (e.ai.fly ??= { a: random() * Math.PI * 2, t: 0 });
  s.t -= dt;
  if (s.t <= 0) {
    s.t = A().flierTurn;
    if (toward && random() < toward) { const target = e.targetHero?.() ?? player; s.a = Math.atan2(target.x - e.x, target.z - e.z) + (random() - 0.5); }
    else s.a += (random() - 0.5) * Math.PI;
  }
  const dx = Math.sin(s.a) * speed * dt;
  const dz = Math.cos(s.a) * speed * dt;
  if (e.walk(dx, dz, bounds)) s.a += Math.PI;
  e.yaw = s.a;
}

// Hopper: jumps every `every` s (default hopEvery), `air` s in the air, `tiles`
// per jump (default: speed x air). While in the air it cannot be hit and its
// shadow shows the landing spot. dirFn() picks each jump's direction.
export function hop(e, dt, bounds, { every = null, air = A().hopAir, tiles = null, dirFn = null } = {}) {
  const s = (e.ai.hop ??= { wait: every ?? range(A().hopEvery), t: 0, dir: null, tiles: 0 });
  if (!s.dir) {
    s.wait -= dt;
    e.airborne = false;
    e.mesh.position.y = e.height;
    if (s.wait > 0) return 'ground';
    s.dir = dirFn ? dirFn() : randomCardinal();
    s.tiles = tiles ?? e.speed * air;
    s.t = 0;
    faceDir(e, s.dir);
  }
  s.t += dt;
  const k = Math.min(1, s.t / air);
  const step = (s.tiles / air) * dt;
  if (e.walk(s.dir.x * step, s.dir.z * step, bounds)) s.dir = { x: -s.dir.x, z: -s.dir.z };
  e.airborne = k < 1;
  e.mesh.position.y = e.height + Math.sin(k * Math.PI) * TUNING.enemy.hopHeight * Math.min(1, s.tiles / 3);
  if (k >= 1) {
    s.dir = null;
    s.wait = every ?? range(A().hopEvery);
    e.airborne = false;
    e.mesh.position.y = e.height;
    return 'ground';
  }
  return 'air';
}

// Shooter: aligned within `reach`: stop for shooterStop s (the tell), then
// fire(dir); cooldown shooterCooldown s. -> true while it holds still.
export function shoot(e, dt, { reach = 7, fire, stop = TUNING.enemy.tells.shooterStop, cooldown = A().shooterCooldown, needAligned = true } = {}) {
  const s = (e.ai.shoot ??= { cool: range(cooldown), dir: null });
  s.cool -= dt;
  if (s.dir) {
    if (stepTell(e, dt)) return true;
    fire(s.dir);
    s.dir = null;
    s.cool = range(cooldown);
    return false;
  }
  if (s.cool > 0) return false;
  const target = e.targetHero?.() ?? player;
  const dir = needAligned ? aligned(e, reach) : { x: target.x - e.x, z: target.z - e.z };
  if (!dir) return false;
  s.dir = dir;
  faceDir(e, dir);
  tell(e, stop);
  return true;
}

// The "!" over an enemy that noticed the hero (look's alert mark), for a moment.
let alertModel = null;
export function alert(e, seconds = 0.6) {
  if (!e.holder) return;
  if (!e.ai.alertMesh) {
    alertModel ??= CHARACTER_MODELS.alertMark?.();
    if (!alertModel) return;
    const m = modelMesh(alertModel, getMaterial('character'));
    m.position.y = (e.height ?? 0) + 1.1;
    e.holder.add(m);
    e.ai.alertMesh = m;
  }
  e.ai.alertMesh.visible = true;
  e.ai.alertT = seconds;
}
export function stepAlert(e, dt) {
  if (e.ai.alertMesh && (e.ai.alertT -= dt) <= 0) e.ai.alertMesh.visible = false;
}
