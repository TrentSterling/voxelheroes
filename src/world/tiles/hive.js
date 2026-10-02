import './d1.js';
import { defineTileset, registerTile, getTile } from '../tiles.js';
import { fineFloor, buildWall } from './dungeon.js';
import { FPT } from '../terrain.js';
import { modelProp } from '../tilekit.js';
import { nurseryValveModel } from '../../models/hive-pressure.js';
import { entities } from '../../entities/manager.js';

defineTileset('hive', { parent: 'dungeon', floor: '.' });
for (const [ch, name] of [['e', 'root-cobble'], ['a', 'amber-glass'], ['j', 'nursery-grate'], ['u', 'irrigation-channel'], ['o', 'leaf-mosaic'], ['p', 'root-cracked-floor'], ['+', 'petal-stone'], ['=', 'seed-rail']]) {
  registerTile('hive', ch, { name: `hive-${name}`, pushableFloor: true, build(ctx) {
    fineFloor(ctx); const { F, FX0: x, FZ0: z } = ctx;
    if (ch === 'e') F.box(x + 1, 1, z + 1, x + FPT, 2, z + FPT, (X, Y, Z) => (Math.floor((X - x) / 4) + Math.floor((Z - z) / 5)) % 2 ? 0x536f58 : 0x758869);
    if (ch === 'a') { F.box(x + 2, 1, z + 2, x + 14, 2, z + 14, 0x947649); for (let i = 3; i < 14; i += 4) F.box(x + i, 1, z + 2, x + i + 1, 2, z + 14, 0xe0b96d); }
    if (ch === 'j') { F.box(x + 1, 1, z + 1, x + 15, 2, z + 15, 0x314c49); for (let i = 2; i < 15; i += 3) F.box(x + 1, 2, z + i, x + 15, 3, z + i + 1, 0x9da886); }
    if (ch === 'u') { F.box(x + 5, 1, z, x + 11, 2, z + 16, 0x355550); F.box(x + 5, 2, z, x + 6, 3, z + 16, 0xbf9360); F.box(x + 10, 2, z, x + 11, 3, z + 16, 0xbf9360); for (let i = 1; i < 16; i += 4) F.box(x + 6, 2, z + i, x + 10, 3, z + i + 1, 0x79c2a0); }
    if (ch === 'o') for (let i = 2; i < 14; i++) for (let k = 2; k < 14; k++) if (Math.abs(i - 7.5) + Math.abs(k - 7.5) < 6) F.set(x + i, 1, z + k, i < 8 ? 0xcbb977 : 0x8ab994);
    if (ch === 'p') for (let i = 1; i < 15; i++) F.box(x + i, 1, z + 3 + Math.floor(i / 3), x + i + 1, 3, z + 5 + Math.floor(i / 3), 0x665f45);
    if (ch === '+') {
      F.box(x + 1, 1, z + 1, x + 15, 2, z + 15, 0x3f685e);
      for (let i = 2; i < 14; i++) for (let k = 2; k < 14; k++) {
        const dx = i - 7.5, dz = k - 7.5;
        if (Math.abs(dx * dz) < 5 && dx * dx + dz * dz < 33) F.set(x + i, 2, z + k, 0xd9d4a4);
      }
      F.box(x + 6, 2, z + 6, x + 10, 3, z + 10, 0xcf9b5c);
    }
    if (ch === '=') {
      F.box(x + 1, 1, z + 1, x + 15, 2, z + 15, 0x687967);
      for (const i of [3, 12]) F.box(x + i, 2, z, x + i + 1, 3, z + 16, 0xd4af70);
      for (const i of [2, 8, 14]) F.box(x + 4, 2, z + i, x + 12, 3, z + i + 1, 0x9ec69e);
    }
  } });
}
registerTile('hive', 'm', { name: 'hive-root-pillar', solid: true, blocksShots: true, detailHeight: 24, build(ctx) {
  fineFloor(ctx); const { FX0: x, FZ0: z, D } = ctx;
  D.box(x + 4, 1, z + 4, x + 12, 20, z + 12, 0x6d6147); D.box(x + 2, 1, z + 3, x + 14, 5, z + 13, 0x4e6650);
  D.box(x + 3, 15, z + 3, x + 13, 22, z + 13, 0x779b72); D.box(x + 6, 18, z + 6, x + 10, 24, z + 10, 0xa6c391);
} });
registerTile('hive', 'W', { ...getTile('dungeon', 'W'), name: 'hive-root-wall', detailHeight: 34, build(ctx) {
  buildWall(ctx);
  if (ctx.z === 0 && ctx.x % 3 === 1) { const { FX0: x, FZ0: z, D } = ctx; D.box(x + 5, 1, z + 12, x + 10, 32, z + 16, 0x76654a); D.box(x + 3, 11, z + 12, x + 12, 15, z + 16, 0x9e9363); }
} });
for (let i = 0; i < 3; i++) registerTile('hive', String(i + 1), {
  name: `hive-pressure-seal-${i + 1}`, solid: true, blocksShots: true, build: fineFloor, prop: modelProp(() => nurseryValveModel(false)),
  onBomb(ctx) { return entities.find(e => !e.removed && e.type === 'hive-pressure' && e.homeKey === ctx.screen.key)?.release(i) ?? false; },
});
registerTile('hive', 'd', { name: 'hive-open-valve', build: fineFloor, prop: modelProp(() => nurseryValveModel(true)) });
