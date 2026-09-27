// Dungeon tiles, built with the dungeon kit (art bible section 9): the golden temple.
//   .  floor           W  wall (its look depends on where it stands in its room, see below)
//   S  statue on a plinth           F  brazier with a flame
//   ~  dark water      X  stairs out (warp)      O  pit
//   L  locked door (walk into it with a small key)   C  chest (walk into it)
//   _  pressure plate, X mark       =  pressure plate, ring mark
//   P  push block (solid for now)   *  spike ball (solid for now)
//
// Walls are 2 tiles (16 blocks of 1/8) tall: from the floor up a darker base course, a band of
// long slabs with one bed line, a teal trim, tall panels split by grooves every 8 blocks, a second
// trim, an upper tier set back one block, and a lit ledge 5 blocks deep, then black. A W tile
// takes its look from its place in the room that owns it:
//   row 0            north wall, inner face on the grid line between rows 0 and 1; lamps (sconces
//                    with a glow strip and a warm point light) at +-4.4 tiles from the room centre
//   last row         south wall, 1 tile tall, pure black and unlit (a room with `southWall: false`
//                    shows floor there instead)
//   first/last col   side walls; in room areas (area.rooms) drawn half a tile inward, so the
//                    visible floor is 13 tiles wide
//   anywhere else    a full block of wall
// Doorways are gaps in a wall (two tiles wide, full height). In room areas each room is drawn with a
// ring of tiles outside it (terrain.js registerRing): a corridor with its own side walls running
// CORRIDOR tiles north from a north doorway (to the top of the frame), one tile of floor running out
// of the other doorways, the stairs going on down, black elsewhere. The ring is hidden during slides.
// Floors are fine (16 voxels per tile) rounded-square tiles: grout, a lighter ring, a darker centre.
import * as THREE from 'three';
import * as renderer from '../../core/renderer.js';
import { GROUND_Y } from '../../core/constants.js';
import { hash3, shadeHex } from '../../core/vox.js';
import { makeGlowMaterial } from '../../core/materials.js';
import { on } from '../../core/events.js';
import { enterWarp } from '../../systems/transitions.js';
import { defineTileset, registerTile, getTile } from '../tiles.js';
import { GOLD } from '../palette.js';
import { BPT, FPT, registerRing, registerLayer, screenBox } from '../terrain.js';
import { doorProp, chestProp, flameProp, spikeBallProp, pushBlockProp, unlockDoor, openChest } from '../tilekit.js';
import { statue, brazier } from '../../models/props.js';

defineTileset('dungeon', { floor: '.' });

const WALL = 2 * BPT; // blocks: north and side walls are 2 tiles tall
const SOUTH = BPT; // the south wall is 1 tile tall
const LEDGE = 5; // blocks of lit ledge on top of a wall, then black
export const LAMP_OFFSET = 4.4; // tiles from the room centre
export const LAMP_BLOCK = 10; // block row of the sconce (its bottom 1.125 tiles above the floor)

// ---------------------------------------------------------------- floor
// Fine floor colour at global fine voxel (X, Z): 1-voxel grout on the tile's north and west edges,
// a lighter ring 3 voxels in with its corners knocked off, a darker centre, +-2% per 2 x 2 voxels.
const mod16 = (v) => ((v % FPT) + FPT) % FPT;
export function floorColor(X, Z) {
  const lx = mod16(X);
  const lz = mod16(Z);
  if (lx === 0 || lz === 0) return GOLD.grout;
  const inR = (a) => a >= 3 && a <= 13;
  const edge = (a) => a === 3 || a === 13;
  const ring = ((edge(lx) && inR(lz)) || (edge(lz) && inR(lx))) && !(edge(lx) && edge(lz));
  const cornerIn = (lx === 4 || lx === 12) && (lz === 4 || lz === 12);
  return shadeHex(ring || cornerIn ? GOLD.floorRing : GOLD.floor, 1 + (hash3(X >> 1, 0, Z >> 1, 3) - 0.5) * 0.04);
}

// The fine floor over rows za..zb (fine voxels, 0-16) of the tile: the top layer and one under it.
export function fineFloor(ctx, za = 0, zb = FPT) {
  const { F, FX0, FZ0 } = ctx;
  F.box(FX0, 0, FZ0 + za, FX0 + FPT, 1, FZ0 + zb, (X, Y, Z) => floorColor(X, Z));
  F.box(FX0, -1, FZ0 + za, FX0 + FPT, 0, FZ0 + zb, GOLD.floorUnder);
}

