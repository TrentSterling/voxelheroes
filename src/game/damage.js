// Damage to enemies (and anything else that takes hits): the one function
// every weapon calls, so immunities, weak spots, guards, freezing and the
// 'enemy-hit' event work the same for the blade, beams, arrows, bombs, the
// boomerang, spells and the dash.
//
//   dealDamage(enemy, { amount: 4, source: 'arrow', from: arrow })
//     -> { result: 'hit' | 'killed' | 'immune' | 'blocked' | 'ignored', damage }
//   damageAt(x, z, 1.5, { amount: 6, source: 'bomb' })  -> [{ entity, result, damage }]
//
// opts:
//   amount     damage points (enemy HP is in the same points: blade-start does 3)
//   source     SOURCES below ('sword', 'arrow', 'bomb', ...); immunities name these
//   from       { x, z } or an entity: where the hit comes from (knockback, guards)
//   knockback  tiles of stagger (default TUNING.enemy.knock, heavy targets
//              TUNING.enemy.heavyKnock; 0: none) over TUNING.enemy.knockTime
//   stun       seconds stunned after the stagger (default TUNING.enemy.stagger;
//              the boomerang passes TUNING.enemy.stunBoomerang)
//   freeze     seconds frozen (the freeze special and spell); bosses never freeze
//   swingId    one thrust (or one arrow, one blast) hits a target once
//   by         'hero' or the entity that dealt it
//
// The target describes itself with fields (the foes streams set them):
//   immune: ['sword', 'fire']   sources that do nothing ('immune')
//   weak: { arrow: 2 }           damage multipliers per source
//   guards(hit) -> true          a front guard stops it ('blocked'); shield knights
//   boss: true                   never frozen, never shattered
//   heavy: true                  staggers TUNING.enemy.heavyKnock instead
//   shatter: false               stays alive while frozen (casters): frozen hits are 'immune'
//   frozenT                      seconds left frozen; a frozen enemy that is not a
//                                boss dies to any hit (gameplay spec 8.2)
//   hurt(hit)                    applies the hit (M1 Enemy.hurt: flash, knockback, death)
//   onImmune(hit), onBlocked(hit)  optional reactions (a clink, a recoil)
//
// Until the foes streams move to it, M1 enemies take the hit through
// Enemy.hurt, with the stagger converted to the M1 knockback speed.
import { emit } from '../core/events.js';
import { TUNING } from '../core/tuning.js';
import { entities } from '../entities/manager.js';
import { registerPlayHook } from '../systems/flow.js';

export const SOURCES = ['sword', 'beam', 'spin', 'dash', 'arrow', 'bomb', 'boomerang', 'grapple', 'fire', 'book', 'quake', 'reflect', 'hazard', 'enemy'];
export const HIT_RESULTS = ['hit', 'killed', 'immune', 'blocked', 'ignored'];

const pointOf = (from) => (from && Number.isFinite(from.x) && Number.isFinite(from.z) ? { x: from.x, z: from.z } : null);

// M1 enemies move a knockback speed that decays by 0.85 per 1/60 s while
// stunned: the speed that covers `tiles` in `seconds`.
const M1_DECAY = 0.85;
function m1Speed(tiles, seconds) {
  const n = Math.max(1, Math.round(seconds * 60));
  const perUnit = (1 - Math.pow(M1_DECAY, n)) / (1 - M1_DECAY) / 60;
  return tiles / perUnit;
}

export const isFrozen = (e) => (e?.frozenT ?? 0) > 0;

export function dealDamage(target, opts = {}) {
  const { amount = 1, source = 'sword', from = null, freeze = 0, swingId, by = 'hero' } = opts;
  const out = (result, damage = 0, hit = null) => {
    if (result !== 'ignored') emit('enemy-hit', { entity: target, hit, result, damage });
    return { result, damage };
  };
  if (!target || target.removed || typeof target.hurt !== 'function') return { result: 'ignored', damage: 0 };
  const p = pointOf(from);
  const E = TUNING.enemy;
  const tiles = opts.knockback ?? (target.heavy ? E.heavyKnock : E.knock);
  const stun = (opts.stun ?? E.stagger) + (tiles > 0 ? E.knockTime : 0);
  const hit = {
    damage: amount,
    fromX: p ? p.x : target.x,
    fromZ: p ? p.z : target.z,
    knockback: tiles > 0 ? m1Speed(tiles, stun) : 0,
    stun,
    source,
    swingId,
    by,
    freeze,
    tiles,
  };
  if (target.canBeHit && !target.canBeHit(hit)) return { result: 'ignored', damage: 0 };
  if (target.invulnerable || target.immune?.includes(source)) {
    target.onImmune?.(hit);
    return out('immune', 0, hit);
  }
  if (target.guards?.(hit)) {
    target.onBlocked?.(hit);
    return out('blocked', 0, hit);
  }
  if (isFrozen(target) && !target.boss) {
    if (target.shatter === false) {
      target.onImmune?.(hit);
      return out('immune', 0, hit);
    }
    hit.damage = Math.max(amount, target.hp ?? amount); // shatters
    hit.shattered = true;
  } else {
    hit.damage = Math.max(0, Math.round(amount * (target.weak?.[source] ?? 1)));
  }
  if (freeze > 0 && !target.boss) target.frozenT = Math.max(target.frozenT ?? 0, freeze);
  target.hurt(hit);
  const killed = target.removed || (target.hp ?? 1) <= 0;
  return out(killed ? 'killed' : 'hit', hit.damage, hit);
}

// Everything that takes hits within `radius` of (x, z) (plus its own radius).
// filter(e) narrows it; the source entity (opts.from) is skipped.
export function damageAt(x, z, radius, opts = {}, filter = null) {
  const hits = [];
  for (const e of [...entities]) {
    if (e.removed || e === opts.from || typeof e.hurt !== 'function' || e.kind === 'player') continue;
    if (Math.hypot(e.x - x, e.z - z) > radius + (e.r ?? 0)) continue;
    if (filter && !filter(e)) continue;
    const r = dealDamage(e, { from: { x, z }, ...opts });
    if (r.result !== 'ignored') hits.push({ entity: e, ...r });
  }
  return hits;
}

// Frozen enemies count down and stand still (the M1 stun keeps them from
// thinking; the foes streams draw the ice).
registerPlayHook({
  id: 'contracts-frozen',
  phase: 'after',
  order: 2,
  update(dt) {
    for (const e of entities) {
      if (e.removed || !(e.frozenT > 0)) continue;
      e.frozenT = Math.max(0, e.frozenT - dt);
      if (e.frozenT > 0 && 'stunT' in e) {
        e.stunT = Math.max(e.stunT, dt * 2);
        e.kx = 0;
        e.kz = 0;
      }
    }
  },
});
