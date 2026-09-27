// Grid and unit constants shared by every module.
//
// World units: one tile is one unit. +x is east, +z is south (towards the
// camera), y is up. SCREEN_W x SCREEN_H is the default outdoor screen and the
// lattice of M1 save data; each area sets its own screen size (world/areas.js),
// so find a screen with world.locate(tx, tz) or world.screenAt(x, z) rather
// than by dividing by these.

export const SCREEN_W = 16; // tiles per default screen, west to east
export const SCREEN_H = 11; // tiles per default screen, north to south

export const R = 8; // terrain voxels along one tile edge
export const TV = 1 / R; // size of one terrain voxel in world units
export const GROUND_Y = TV; // top of the ground layer: feet, props and particles rest here

export const DEG = Math.PI / 180;
