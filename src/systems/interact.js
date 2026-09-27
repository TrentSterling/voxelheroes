// The A button talks before it swings: if something in front of the hero
// answers onInteract (an NPC, a sign tile, a shop counter), the press is used
// up and the sword stays sheathed.
//
//   findInteraction(player) -> { entity, label } | { tx, tz, def, label } | null
//       what A would talk to or check now, without doing it (the prompt bar
//       asks every frame). label: the entity's or tile's `prompt` ('Talk',
//       'Read', 'Open', 'Buy'), default 'Talk' for entities, 'Check' for tiles.
//   tryInteract(player) -> true if A was used up
import { world } from '../world/world.js';
import { entities } from '../entities/manager.js';

// The nearest entity with onInteract roughly in front of the hero, in reach.
function facingEntity(p) {
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);
  let best = null;
  let bestD = Infinity;
  for (const e of entities) {
    if (e.removed || !e.onInteract) continue;
    const dx = e.x - p.x;
    const dz = e.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > (e.interactRange ?? 0.9) + e.r) continue;
    if ((dx * fx + dz * fz) / (d || 1) < 0.5) continue; // roughly in front
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

const tileAhead = (p) => [Math.floor(p.x + Math.sin(p.yaw) * 0.55), Math.floor(p.z + Math.cos(p.yaw) * 0.55)];

export function findInteraction(p) {
  const e = facingEntity(p);
  if (e) return { entity: e, label: e.prompt ?? 'Talk' };
  const [tx, tz] = tileAhead(p);
  const def = world.tileDefAt(tx, tz);
  return def?.onInteract ? { tx, tz, def, label: def.prompt ?? 'Check' } : null;
}

export function tryInteract(p) {
  const best = facingEntity(p);
  if (best && best.onInteract(p) !== false) return true;
  const [tx, tz] = tileAhead(p);
  return !!world.trigger(tx, tz, 'onInteract', { player: p });
}
