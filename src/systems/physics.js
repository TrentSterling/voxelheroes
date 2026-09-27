// Moving bodies through the tile grid.
import { SCREEN_W, SCREEN_H } from '../core/constants.js';
import { world } from '../world/world.js';

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
    if (!world.blocked(nx, b.z, b.r, b) && inside(nx, b.z)) b.x = nx;
    else hit = true;
  }
  if (dz) {
    const nz = b.z + dz;
    if (!world.blocked(b.x, nz, b.r, b) && inside(b.x, nz)) b.z = nz;
    else hit = true;
  }
  return hit;
}
