// The A button talks before it swings: if something in front of the hero
// answers onInteract (an NPC, a sign tile, a shop counter), the press is used
// up and the sword stays sheathed.
import { world } from '../world/world.js';
import { entities } from '../entities/manager.js';

export function tryInteract(p) {
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
  if (best && best.onInteract(p) !== false) return true;
  const tx = Math.floor(p.x + fx * 0.55);
  const tz = Math.floor(p.z + fz * 0.55);
  return !!world.trigger(tx, tz, 'onInteract', { player: p });
}
