// Screen and tile coordinate helpers.
//
// The world is one global grid of tiles; one tile is one world unit, so a
// world position (x, z) stands on tile (floor(x), floor(z)). Each area lays
// its screens on a lattice of its own screen size (areas.js), so a screen is
// found from a tile with world.locate(tx, tz), not by division. A screen
// object carries its footprint in global tiles:
//   key 'area:i,j', area, lx, ly (local screen), w, h (tiles),
//   x0, z0 (north-west corner), x1, z1 (one past the south-east corner).
import * as THREE from 'three';

export const screenKey = (areaId, lx, ly) => `${areaId}:${lx},${ly}`;

export const tileKey = (tx, tz) => `${tx},${tz}`;

// The M1 helpers took global screen numbers of one 16 x 11 lattice; screens
// now have per-area sizes, so they take a screen object instead.
function need(screen, fn) {
  if (!screen || typeof screen !== 'object' || screen.x0 === undefined)
    throw new Error(`${fn}(screen) takes a screen object (currentScreen(), world.locate(tx, tz).screen), not screen numbers`);
}

// North-west corner of a screen in world units.
export function screenOrigin(screen) {
  need(screen, 'screenOrigin');
  return { x: screen.x0, z: screen.z0 };
}

// The screen's footprint in world units: x0..x1 west to east, z0..z1 north to south.
export function screenRect(screen) {
  need(screen, 'screenRect');
  return { x0: screen.x0, z0: screen.z0, x1: screen.x1, z1: screen.z1 };
}

// Middle of the screen on the ground (for a room: the floor centre).
export function screenCenter(screen) {
  need(screen, 'screenCenter');
  return new THREE.Vector3((screen.x0 + screen.x1) / 2, 0, (screen.z0 + screen.z1) / 2);
}

// Is world point (x, z) on this screen? r shrinks the screen by a body radius.
export const insideScreen = (screen, x, z, r = 0) =>
  x - r >= screen.x0 && x + r <= screen.x1 && z - r >= screen.z0 && z + r <= screen.z1;

// Local tile coordinates <-> world coordinates of a screen.
export const toLocal = (screen, x, z) => ({ x: x - screen.x0, z: z - screen.z0 });
export const toWorld = (screen, x, z) => ({ x: screen.x0 + x, z: screen.z0 + z });

// Unit steps for the four edges.
export const DIRS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
