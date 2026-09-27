// Moving bodies through the tile grid and around solid entities.
import { SCREEN_W, SCREEN_H } from '../core/constants.js';
import { world } from '../world/world.js';
import { entities } from '../entities/manager.js';
import { player } from '../entities/player.js';

// Would body b standing at (x, z) run into another body? Solid entities
// (NPCs, push blocks) block everyone; a solid body that moves is also
// blocked by the hero. Only moves that get closer count, so a body that
// already overlaps one (spawned inside it) can always walk out.
export function bumpsEntity(b, x, z) {
  for (const e of entities) {
    if (!e.solid || e.removed || e === b) continue;
    if (bumps(b, e, x, z)) return true;
  }
  return b.solid && b !== player && bumps(b, player, x, z);
}

function bumps(b, e, x, z) {
  const d = Math.hypot(e.x - x, e.z - z);
  return d < e.r + b.r && d < Math.hypot(e.x - b.x, e.z - b.z);
}

// Move body b = { x, z, r } by (dx, dz), one axis at a time so it slides along
// walls. bounds (a screen origin { x, z }) keeps it inside one screen; the
// hero passes null so it can walk off the edge into the next screen.
// Returns true if anything stopped it.
export function moveBody(b, dx, dz, bounds) {
  let hit = false;
  const inside = (x, z) =>
    !bounds || (x - b.r >= bounds.x && x + b.r <= bounds.x + SCREEN_W && z - b.r >= bounds.z && z + b.r <= bounds.z + SCREEN_H);
  if (dx) {
    const nx = b.x + dx;
    if (!world.blocked(nx, b.z, b.r, b) && inside(nx, b.z) && !bumpsEntity(b, nx, b.z)) b.x = nx;
    else hit = true;
  }
  if (dz) {
    const nz = b.z + dz;
    if (!world.blocked(b.x, nz, b.r, b) && inside(b.x, nz) && !bumpsEntity(b, b.x, nz)) b.z = nz;
    else hit = true;
  }
  return hit;
}
