// Dungeon tiles (the Cairn Crypt). Each tile sits on a dark underlayer; most
// have a flagstone floor with grout lines.
//   .  floor       W  wall         S  stone pillar   F  brazier (flame)
//   ~  dark water  X  stairs out (warp)
//   L  locked door (walk into it with a small key)   C  chest (walk into it)
import { R, SCREEN_H } from '../../core/constants.js';
import { enterWarp } from '../../systems/transitions.js';
import { defineTileset, registerTile } from '../tiles.js';
import { C } from '../palette.js';
import { doorProp, chestProp, flameProp, unlockDoor, openChest } from '../tilekit.js';

defineTileset('dungeon', { floor: '.' });

export function underlayer(ctx) {
  const { g, bx, bz } = ctx;
  g.box(bx, bx + R - 1, -2, -1, bz, bz + R - 1, C.under, 0.08);
}

// Stone floor with grout lines between tiles.
export function flagstones(ctx) {
  const { g, bx, bz, x, z } = ctx;
  for (let vx = 0; vx < R; vx++)
    for (let vz = 0; vz < R; vz++) {
      const grout = vx === 0 || vz === 0;
      g.set(bx + vx, 0, bz + vz, grout ? C.grout : (x + z) % 2 ? C.floorA : C.floorB, grout ? 0.05 : 0.07);
    }
}

export function floor(ctx) {
  underlayer(ctx);
  flagstones(ctx);
}

registerTile('dungeon', '.', {
  name: 'floor',
  build(ctx) {
    floor(ctx);
    const { g, bx, bz, rand } = ctx;
    if (rand() < 0.08) g.set(bx + 1 + Math.floor(rand() * 6), 0, bz + 1 + Math.floor(rand() * 6), C.grout, 0.05);
  },
});

registerTile('dungeon', 'W', {
  name: 'wall',
  solid: true,
  build(ctx) {
    underlayer(ctx);
    const { g, bx, bz, z } = ctx;
    // Walls along the bottom edge stay low so they never hide the hero.
    const h = z === SCREEN_H - 1 ? 3 : 10;
    for (let vx = 0; vx < R; vx++)
      for (let vz = 0; vz < R; vz++)
        for (let y = 0; y <= h; y++) {
          const course = Math.floor(y / 3);
          const brick = Math.floor((vx + bx + vz + bz + (course % 2) * 2) / 4) % 2;
          const c = y === h ? C.wallTop : y % 3 === 0 ? C.mortar : brick ? C.brickA : C.brickB;
          g.set(bx + vx, y, bz + vz, c, 0.08);
        }
  },
});

registerTile('dungeon', '~', {
  name: 'dark-water',
  solid: true,
  blocksShots: false,
  build(ctx) {
    const { g, bx, bz } = ctx;
    g.box(bx, bx + R - 1, -2, -2, bz, bz + R - 1, C.darkBed, 0.1);
    ctx.layer('water').box(bx, bx + R - 1, -1, -1, bz, bz + R - 1, C.darkWater, 0.06);
  },
});

registerTile('dungeon', 'S', {
  name: 'pillar',
  solid: true,
  build(ctx) {
    floor(ctx);
    const { g, bx, bz } = ctx;
    g.box(bx + 2, bx + 5, 1, 8, bz + 2, bz + 5, C.pillar, 0.08);
    g.box(bx + 1, bx + 6, 9, 9, bz + 1, bz + 6, C.pillarLight, 0.06);
    g.box(bx + 1, bx + 6, 1, 1, bz + 1, bz + 6, C.pillarLight, 0.06);
  },
});

registerTile('dungeon', 'F', {
  name: 'brazier',
  solid: true,
  build(ctx) {
    floor(ctx);
    const { g, bx, bz } = ctx;
    g.box(bx + 2, bx + 5, 1, 3, bz + 2, bz + 5, C.pillar, 0.08);
    g.box(bx + 1, bx + 6, 4, 4, bz + 1, bz + 6, C.iron, 0.08);
  },
  prop: flameProp,
});

registerTile('dungeon', 'X', {
  name: 'stairs-out',
  onEnter: enterWarp,
  build(ctx) {
    floor(ctx);
    const { g, bx, bz } = ctx;
    g.box(bx + 1, bx + 6, 1, 1, bz + 1, bz + 6, C.stair, 0.05);
    g.box(bx + 1, bx + 6, 2, 2, bz + 1, bz + 4, C.stair, 0.05);
    g.box(bx + 1, bx + 6, 3, 3, bz + 1, bz + 2, C.pillarLight, 0.05);
  },
});

registerTile('dungeon', 'L', {
  name: 'locked-door',
  solid: true,
  becomes: '.',
  build: floor,
  prop: doorProp,
  onPush: unlockDoor,
});

registerTile('dungeon', 'C', {
  name: 'chest',
  solid: true,
  build: floor,
  prop: chestProp,
  onPush: openChest,
});
