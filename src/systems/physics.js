// Moving bodies through the tile grid.
import { SCREEN_W, SCREEN_H } from '../core/constants.js';
import { world } from '../world/world.js';

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

// How far (up to `dist`) body b can go in direction (ux, uz) before anything
// solid stops it, in steps of 1/16 tile. Used to walk the hero into a new
// screen without ending up inside a wall.
export function clearDistance(b, ux, uz, dist) {
  const step = 1 / 16;
  let d = 0;
  while (d + step <= dist + 1e-9) {
    if (world.blocked(b.x + ux * (d + step), b.z + uz * (d + step), b.r, b)) break;
    d += step;
  }
  return d;
}