// ---------------------------------------------------------------- walls
// Wall face colour by height h (blocks above the floor, 0-15), position along the wall and depth
// behind its inner face (the lab's wall pattern, art bible section 9).
export function wallColor(along, h, depth = 0) {
  if (h === WALL - 1) return depth < LEDGE ? GOLD.ledge : GOLD.south;
  if (h === 6 || h === 12) return GOLD.trim;
  if (h < 2) return GOLD.wallDark;
  const a = ((along % 8) + 8) % 8;
  const zone = h < 6 ? 0 : h < 12 ? 1 : 2;
  const g = zone === 0 ? (a + 4) % 8 : a; // the lower slabs are offset half a panel
  if (g === 0 || (zone === 0 && h === 3)) return GOLD.mortar;
  const v = 1 + (hash3(Math.floor((along + (zone === 0 ? 4 : 0)) / 8), zone, 0, 9) - 0.5) * 0.1;
  return shadeHex(GOLD.wall, g === 1 ? v * 1.07 : v); // a lighter left column bevels each panel
}

const setBack = (h, depth) => (h === 13 || h === 14) && depth === 0;

// Wall blocks over [xa, xb) x [za, zb) (blocks), rows 1..WALL. along(X, Z) and depth(X, Z) pick the
// pattern; setback removes the front row of the upper tier.
function wallBox(ctx, xa, za, xb, zb, along, depth, setback = true) {
  ctx.T.box(xa, 1, za, xb, 1 + WALL, zb, (X, Y, Z) => {
    const h = Y - 1;
    const d = depth(X, Z);
    if (setback && setBack(h, d)) return null;
    return wallColor(along(X, Z), h, d);
  });
}

// North-wall style block (panels along x, inner face on the tile's south edge).
function northWall(ctx, xa, xb) {
  const zin = ctx.Z0 + BPT - 1;
  wallBox(ctx, xa, ctx.Z0, xb, ctx.Z0 + BPT, (X) => X, (X, Z) => zin - Z);
}

// Side wall (panels along z). west: inner face toward +x.
function sideWall(ctx, west, inset, za = ctx.Z0, zb = ctx.Z0 + BPT) {
  const xa = west ? ctx.X0 + inset : ctx.X0 - inset;
  const xb = xa + BPT;
  const xin = west ? xb - 1 : xa;
  wallBox(ctx, xa, za, xb, zb, (X, Z) => Z, (X) => Math.abs(X - xin));
}

// South wall: a band one tile tall over [xa, xb), pure black. It is unlit (as the lab draws it), so
// it goes into a layer of its own with an unlit black material and casts no shadow.
registerLayer('unlit-black', { material: makeGlowMaterial(0x000000, 1), castShadow: false, receiveShadow: false });

function southWall(ctx, xa, xb) {
  ctx.voxelLayer('unlit-black').box(xa, 1, ctx.Z0, xb, 1 + SOUTH, ctx.Z0 + BPT, GOLD.south);
}

// Where the tile stands in the room that owns it (null for tiles outside every screen).
function roomPos(ctx) {
  const s = ctx.owner;
  if (!s) return null;
  const b = s._box ?? (s._box = screenBox(s));
  return {
    lx: ctx.tx - b.x0,
    lz: ctx.tz - b.z0,
    w: b.w,
    h: b.h,
    box: b,
    inset: s.area?.rooms ? BPT / 2 : 0,
    southWall: s.def?.southWall !== false,
  };
}

// A wall lamp on a north wall tile: a two-block dark sconce standing one block out of the wall, a
// small glowing strip on it and a warm point light (the look's lamp when the renderer provides
// makeLampLight, else the fallback values below). One per lamp position inside the tile.
const LAMP_FALLBACK = { color: GOLD.lamp, intensity: 4.5, distance: 8, decay: 1.5 };
const LAMP_FACTORY = 'makeLampLight'; // looked up at run time: renderers without it get the fallback
let stripGeo = null;
let stripMat = null;

// Fallback lights burn only in the room the hero is in: every lit material pays for every visible
// point light, wherever it is. (A renderer with makeLampLight culls its own lamps.)
const fallbackLamps = new Set(); // { light, screen }
let litScreen = null;
on('screen-enter', (e) => {
  litScreen = e?.screen ?? null;
  for (const l of fallbackLamps) {
    if (l.light.parent && !l.light.parent.parent) fallbackLamps.delete(l); // its screen was rebuilt
    else l.light.visible = l.screen === litScreen;
  }
});

