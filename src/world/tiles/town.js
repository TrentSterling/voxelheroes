// The town tileset (overworld stream): the overworld kit plus buildings, at
// terrain resolution (1/8 tile blocks). Villages and the castle grounds use it.
//   H  house wall under a gabled roof: a block of H tiles is one house; the
//      roof rises from each eave (a tile with no house to its north or south)
//   h  the house's front door (an H on the south row with a door in it)
//   M  castle wall, two levels of dressed stone with a crenellated top
//   m  castle gate: the wall with an arch you walk through
import { hash3, shadeHex } from '../../core/vox.js';
import { defineTileset, registerTile } from '../tiles.js';
import { land } from './overworld.js';

defineTileset('town', { parent: 'overworld', floor: '.' });

// Native paving keeps the road, village lane and royal audience distinct.
// These are ordinary walkable floors, without interaction or collision hooks.
for (const [ch, name] of [[':', 'limestone-paving'], [';', 'riverstone-cobbles'], ['a', 'royal-runner'], ['o', 'four-hour-mosaic']]) {
  registerTile('town', ch, { name, ground: 'path', pushableFloor: true, build(ctx) {
    const top = land(ctx, {kind:'path'}), {T,X0:x,Z0:z} = ctx;
    for (let dz=0;dz<8;dz++) for (let dx=0;dx<8;dx++) {
      let color;
      if (ch === ':') {
        const joint = dz%4===0 || (dx+(Math.floor(dz/4)%2)*2)%4===0;
        color = joint ? 0x787d82 : (Math.floor((dx+dz)/4)%2 ? 0xc5c8b5 : 0xb6bda8);
      } else if (ch === ';') {
        const joint = dz%3===0 || (dx+(Math.floor(dz/3)%2))%3===0;
        color = joint ? 0x78847c : (Math.floor(dx/3)+Math.floor(dz/3))%2 ? 0xb2b9a2 : 0x9eaa97;
      } else if (ch === 'a') {
        const edge = (ctx.tileAt(-1,0)!=='a' && dx<2) || (ctx.tileAt(1,0)!=='a' && dx>5);
        color = edge ? 0xdbaf69 : (dx+dz)%7===0 ? 0xba5663 : 0x853e54;
      } else {
        const ax=Math.abs(dx-3.5), az=Math.abs(dz-3.5), diamond=ax+az;
        color = diamond>5 ? 0xbac2ad : diamond>3.5 || diamond<1.5 ? 0xd9ae62
          : dx<4 ? (dz<4 ? 0x72a99b : 0xbc6373) : (dz<4 ? 0x7585b3 : 0xc9a46f);
      }
      T.set(x+dx,top,z+dz,shadeHex(color,1+(hash3(x+dx,top,z+dz,37)-.5)*.025));
    }
  } });
}

const PLASTER = 0xe6d8b8;
const TIMBER = 0x7a5230;
const BASE = 0x8e8a80;
const ROOF = 0xb0493a;
const ROOF_DARK = 0x8a3a30;
const GLASS = 0x2a3a4a;
const DOOR = 0x5e371b;
const STONE = 0xb4b0a6;
const STONE_DARK = 0x8e8a82;

const WALL_TOP = 12; // blocks of wall above the ground

function house(ctx, door) {
  const palette=ctx.owner?.area?.housePalette ?? {};
  const roof=palette.roof ?? ROOF, roofDark=palette.roofDark ?? ROOF_DARK;
  const plaster=palette.plaster ?? PLASTER, timber=palette.timber ?? TIMBER;
  const top = land(ctx, { kind: 'dirt' });
  const { T, X0, Z0 } = ctx;
  const isH = (dx, dz) => ['H', 'h'].includes(ctx.tileAt(dx, dz));
  const west = !isH(-1, 0);
  const east = !isH(1, 0);
  const north = !isH(0, -1);
  const south = !isH(0, 1);
  const y0 = top + 1;
  // walls (the tile's whole footprint: a house is solid)
  T.box(X0, y0, Z0, X0 + 8, y0 + WALL_TOP, Z0 + 8, (X, Y, Z) => {
    const h = Y - y0;
    if (h < 2) return BASE;
    const edgeX = (west && X === X0) || (east && X === X0 + 7);
    const edgeZ = (south && Z === Z0 + 7) || (north && Z === Z0);
    if (h === WALL_TOP - 1 || h === 2 || (edgeX && (edgeZ || Z === Z0 || Z === Z0 + 7)) || (edgeX && edgeZ)) return timber;
    return shadeHex(plaster, 1 + (hash3(X, Y, Z, 3) - 0.5) * 0.04);
  });
  // a window or the door on the front face
  if (south) {
    const Z = Z0 + 7;
    if (door) {
      T.box(X0 + 2, y0, Z, X0 + 6, y0 + 7, Z + 1, DOOR);
      T.box(X0 + 1, y0 + 7, Z, X0 + 7, y0 + 8, Z + 1, timber);
      T.set(X0 + 5, y0 + 3, Z, 0xe6b43a);
    } else {
      T.box(X0 + 2, y0 + 4, Z, X0 + 6, y0 + 8, Z + 1, GLASS);
      T.box(X0 + 2, y0 + 6, Z, X0 + 6, y0 + 7, Z + 1, timber);
      T.box(X0 + 1, y0 + 3, Z, X0 + 7, y0 + 4, Z + 1, timber);
    }
  }
  // the roof: rises from the eaves, one block up per block in
  const ry = y0 + WALL_TOP;
  for (let k = 0; k < 8; k++) {
    const Z = Z0 + k;
    const rise = Math.min(north ? k : 9, south ? 7 - k : 9, 7);
    for (let X = X0; X < X0 + 8; X++) {
      const c = (Z + (rise % 2)) % 2 ? roof : roofDark;
      T.box(X, ry, Z, X + 1, ry + rise + 1, Z + 1, (x, Y) => (Y === ry + rise ? c : shadeHex(roofDark, 0.8)));
    }
  }
}

registerTile('town', 'H', { name: 'house', solid: true, ground: 'dirt', height: WALL_TOP + 10, build: (ctx) => house(ctx, false) });
registerTile('town', 'h', { name: 'house-door', solid: true, ground: 'dirt', height: WALL_TOP + 10, build: (ctx) => house(ctx, true) });

// Castle walls: dressed stone courses with a crenellated top.
const CASTLE_H = 16;
function castleWall(ctx, gate) {
  const top = land(ctx, { kind: 'path' });
  const { T, X0, Z0 } = ctx;
  const y0 = top + 1;
  T.box(X0, y0, Z0, X0 + 8, y0 + CASTLE_H + 2, Z0 + 8, (X, Y, Z) => {
    const h = Y - y0;
    if (h >= CASTLE_H) return ((X >> 1) + (Z >> 1)) % 2 ? STONE : null; // merlons
    if (gate && h < 11) {
      const ax = Math.abs(X - X0 - 3.5);
      if (ax < 3 || (h < 10 && ax < 3.5)) return null; // the arch
    }
    const course = h >> 1;
    const joint = (X + Z + (course % 2) * 2) % 4 === 0 || h % 2 === 1;
    return joint ? STONE_DARK : shadeHex(STONE, 1 + (hash3(X, Y, Z, 5) - 0.5) * 0.05);
  });
}
registerTile('town', 'M', { name: 'castle-wall', solid: true, ground: 'path', height: CASTLE_H + 3, build: (ctx) => castleWall(ctx, false) });
registerTile('town', 'm', { name: 'castle-gate', ground: 'path', height: CASTLE_H + 3, build: (ctx) => castleWall(ctx, true) });
