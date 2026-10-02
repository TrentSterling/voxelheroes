import './fire.js';
import { defineTileset, registerTile, getTile } from '../tiles.js';
import { fineFloor, buildWall } from './dungeon.js';

defineTileset('brineglass', { parent: 'dungeon', floor: '.' });
for (const [ch, name] of [['e', 'salt-stone'], ['a', 'sea-glass'], ['j', 'wet-grate'], ['u', 'heat-pipe'], ['o', 'shell-mosaic'], ['p', 'broken-ceramic']]) {
  registerTile('brineglass', ch, { name: `brineglass-${name}`, pushableFloor: true, build(ctx) {
    fineFloor(ctx); const { F, FX0: x, FZ0: z } = ctx;
    if (ch === 'e') F.box(x + 1, 1, z + 1, x + 16, 2, z + 16, (X, Y, Z) => (Math.floor((X - x) / 6) + Math.floor((Z - z) / 5)) % 2 ? 0x89aeb2 : 0xb0c8bf);
    if (ch === 'a') { F.box(x + 1, 1, z + 1, x + 15, 2, z + 15, 0x427d97); for (const i of [3, 7, 11]) F.box(x + i, 1, z + 2, x + i + 2, 2, z + 14, 0x77c5c9); }
    if (ch === 'j') { F.box(x + 1, 1, z + 1, x + 15, 2, z + 15, 0x354f65); for (let i = 2; i < 15; i += 3) F.box(x + 1, 2, z + i, x + 15, 3, z + i + 1, 0x83a9b1); }
    if (ch === 'u') { F.box(x + 5, 1, z, x + 11, 2, z + 16, 0x3c647c); for (const i of [5, 10]) F.box(x + i, 2, z, x + i + 1, 3, z + 16, 0xd89965); }
    if (ch === 'o') for (let i = 1; i < 15; i++) for (let k = 1; k < 15; k++) if (Math.abs(Math.hypot(i - 7.5, k - 10) - 6) < .8 || k > 7 && (i + k) % 5 === 0) F.set(x + i, 1, z + k, 0xe7cf9b);
    if (ch === 'p') for (let i = 1; i < 15; i++) F.box(x + i, 1, z + 3 + Math.floor(i / 3), x + i + 1, 2, z + 5 + Math.floor(i / 3), 0x384f65);
  } });
}
registerTile('brineglass', 'W', { ...getTile('dungeon', 'W'), name: 'brineglass-lantern-wall', detailHeight: 34, build(ctx) {
  buildWall(ctx);
  if (ctx.z === 0 && ctx.x % 3 === 1) {
    const { D, FX0: x, FZ0: z } = ctx;
    D.box(x + 4, 4, z + 12, x + 12, 30, z + 16, 0x5492a7); D.box(x + 2, 13, z + 12, x + 14, 16, z + 16, 0xd8ac75);
  }
} });
