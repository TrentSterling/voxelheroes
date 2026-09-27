// Overworld tiles. Each tile is 8 x 8 terrain voxels: two layers of dirt with
// a top layer of grass, path or sand, plus whatever stands on it.
//   .  grass       ,  flowers      p  dirt path    s  sand
//   T  tree        R  boulder      #  cliff        ~  water
//   B  bush (cut it with the sword; grows back)
//   D  cave doorway in a cliff face (warp, destination in the area's warps)
import { R } from '../../core/constants.js';
import { enterWarp } from '../../systems/transitions.js';
import { defineTileset, registerTile } from '../tiles.js';
import { C } from '../palette.js';
import { bushProp, cutPlant } from '../tilekit.js';

defineTileset('overworld', { floor: '.' });

const checker = (ctx) => ((ctx.x + ctx.z) % 2 ? C.grassA : C.grassB);

// Dirt with a top layer: grass by default.
export function ground(ctx, top = checker(ctx), jitter = 0.06) {
  const { g, bx, bz } = ctx;
  g.box(bx, bx + R - 1, -2, -1, bz, bz + R - 1, C.dirt, 0.08);
  g.box(bx, bx + R - 1, 0, 0, bz, bz + R - 1, top, jitter);
}

registerTile('overworld', '.', {
  name: 'grass',
  build(ctx) {
    ground(ctx);
    const { g, bx, bz, rand } = ctx;
    if (rand() < 0.35) {
      // a few tufts of grass
      for (let i = 0; i < 3; i++) {
        const gx = bx + Math.floor(rand() * R);
        const gz = bz + Math.floor(rand() * R);
        g.set(gx, 1, gz, C.grassDark);
      }
    }
  },
});

registerTile('overworld', ',', {
  name: 'flowers',
  build(ctx) {
    ground(ctx);
    const { g, bx, bz, rand, pick } = ctx;
    for (let i = 0; i < 5; i++) {
      const fx = bx + 1 + Math.floor(rand() * (R - 2));
      const fz = bz + 1 + Math.floor(rand() * (R - 2));
      g.set(fx, 1, fz, C.grassDark);
      g.set(fx, 2, fz, pick(C.flowers), 0.03);
    }
  },
});

registerTile('overworld', 'p', {
  name: 'path',
  build: (ctx) => ground(ctx, C.path, 0.08),
});

registerTile('overworld', 's', {
  name: 'sand',
  build: (ctx) => ground(ctx, C.sand, 0.08),
});

registerTile('overworld', 'T', {
  name: 'tree',
  solid: true,
  build(ctx) {
    ground(ctx);
    const { g, bx, bz, rand } = ctx;
    const cx = bx + 3.5;
    const cz = bz + 3.5;
    g.box(bx + 3, bx + 4, 1, 5, bz + 3, bz + 4, C.trunk);
    const ry = 3 + rand() * 0.8;
    const rr = 4.3 + rand() * 0.6;
    g.ellipsoid(cx, 7.5, cz, rr, ry, rr, (vx, vy, vz) => {
      if (vy > 8 && vx - cx + vz - cz < 0) return C.leafLight;
      if (vy < 6) return C.leafDark;
      return rand() < 0.1 ? C.leafLight : C.leaf;
    });
  },
});

registerTile('overworld', 'R', {
  name: 'boulder',
  solid: true,
  build(ctx) {
    ground(ctx);
    const { g, bx, bz, rand } = ctx;
    const cx = bx + 3.5;
    const cz = bz + 3.5;
    g.ellipsoid(cx, 1, cz, 3.8, 4.2, 3.6, (vx, vy) => {
      if (vy < 1) return null;
      if (vy >= 4 && rand() < 0.35) return C.moss;
      return vy >= 3 ? C.rockLight : C.rock;
    }, 0.1);
  },
});

registerTile('overworld', '#', {
  name: 'cliff',
  solid: true,
  build(ctx) {
    ground(ctx);
    const { g, bx, bz } = ctx;
    for (let y = 1; y <= 8; y++)
      g.box(bx, bx + R - 1, y, y, bz, bz + R - 1, Math.floor(y / 2) % 2 ? C.cliffA : C.cliffB, 0.09);
    g.box(bx, bx + R - 1, 9, 9, bz, bz + R - 1, checker(ctx));
  },
});

registerTile('overworld', '~', {
  name: 'water',
  solid: true,
  blocksShots: false,
  build(ctx) {
    const { g, bx, bz } = ctx;
    g.box(bx, bx + R - 1, -2, -2, bz, bz + R - 1, C.bed, 0.1);
    ctx.layer('water').box(bx, bx + R - 1, -1, -1, bz, bz + R - 1, C.water, 0.05);
  },
});

registerTile('overworld', 'B', {
  name: 'bush',
  solid: true,
  regrow: true,
  becomes: '.',
  build: (ctx) => ground(ctx),
  prop: bushProp,
  onSword: (ctx) => cutPlant(ctx, [0x3c9440, 0x57b152, 0x2f7a33, 0xd8334a]),
});

// A cliff with a dark doorway carved into its south face. Neighbouring 'D'
// tiles join into one wide doorway.
registerTile('overworld', 'D', {
  name: 'cave-door',
  onEnter: enterWarp,
  build(ctx) {
    ground(ctx);
    const { g, bx, bz, x, tileAt } = ctx;
    const grass = checker(ctx);
    for (let vx = 0; vx < R; vx++)
      for (let vz = 0; vz < R; vz++)
        for (let y = 1; y <= 9; y++) {
          const edge = (x > 0 && tileAt(-1, 0) !== 'D' && vx === 0) || (tileAt(1, 0) !== 'D' && vx === R - 1);
          const carved = !edge && y <= 6 && vz >= 1;
          if (carved) continue;
          const c = y === 9 ? grass : y === 7 && vz === R - 1 ? C.stair : Math.floor(y / 2) % 2 ? C.cliffA : C.cliffB;
          g.set(bx + vx, y, bz + vz, c, 0.09);
        }
    g.box(bx, bx + R - 1, 0, 0, bz, bz + R - 1, C.void, 0.1);
  },
});