function lampFixture(x, zFace, screen) {
  const group = new THREE.Group();
  group.name = 'lamp';
  if (!stripGeo) {
    stripGeo = new THREE.BoxGeometry(0.2, 0.05, 0.06);
    const n = stripGeo.attributes.position.count;
    stripGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3));
    stripMat = makeGlowMaterial(GOLD.lamp, 1.6);
  }
  const strip = new THREE.Mesh(stripGeo, stripMat);
  strip.userData.sharedGeometry = true;
  strip.position.set(x, GROUND_Y + 1.2875, zFace + 0.12);
  group.add(strip);
  // the fixture point: 0.3 tiles out from the wall, just above the strip (lab dungeon room)
  const factory = renderer[LAMP_FACTORY];
  let light = typeof factory === 'function' ? factory() : null;
  if (!light) {
    const L = LAMP_FALLBACK;
    light = new THREE.PointLight(L.color, L.intensity, L.distance, L.decay);
    light.name = 'lamp-light';
    light.visible = screen === litScreen;
    fallbackLamps.add({ light, screen });
  }
  light.traverse((o) => {
    if (o.isLight) o.castShadow = false;
  });
  light.position.set(x, GROUND_Y + 1.3075, zFace + 0.3);
  group.add(light);
  return group;
}

function sconces(ctx, pos) {
  const cx = (pos.box.x0 + pos.w / 2) * BPT; // room centre, blocks
  for (const s of [-LAMP_OFFSET, LAMP_OFFSET]) {
    const X = Math.round(cx + s * BPT) - 1;
    if (X < ctx.X0 || X >= ctx.X0 + BPT) continue;
    const Z = ctx.Z0 + BPT; // one block out of the wall's inner face
    ctx.T.box(X, LAMP_BLOCK, Z, X + 2, LAMP_BLOCK + 1, Z + 1, GOLD.sconce);
    if (ctx.own) ctx.fixture(lampFixture((X + 1) / BPT, Z / BPT, ctx.owner));
  }
}

function buildWall(ctx) {
  const pos = roomPos(ctx);
  const { X0 } = ctx;
  if (!pos) return northWall(ctx, X0, X0 + BPT);
  const { lx, lz, w, h, inset } = pos;
  const west = lx === 0;
  const east = lx === w - 1;
  if (lz === 0) {
    northWall(ctx, west ? X0 + inset : X0, east ? X0 + BPT - inset : X0 + BPT);
    if (!west && !east) sconces(ctx, pos);
    return;
  }
  if (lz === h - 1) {
    if (pos.southWall) return southWall(ctx, west ? X0 + inset : X0, east ? X0 + BPT - inset : X0 + BPT);
    if (west || east) return sideWall(ctx, west, inset);
    return fineFloor(ctx);
  }
  if (west || east) return sideWall(ctx, west, inset);
  northWall(ctx, X0, X0 + BPT);
}

// ---------------------------------------------------------------- the ring around a room
// A tile is a doorway when the hero can pass it (or open it) in a room's wall.
const isDoorway = (def) => !!def && (!def.solid || !!def.doorway);

const RING_FLOOR = { name: 'ring-floor', build: (ctx) => fineFloor(ctx) };
const RING_STAIRS = {
  name: 'ring-stairs',
  build(ctx) {
    const { T, X0, Z0 } = ctx;
    T.box(X0, -3, Z0, X0 + BPT, -2, Z0 + 2, shadeHex(GOLD.stepDark, 0.8));
    T.box(X0, -4, Z0 + 2, X0 + BPT, -3, Z0 + 4, shadeHex(GOLD.stepDark, 0.6));
  },
};
// A corridor wall beside a north doorway: a full tile of wall, panels along z, facing the corridor.
const ringWall = (west) => ({
  name: 'ring-wall',
  build(ctx) {
    const { X0, Z0 } = ctx;
    const xin = west ? X0 + BPT - 1 : X0;
    wallBox(ctx, X0, Z0, X0 + BPT, Z0 + BPT, (X, Z) => Z, (X) => Math.abs(X - xin), false);
  },
});
const RING_WALL_W = ringWall(true);
const RING_WALL_E = ringWall(false);

const CORRIDOR = 5; // tiles of corridor drawn beyond a north doorway (to the top of the frame)

registerRing('dungeon', (room, tx, tz) => {
  const b = room._box;
  const lx = Math.min(Math.max(tx - b.x0, 0), b.w - 1);
  const lz = Math.min(Math.max(tz - b.z0, 0), b.h - 1);
  const outX = tx < b.x0 || tx >= b.x1;
  const outZ = tz < b.z0 || tz >= b.z1;
  if (outX && outZ) return null; // corners
  const at = (x, z) => (x >= 0 && x < b.w && z >= 0 && z < b.h ? getTile(room.tileset, room.tiles[z][x]) : null);
  const edge = at(lx, lz);
  const cell = (def) => ({ ch: '.', def, screen: null, room });
  if (outZ && tz < b.z0) {
    // north: the corridor beyond a north doorway, walled on both sides
    if (isDoorway(edge)) return cell(RING_FLOOR);
    if (isDoorway(at(lx + 1, 0))) return cell(RING_WALL_W);
    if (isDoorway(at(lx - 1, 0))) return cell(RING_WALL_E);
    return null;
  }
  if (!isDoorway(edge)) return null;
  if (outZ && edge.name === 'stairs-out') return cell(RING_STAIRS);
  return cell(RING_FLOOR);
}, { north: CORRIDOR });

