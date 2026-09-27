// Grid and unit constants shared by every module.
//
// World units: one tile is one unit. Screen (sx, sy) covers world x in
// [sx * SCREEN_W, (sx + 1) * SCREEN_W) and z in [sy * SCREEN_H, (sy + 1) * SCREEN_H).
// +x is east, +z is south (towards the camera), y is up.

export const SCREEN_W = 16; // tiles per screen, west to east
export const SCREEN_H = 11; // tiles per screen, north to south

export const R = 8; // terrain voxels along one tile edge
export const TV = 1 / R; // size of one terrain voxel in world units
export const GROUND_Y = TV; // top of the ground layer: feet, props and particles rest here

export const DEG = Math.PI / 180;
