// The sword: starting a swing, posing the blade, and hitting things along it.
//
// Everything tunable is data. SWORD holds the starting blade's stats; the
// sword feature swaps in its own stats (length/width levels, the giant blade
// at full health, traits) with setSwordStats(() => stats) instead of editing
// the swing code:
//   swing      seconds of the active sweep (hits happen during it)
//   recover    seconds after the sweep before the next swing or step
//   reach      distances from the hero's centre sampled along the blade
//   hitPad     half-thickness of the blade for hit tests
//   damage     half-hearts of damage per hit
//   knockback  push speed given to what it hits; stun: seconds it stays pushed
//   traits     free-form tags ('piercing', 'beam', ...) for the sword feature
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { world } from '../world/world.js';
import { entities } from '../entities/manager.js';

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

let provider = () => SWORD;

export const swordStats = () => provider();

export function setSwordStats(fn) {
  provider = fn;
}

export const isSwinging = (p) => p.attackT > 0;

// Swing progress 0..1 across the active sweep.
export function swingProgress(p) {
  const s = swordStats();
  return Math.min(1, (s.swing + s.recover - p.attackT) / s.swing);
}

export function startSwing(p) {
  if (p.attackT > 0) return false;
  const s = swordStats();
  p.attackT = s.swing + s.recover;
  p.swingId++;
  sfx.swing();
  emit('sword-swing', { player: p, stats: s });
  return true;
}

// Pose the blade, the sword arm and the body twist. w is the walk cycle.
export function poseSword(hero, p, w) {
  if (p.attackT > 0) {
    const k = 1 - Math.pow(1 - swingProgress(p), 3);
    hero.swordPivot.rotation.y = -1.9 + k * 3.5;
    hero.swordPivot.rotation.x = 0.12;
    hero.armR.rotation.x = -1.3;
    hero.armR.rotation.z = 0;
    hero.body.rotation.y = -0.35 + k * 0.7;
  } else {
    hero.swordPivot.rotation.y = -0.95;
    hero.swordPivot.rotation.x = -1.05 + w * 0.08;
    hero.armR.rotation.x = w * 0.5 - 0.3;
    hero.body.rotation.y = 0;
  }
  p.swordAngle = hero.swordPivot.rotation.y;
}

// Advance the swing; while the sweep is active, test the blade.
export function tickSword(p, dt) {
  if (p.attackT <= 0) return;
  p.attackT -= dt;
  if (swingProgress(p) < 1) swordHitTest(p, p.swordAngle);
}

// Test points along the blade at angle (relative to the hero's yaw) against
// swordable entities and the tiles under them (tile onSword hooks).
export function swordHitTest(p, angle) {
  const s = swordStats();
  const wa = p.yaw + angle;
  const dx = Math.sin(wa);
  const dz = Math.cos(wa);
  const hit = { damage: s.damage, fromX: p.x, fromZ: p.z, knockback: s.knockback, stun: s.stun, swingId: p.swingId, source: 'sword', stats: s };
  for (const r of s.reach) {
    const px = p.x + dx * r;
    const pz = p.z + dz * r;
    for (const e of [...entities]) {
      if (e.removed || !e.swordable || !e.canBeHit(hit)) continue;
      if (Math.hypot(px - e.x, pz - e.z) < e.r + s.hitPad && e.onSword(hit)) emit('sword-hit', { target: e, hit });
    }
    world.trigger(Math.floor(px), Math.floor(pz), 'onSword', { hit, player: p, px, pz });
  }
}
