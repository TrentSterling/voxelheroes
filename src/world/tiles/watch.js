import './d1.js';
import { defineTileset, registerTile, getTile } from '../tiles.js';
import { fineFloor, buildWall } from './dungeon.js';

defineTileset('watch', { parent: 'dungeon', floor: '.' });
for (const [ch, name] of [['e', 'salt-flagstone'], ['a', 'blue-mosaic'], ['j', 'sand-grate'], ['f', 'meridian-rail'], ['o', 'clock-face'], ['p', 'cracked-sandstone']]) {
  registerTile('watch', ch, { name: `watch-${name}`, pushableFloor: true, build(ctx) {
    fineFloor(ctx); const { F, FX0: x, FZ0: z } = ctx;
    if (ch === 'e') F.box(x + 1, 1, z + 1, x + 16, 2, z + 16, (X, Y, Z) => (Math.floor((X - x) / 7) + Math.floor((Z - z) / 5)) % 2 ? 0x93826d : 0xb29a7b);
    if (ch === 'a') for (let i = 2; i < 15; i += 4) for (let k = 2; k < 15; k += 4) F.box(x + i, 1, z + k, x + i + 2, 2, z + k + 2, (i + k) % 8 ? 0x48889c : 0xbad1c4);
    if (ch === 'j') { F.box(x + 1, 1, z + 1, x + 15, 2, z + 15, 0x4b575c); for (let i = 2; i < 15; i += 3) F.box(x + 1, 2, z + i, x + 15, 3, z + i + 1, 0xb89a72); }
    if (ch === 'f') { F.box(x + 5, 1, z, x + 11, 2, z + 16, 0x345e73); for (const i of [5, 10]) F.box(x + i, 2, z, x + i + 1, 3, z + 16, 0xebc17b); }
    if (ch === 'o') for (let i = 1; i < 15; i++) for (let k = 1; k < 15; k++) { const d = Math.hypot(i - 7.5, k - 7.5); if (d > 4.8 && d < 6.7 || i === 7 && k < 9 || k === 8 && i > 7) F.set(x + i, 1, z + k, 0xe5ba71); }
    if (ch === 'p') for (let i = 1; i < 15; i++) F.box(x + i, 1, z + 3 + Math.floor(i / 3), x + i + 1, 2, z + 5 + Math.floor(i / 3), 0x4e595e);
  } });
}
registerTile('watch', 'W', { ...getTile('dungeon', 'W'), name: 'watch-observatory-wall', detailHeight: 34, build(ctx) {
  buildWall(ctx);
  if (ctx.z === 0 && ctx.x % 3 === 1) {
    const { D, FX0: x, FZ0: z } = ctx;
    D.box(x + 4, 1, z + 12, x + 12, 32, z + 16, 0x42687b); D.box(x + 2, 13, z + 12, x + 14, 16, z + 16, 0xd8b271);
  }
} });