// ---------------------------------------------------------------- tiles
registerTile('dungeon', '.', { name: 'floor', build: (ctx) => fineFloor(ctx) });

registerTile('dungeon', 'W', { name: 'wall', solid: true, height: WALL, build: buildWall });

registerTile('dungeon', '~', {
  name: 'dark-water',
  solid: true,
  blocksShots: false,
  water: true,
  build(ctx) {
    const { F, FX0, FZ0 } = ctx;
    F.box(FX0, -1, FZ0, FX0 + FPT, 0, FZ0 + FPT, (X, Y, Z) => shadeHex(GOLD.water, 1 + (hash3(X >> 2, 1, Z >> 2, 5) - 0.5) * 0.1));
    ctx.water();
  },
});

const statueGrid = statue();
registerTile('dungeon', 'S', {
  name: 'statue',
  solid: true,
  detailHeight: statueGrid.sy,
  build(ctx) {
    fineFloor(ctx);
    ctx.D.stamp(statueGrid, ctx.FX0 + (FPT - statueGrid.sx) / 2, 1, ctx.FZ0 + (FPT - statueGrid.sz) / 2);
  },
});

const brazierGrid = brazier();
registerTile('dungeon', 'F', {
  name: 'brazier',
  solid: true,
  detailHeight: brazierGrid.sy,
  build(ctx) {
    fineFloor(ctx);
    ctx.D.stamp(brazierGrid, ctx.FX0 + (FPT - brazierGrid.sx) / 2, 1, ctx.FZ0 + (FPT - brazierGrid.sz) / 2);
  },
  prop: flameProp,
});

// Stairs out: the floor runs to the middle of the tile, then two steps go down into the dark.
registerTile('dungeon', 'X', {
  name: 'stairs-out',
  doorway: true,
  onEnter: enterWarp,
  build(ctx) {
    fineFloor(ctx, 0, FPT / 2);
    const { T, X0, Z0 } = ctx;
    T.box(X0, -1, Z0 + 4, X0 + BPT, 0, Z0 + 6, GOLD.step);
    T.box(X0, -2, Z0 + 6, X0 + BPT, -1, Z0 + 8, GOLD.stepDark);
  },
});

registerTile('dungeon', 'O', { name: 'pit', solid: true, build() {} });

registerTile('dungeon', 'L', {
  name: 'locked-door',
  solid: true,
  doorway: true,
  becomes: '.',
  build: (ctx) => fineFloor(ctx),
  prop: doorProp,
  onPush: unlockDoor,
});

registerTile('dungeon', 'C', {
  name: 'chest',
  solid: true,
  build: (ctx) => fineFloor(ctx),
  prop: chestProp,
  onPush: openChest,
});

// Pressure plates: a flush pale 13 x 13 tile with a thin two-tone mark like a shallow groove (the
// south-facing side of each stroke catches the light, the north-facing side is in shade).
function plate(kind) {
  return (ctx) => {
    fineFloor(ctx);
    const x0 = ctx.FX0 + 2;
    const z0 = ctx.FZ0 + 2;
    for (let z = 0; z < 13; z++)
      for (let x = 0; x < 13; x++) {
        let c = GOLD.plate;
        if (kind === 'x' && x > 0 && x < 12 && z > 0 && z < 12) {
          const d1 = x - z;
          const d2 = x + z - 12;
          if (d1 === -1 || d2 === 1) c = GOLD.plateMark;
          else if (d1 === 1 || d2 === -1) c = GOLD.plateShade;
        }
        if (kind === 'o') {
          const r = Math.hypot(x - 6, z - 6);
          if (r > 3.4 && r <= 4.4) c = z >= 6 ? GOLD.plateMark : GOLD.plateShade;
        }
        ctx.F.set(x0 + x, 0, z0 + z, c);
      }
  };
}
registerTile('dungeon', '_', { name: 'plate-x', build: plate('x') });
registerTile('dungeon', '=', { name: 'plate-o', build: plate('o') });

registerTile('dungeon', 'P', { name: 'push-block', solid: true, build: (ctx) => fineFloor(ctx), prop: pushBlockProp });
registerTile('dungeon', '*', { name: 'spike-ball', solid: true, build: (ctx) => fineFloor(ctx), prop: spikeBallProp });
