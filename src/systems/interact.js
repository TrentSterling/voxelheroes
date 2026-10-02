// The A button talks before it swings: if something in front of the hero
// answers onInteract (an NPC, a sign tile, a shop counter), the press is used
// up and the sword stays sheathed.
// An armed hero holding Guard commits A to combat instead of conversation.
//
//   findInteraction(player) -> { entity, label } | { tx, tz, def, label } | null
//       what A would talk to or check now, without doing it (the prompt bar
//       asks every frame). label: the entity's or tile's `prompt` ('Talk',
//       'Read', 'Open', 'Buy'), default 'Talk' for entities, 'Check' for tiles.
//   tryInteract(player) -> true if A was used up
//
// Reach (gameplay spec 5.6: "facing it within 1.0 tile"): TUNING.hero.interactRange
// from the hero's centre to the entity's edge (an entity may set its own
// interactRange, a counter reached across a table); roughly in front means
// within 60 degrees of the facing.
import { TUNING } from '../core/tuning.js';
import { world } from '../world/world.js';
import { entities } from '../entities/manager.js';
import { input } from '../core/input.js';
import { state } from '../core/state.js';

const combatIntent = () => input.held('guard') && !!state.swords?.equipped;

// The nearest entity with onInteract roughly in front of the hero, in reach.
function facingEntity(p) {
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);
  let best = null;
  let bestScore = Infinity;
  for (const e of entities) {
    if (e.removed || !e.onInteract || e.out === false || e.object?.visible === false) continue;
    const dx = e.x - p.x;
    const dz = e.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > (e.interactRange ?? TUNING.hero.interactRange) + e.r) continue;
    const alignment = (dx * fx + dz * fz) / (d || 1);
    if (alignment < 0.5) continue;
    // A person directly under the facing direction wins over a slightly
    // nearer neighbor at the edge of the cone, including crowded followers.
    const score = d + (1 - alignment) * (e.interactRange ?? TUNING.hero.interactRange) * 1.5;
    if (score < bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best;
}

const tileAhead = (p) => [Math.floor(p.x + Math.sin(p.yaw) * (p.r + 0.35)), Math.floor(p.z + Math.cos(p.yaw) * (p.r + 0.35))];

export function findInteraction(p) {
  if (combatIntent()) return null;
  const e = facingEntity(p);
  if (e) return { entity: e, label: e.prompt ?? 'Talk' };
  const [tx, tz] = tileAhead(p);
  const def = world.tileDefAt(tx, tz);
  return def?.onInteract ? { tx, tz, def, label: def.prompt ?? 'Check' } : null;
}

export function tryInteract(p) {
  if (combatIntent()) return false;
  const best = facingEntity(p);
  if (best && best.onInteract(p) !== false) return true;
  const [tx, tz] = tileAhead(p);
  return !!world.trigger(tx, tz, 'onInteract', { player: p });
}
