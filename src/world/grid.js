// Screen and tile coordinate helpers.
//
// The world is one global grid of 16 x 11 tile screens. Tile (tx, tz) lives in
// screen (floor(tx / 16), floor(tz / 11)). One tile is one world unit, so a
// world position (x, z) stands on tile (floor(x), floor(z)).
import * as THREE from 'three';
import { SCREEN_W, SCREEN_H } from '../core/constants.js';

export const screenKey = (sx, sy) => `${sx},${sy}`;

export const screenOrigin = (sx, sy) => ({ x: sx * SCREEN_W, z: sy * SCREEN_H });

export const screenCenter = (sx, sy) =>
  new THREE.Vector3(sx * SCREEN_W + SCREEN_W / 2, 0, sy * SCREEN_H + SCREEN_H / 2);

// The screen's footprint in world units: x0..x1 west to east, z0..z1 north to south.
export const screenRect = (sx, sy) => ({
  x0: sx * SCREEN_W,
  z0: sy * SCREEN_H,
  x1: (sx + 1) * SCREEN_W,
  z1: (sy + 1) * SCREEN_H,
});

export const screenOfTile = (tx, tz) => [Math.floor(tx / SCREEN_W), Math.floor(tz / SCREEN_H)];

export const tileKey = (tx, tz) => `${tx},${tz}`;
