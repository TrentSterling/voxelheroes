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
    // Remote heroes keep physical player contact, but enemies must reach the
    // same damage radius they reach against the local hero.
    if (b.kind === 'enemy' && e.kind === 'friend') continue;
    if (bumps(b, e, x, z)) return true;
  }
  return b.solid && b !== player && bumps(b, player, x, z);
}

function bumps(b, e, x, z) {
  const d = Math.hypot(e.x - x, e.z - z);
  return d < e.r + b.r && d < Math.hypot(e.x - b.x, e.z - b.z);
}

// Move body b = { x, z, r } by (dx, dz), one axis at a time so it slides along
// walls. bounds, a rect { x0, z0, x1, z1 } such as the current screen
// (currentScreen() is one), keeps it inside; the hero passes null so it can
// walk off the edge into the next screen. (An M1-style origin { x, z } still
// works and means a default-size screen there.) Returns true if anything
// stopped it.
export function moveBody(b, dx, dz, bounds) {
  let hit = false;
  let inside = () => true;
  if (bounds) {
    const x0 = bounds.x0 ?? bounds.x;
    const z0 = bounds.z0 ?? bounds.z;
    const x1 = bounds.x1 ?? x0 + SCREEN_W;
    const z1 = bounds.z1 ?? z0 + SCREEN_H;
    inside = (x, z) => x - b.r >= x0 && x + b.r <= x1 && z - b.r >= z0 && z + b.r <= z1;
  }
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

// How far (up to `dist`) body b can go in direction (ux, uz) before anything
// solid stops it, tested every 1/16 tile. Used to walk the hero into a new
// screen without ending up inside a wall.
export function clearDistance(b, ux, uz, dist) {
  const step = 1 / 16;
  let d = 0;
  while (d < dist) {
    const next = Math.min(dist, d + step);
    if (world.blocked(b.x + ux * next, b.z + uz * next, b.r, b)) break;
    d = next;
  }
  return d;
}
