// Overworld tiles, built with the overworld kit (art bible section 8): 1/8 tile blocks, a
// two-block ground slab with the fixed accent pattern, ragged transitions between ground kinds,
// raised ground in one-tile levels with ridged cliff faces, one tree per tile, water planes.
//   .  grass       ,  flowers      p  dirt path    s  sand        d  dirt
//   T  tree        R  rock         B  bush (cut it with the sword; grows back)
//   #  raised ground, one level (cliff faces where it drops)     2  two levels
//   D  cave mouth in a raised tile's south face (warp, destination in the area's warps)
//   ^  stairs cut into a raised tile's south face (decoration: the hero stays on the ground)
//   ~  water       =  stone bridge over water                  f  wooden fence
//   g  gravestone  i  signpost     v  clay pot     C  chest (walk into it)
//   k  cracked rock (a bomb clears it)   K  a bush like any other, but it hides stairs down
//   y  a cleared secret (what 'k' becomes)   j  hidden stairs (what 'K' becomes)
// Backdrop only (the far distance around an area, see farband.js):
//   4  four levels   u / t / w  a tree on raised ground of level 1 / 2 / 4
import * as THREE from 'three';
import { hash3, shadeHex, mixHex } from '../../core/vox.js';
import { GROUND_Y } from '../../core/constants.js';
import { emit } from '../../core/events.js';
import { enterWarp } from '../../systems/transitions.js';
import { defineTileset, registerTile } from '../tiles.js';
import { LEVEL } from '../terrain.js';
import { TP, GROUND, PROP } from '../palette.js';
import { bushProp, potProp, chestProp, cutPlant, breakPot, openChest, revealBurst, revealGlint } from '../tilekit.js';
import { gravestone, signpost } from '../../models/props.js';
import { showDialog } from '../../ui/dialog.js';
import { liftPot } from '../../systems/pots.js';

defineTileset('overworld', { floor: '.' });

// ---------------------------------------------------------------- ground
// Accent layouts of a ground tile (art bible section 8, lab world8.js): 8 x 8 maps, block offsets
// x east, z south; -1 dark, -0.6 weak dark, +1 light, +0.5 faint light. Our own layouts, built to
// the statistics measured on the references:
//   field  grass: 3 dark singles, 2 light singles, one 2 x 1 east-west light dash, 1 faint light
//   dirt   dirt and paths: 10 singles (6 dark, 3 of them weak; 4 light), no dashes
//   v1     the first-pass layout (four 2 x 1 dashes), which the lab still uses for sand
const LAYOUTS = {
  field: [[3, 0, -1], [6, 1, 1], [0, 3, 1], [1, 3, 1], [5, 3, -1], [3, 5, 1], [7, 6, -1], [5, 7, 0.5]],
  dirt: [[2, 0, -1], [6, 1, 1], [0, 2, -0.6], [4, 3, -1], [7, 3, 0.5], [1, 5, 1], [5, 5, -0.6], [3, 6, -1], [7, 6, 1], [5, 7, -0.6]],
  v1: [[1, 1, -1], [2, 1, -1], [5, 5, -1], [6, 5, -1], [5, 2, 1], [6, 2, 1], [1, 6, 1], [2, 6, 1]],
};
const ACCENTS = {};
for (const [name, list] of Object.entries(LAYOUTS)) {
  const m = (ACCENTS[name] = new Float32Array(64));
  for (const [x, z, d] of list) m[z * 8 + x] = d;
}
const LAYOUT_OF = { grass: 'field', dirt: 'dirt', path: 'dirt', sand: 'v1' };

// Accent value -> colour, from the kind's [base, dark, light].
const tone = (pal, a) => (a <= -1 ? pal[1] : a < 0 ? mixHex(pal[0], pal[1], -a) : a >= 1 ? pal[2] : a > 0 ? mixHex(pal[0], pal[2], a) : pal[0]);

// Top colour of a ground block of kind at global block (X, Z): base or accent, with +-1.5%
// brightness jitter per block.
export function surfaceColor(kind, X, Z, ground = GROUND) {
  const pal = ground[kind] ?? GROUND[kind] ?? GROUND.grass;
  const a = ACCENTS[LAYOUT_OF[kind] ?? 'field'][(Z & 7) * 8 + (X & 7)];
  return shadeHex(tone(pal, a), 1 + (hash3(X, 1, Z, 4) - 0.5) * 0.03);
}

// Cliff face colour: tan with 20% darker and 14% lighter blocks, in two-block tall clumps.
export function cliffColor(X, Y, Z, seed = 41) {
  const n = hash3(X, Y >> 1, Z, seed);
  return n < 0.2 ? TP.cliffDark : n > 0.86 ? TP.cliffLight : TP.cliff;
}

const levelOf = (def) => (def ? def.level ?? 0 : null);
const isWater = (def) => !!def?.water;
const bleedKind = (k) => (k === 'path' ? 'dirt' : k);

// The four side neighbours: west, east, north, south, each { def, level, kind, water }.
const SIDES = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
function sides(ctx) {
  return SIDES.map(([dx, dz]) => {
    const def = ctx.defAt(dx, dz);
    return { dx, dz, def, level: levelOf(def), kind: def && !def.water ? def.ground ?? null : null, water: isWater(def) };
  });
}

// How far (blocks) a neighbouring kind bleeds into this tile's border: 0 to 2, in 2-block clumps.
const bleed = (X, Z, seed) => (hash3(X >> 1, 0, Z >> 1, seed) < 0.45 ? 1 : 0) + (hash3(X, 2, Z, seed + 1) < 0.18 ? 1 : 0);

// Ground kind of the block at (lx, lz) in the tile: border blocks may take a same-level land
// neighbour's kind, so transitions are ragged pixel edges.
function blockKind(nb, ctx, lx, lz, kind, level) {
  const X = ctx.X0 + lx;
  const Z = ctx.Z0 + lz;
  let k = kind;
  const dist = [lx, 7 - lx, lz, 7 - lz];
  for (let i = 0; i < 4; i++) {
    if (dist[i] > 1) continue;
    const n = nb[i];
    if (!n.kind || n.level !== level || bleedKind(n.kind) === bleedKind(kind)) continue;
    if (dist[i] < bleed(X, Z, 31 + n.dx * 3 + n.dz * 5)) k = n.kind;
  }
  return k;
}

// The ground of a tile: soil under a top layer of its kind, raised `level` tiles with cliff faces
// where it drops to a lower neighbour. Returns the Y of the top layer.
export function land(ctx, { kind = ctx.def.ground ?? 'grass', level = ctx.level } = {}) {
  const { T, X0, Z0 } = ctx;
  const nb = sides(ctx);
  const top = level * LEVEL;
  for (let lz = 0; lz < 8; lz++)
    for (let lx = 0; lx < 8; lx++) {
      const X = X0 + lx;
      const Z = Z0 + lz;
      T.set(X, -1, Z, TP.soil);
      if (level > 0) {
        T.set(X, 0, Z, TP.soil);
        for (let Y = 1; Y < top; Y++) T.set(X, Y, Z, cliffColor(X, Y, Z, 41 + ((Y - 1) >> 3)));
      }
      T.set(X, top, Z, surfaceColor(blockKind(nb, ctx, lx, lz, kind, level), X, Z, ctx.owner?.area?.groundPalette));
    }
  if (level > 0) cliffEdges(ctx, nb, level);
  return top;
}

// Cliff faces toward lower land (refs 29, 36, 40): a ragged dirt rim on the plateau's edge, one
// column in ten carrying an extra block, a third of the columns (in runs of about four) stepping
// out one block as full-height ridges, and about 8% of the columns recessed as dark cracks. Faces toward water, toward
// higher ground and toward the edge of the world stay plain.
function cliffEdges(ctx, nb, level) {
  const { T, X0, Z0 } = ctx;
  const top = level * LEVEL;
  for (const n of nb) {
    if (n.level === null || n.water || n.level >= level) continue;
    const { dx, dz } = n;
    const y0 = n.level * LEVEL + 1; // first block above the lower side's ground
    for (let i = 0; i < 8; i++) {
      const X = dx === 1 ? X0 + 7 : dx === -1 ? X0 : X0 + i;
      const Z = dz === 1 ? Z0 + 7 : dz === -1 ? Z0 : Z0 + i;
      const rim = (hash3(X, 9, Z, 51) < 0.7 ? 1 : 0) + (hash3(X, 10, Z, 52) < 0.4 ? 1 : 0) + (hash3(X >> 1, 8, Z >> 1, 50) < 0.2 ? 2 : 0);
      for (let k = 0; k < rim; k++) T.set(X - dx * k, top, Z - dz * k, surfaceColor('dirt', X - dx * k, Z - dz * k));
      if (hash3(X, 13, Z, 55) < 0.1) T.set(X, top + 1, Z, TP.cliff);
      const ax = dx ? X : X >> 2;
      const az = dz ? Z : Z >> 2;
      const run = hash3(ax, 14, az, 56);
      if (run < 0.35) {
        const y1 = top - (hash3(ax, 15, az, 57) < 0.5 ? 1 : 0);
        for (let Y = y0; Y <= y1; Y++) T.set(X + dx, Y, Z + dz, hash3(X, Y >> 1, Z, 58) < 0.2 ? TP.cliffDark : TP.cliff);
      } else if (hash3(X, 16, Z, 59) < 0.08 / 0.65) {
        // about 8% of all columns: a one-block recessed dark crack
        for (let Y = y0; Y < top; Y++) {
          T.set(X, Y, Z, null);
          T.set(X - dx, Y, Z - dz, TP.cliffCrack);
        }
      }
    }
  }
}

// ---------------------------------------------------------------- scenery
// One tree per tile (refs 34, 40): a 4 x 4 trunk 3 or 4 blocks tall with a darker bottom ring,
// under a canopy of stacked square layers 8, 10, 10, 8, 6 blocks wide (2, 2, 2, 2, 1 tall) with
// chamfered corners, saturated green, a darker bottom layer and about 3% pale speckles. The canopy
// overhangs the tile by a block, so rows of trees merge into hedges. y0: first block above ground.
export function tree(ctx, y0) {
  const { T, X0, Z0 } = ctx;
  const foliage = ctx.owner?.area?.foliage ?? TP;
  const cx = X0 + 4;
  const cz = Z0 + 4;
  const trunkH = 3 + (hash3(ctx.tx, 0, ctx.tz, 7) > 0.7 ? 1 : 0);
  T.box(cx - 2, y0, cz - 2, cx + 2, y0 + trunkH, cz + 2, TP.trunk);
  T.box(cx - 2, y0, cz - 2, cx + 2, y0 + 1, cz + 2, TP.trunkDark);
  let y = y0 + trunkH;
  for (const [w, h] of [[8, 2], [10, 2], [10, 2], [8, 2], [6, 1]]) {
    const half = w / 2;
    for (let yy = y; yy < y + h; yy++)
      for (let z = -half; z < half; z++)
        for (let x = -half; x < half; x++) {
          if (Math.abs(x + 0.5) + Math.abs(z + 0.5) > w - 2.5) continue;
          const X = cx + x;
          const Z = cz + z;
          const n = hash3(X, yy, Z, 61);
          T.set(X, yy, Z, yy === y0 + trunkH ? foliage.leafDark : n > 0.97 ? foliage.leafSpeck : foliage.leaf);
        }
    y += h;
  }
}

// Rounded grey lump 7 to 8 blocks across and 6 tall, lighter on top, centred on the tile.
export function rock(ctx, y0 = 1) {
  const { T, X0, Z0 } = ctx;
  const r = hash3(ctx.tx, 2, ctx.tz, 9);
  const cx = X0 + 4;
  const cz = Z0 + 4;
  for (let z = -4; z < 4; z++)
    for (let y = 0; y < 6; y++)
      for (let x = -4; x < 4; x++) {
        const d = Math.hypot(x + 0.5, (y - 0.8) * 1.05, z + 0.5);
        if (d > 3.8 + r * 0.4) continue;
        const X = cx + x;
        const Z = cz + z;
        T.set(X, y0 + y, Z, y > 3 || hash3(X, y, Z, 81) > 0.8 ? TP.rock : TP.rockDark);
      }
}

// Five small flowers on a grass tile, at character resolution (1/16) in the detail layer.
function flowers(ctx) {
  const { D, FX0, FZ0 } = ctx;
  const seed = (ctx.tx * 7 + ctx.tz * 13) | 0;
  const petals = [PROP.flowerRed, PROP.flowerYellow, PROP.flowerWhite];
  for (let i = 0; i < 5; i++) {
    const x = FX0 + 2 + Math.floor(hash3(i, seed, 1, 41) * 11);
    const z = FZ0 + 2 + Math.floor(hash3(i, seed, 2, 41) * 11);
    const col = petals[Math.floor(hash3(i, seed, 3, 41) * 3)];
    D.set(x, 1, z, PROP.stem);
    D.set(x, 2, z, PROP.flowerCenter);
    D.set(x - 1, 2, z, col).set(x + 1, 2, z, col).set(x, 2, z - 1, col).set(x, 2, z + 1, col);
  }
}

// ---------------------------------------------------------------- tiles
registerTile('overworld', '.', { name: 'grass', ground: 'grass', build: (ctx) => land(ctx) });

registerTile('overworld', ',', {
  name: 'flowers',
  ground: 'grass',
  detailHeight: 3,
  build(ctx) {
    land(ctx);
    flowers(ctx);
  },
});

registerTile('overworld', 'p', { name: 'path', ground: 'path', build: (ctx) => land(ctx) });
registerTile('overworld', 'd', { name: 'dirt', ground: 'dirt', build: (ctx) => land(ctx) });
registerTile('overworld', 's', { name: 'sand', ground: 'sand', build: (ctx) => land(ctx) });

registerTile('overworld', 'T', {
  name: 'tree',
  solid: true,
  ground: 'grass',
  height: 15,
  build(ctx) {
    tree(ctx, land(ctx) + 1);
  },
});

registerTile('overworld', 'R', {
  name: 'rock',
  solid: true,
  ground: 'grass',
  build(ctx) {
    rock(ctx, land(ctx) + 1);
  },
});

registerTile('overworld', 'B', {
  name: 'bush',
  solid: true,
  regrow: true,
  becomes: '.',
  ground: 'grass',
  build: (ctx) => land(ctx),
  prop: bushProp,
  onSword: (ctx) => cutPlant(ctx, [TP.leaf, TP.leafDark, TP.leafLight, TP.leaf]),
  onBomb: (ctx) => cutPlant(ctx, [TP.leaf, TP.leafDark, TP.leafLight, TP.leaf]),
});

// Raised ground: one level (the M1 cliff) and two.
registerTile('overworld', '#', { name: 'cliff', solid: true, ground: 'grass', level: 1, build: (ctx) => land(ctx) });
registerTile('overworld', '2', { name: 'cliff-2', solid: true, ground: 'grass', level: 2, build: (ctx) => land(ctx) });

// A cave mouth in the south face of raised ground: 4 blocks wide, 6 tall, 4 deep, black inside.
// Neighbouring 'D' tiles join into one wide mouth.
registerTile('overworld', 'D', {
  name: 'cave-door',
  ground: 'grass',
  level: 1,
  onEnter: enterWarp,
  build(ctx) {
    land(ctx);
    const { T, X0, Z0 } = ctx;
    const xa = X0 + (ctx.tileAt(-1, 0) === 'D' ? 0 : 2);
    const xb = X0 + (ctx.tileAt(1, 0) === 'D' ? 8 : 6);
    const za = Z0 + 4;
    T.clear(xa, 1, za, xb, 7, Z0 + 8);
    T.clear(xa, 1, Z0 + 8, xb, 9, Z0 + 9); // no cliff ridge in front of the mouth
    T.box(xa, 0, za, xb, 1, Z0 + 8, TP.cave);
    // the hollow's walls and ceiling are dark
    T.box(xa, 1, za - 1, xb, 7, za, TP.cave);
    T.box(xa, 7, za, xb, 8, Z0 + 8, (X, Y, Z) => (Z < Z0 + 7 ? TP.cave : undefined));
    if (xa > X0) T.box(xa - 1, 1, za, xa, 7, Z0 + 7, TP.cave);
    if (xb < X0 + 8) T.box(xb, 1, za, xb + 1, 7, Z0 + 7, TP.cave);
  },
});

// Stairs cut into the south face of raised ground, one block per step.
registerTile('overworld', '^', {
  name: 'stairs',
  solid: true,
  ground: 'dirt',
  level: 1,
  build(ctx) {
    land(ctx);
    const { T, X0, Z0 } = ctx;
    T.clear(X0 + 1, 1, Z0 + 8, X0 + 7, LEVEL + 1, Z0 + 9); // no cliff ridge in front of the steps
    for (let s = 0; s < LEVEL; s++) {
      const z = Z0 + 7 - s;
      T.clear(X0 + 1, s + 2, z, X0 + 7, LEVEL + 1, z + 1);
      T.box(X0 + 1, s + 1, z, X0 + 7, s + 2, z + 1, (X) => shadeHex(s % 2 ? TP.dirtDark : TP.dirt, 1 + (hash3(X, s, z, 3) - 0.5) * 0.03));
    }
  },
});

// Water: a flat plane 0.35 block below the ground over a bed one block down. Banks are the plain
// ground of the neighbours.
function waterBed(ctx) {
  const { T, X0, Z0 } = ctx;
  T.box(X0, -1, Z0, X0 + 8, 0, Z0 + 8, (X, Y, Z) => shadeHex(TP.waterBed, 1 + (hash3(X, 3, Z, 5) - 0.5) * 0.06));
  ctx.water();
}

registerTile('overworld', '~', {
  name: 'water',
  solid: true,
  blocksShots: false,
  water: true,
  height: 1,
  build: waterBed,
});

// Stone bridge: a light grey slab across the water with a darker stripe every third block. It
// runs east-west unless water lies on both its east and west sides.
registerTile('overworld', '=', {
  name: 'bridge',
  water: true,
  height: 1,
  build(ctx) {
    waterBed(ctx);
    const { T, X0, Z0 } = ctx;
    const w = ctx.defAt(-1, 0);
    const e = ctx.defAt(1, 0);
    const ew = !(w?.water && w.char !== '=') || !(e?.water && e.char !== '=');
    for (let k = 0; k < 8; k++)
      for (let i = 1; i < 7; i++) {
        const X = ew ? X0 + k : X0 + i;
        const Z = ew ? Z0 + i : Z0 + k;
        const along = ew ? X : Z;
        T.set(X, 0, Z, ((along % 3) + 3) % 3 === 2 ? TP.stoneDark : shadeHex(TP.stone, 1 + (hash3(X, 6, Z, 7) - 0.5) * 0.04));
      }
  },
});

// Wooden fence: posts (1 x 5 x 1 blocks) at blocks 1 and 6, two rails at heights 1 and 3. It runs
// north-south when fences continue that way and not east-west.
registerTile('overworld', 'f', {
  name: 'fence',
  solid: true,
  ground: 'grass',
  height: 6,
  build(ctx) {
    const y0 = land(ctx) + 1;
    const { T, X0, Z0 } = ctx;
    const f = (dx, dz) => ctx.tileAt(dx, dz) === 'f';
    const ns = (f(0, -1) || f(0, 1)) && !(f(-1, 0) || f(1, 0));
    const at = (a, b, Y, c) => (ns ? T.set(X0 + 3, Y, Z0 + a, c) : T.set(X0 + a, Y, Z0 + 3 + b, c));
    for (const p of [1, 6]) for (let Y = y0; Y < y0 + 5; Y++) at(p, 0, Y, TP.woodDark);
    for (const r of [1, 3]) for (let a = 0; a < 8; a++) if (a !== 1 && a !== 6) at(a, 0, y0 + r, TP.wood);
  },
});

// Small props at character resolution (1/16) standing on grass: static ones are stamped into the
// detail layer, the others are props.
function stampModel(ctx, grid) {
  ctx.D.stamp(grid, ctx.FX0 + ((16 - grid.sx) >> 1), 1, ctx.FZ0 + ((16 - grid.sz) >> 1));
}
const graveGrid = gravestone();
const signGrid = signpost();
registerTile('overworld', 'g', {
  name: 'grave',
  solid: true,
  ground: 'grass',
  detailHeight: graveGrid.sy,
  build(ctx) {
    land(ctx);
    stampModel(ctx, graveGrid);
  },
});
registerTile('overworld', 'i', {
  name: 'sign',
  solid: true,
  ground: 'grass',
  detailHeight: signGrid.sy,
  build(ctx) {
    land(ctx);
    stampModel(ctx, signGrid);
  },
  // Read it (gameplay spec 5.2): the screen's own text (def.signs['x,z'] or def.sign), else
  // directions to the places next door.
  onInteract(ctx) {
    const own = ctx.screen.def.signs?.[`${ctx.x},${ctx.z}`] ?? ctx.screen.def.sign;
    showDialog(own ?? signText(ctx), { speaker: 'Signpost' });
    return true;
  },
});

// "North: Cairn Ridge / East: ..." from the screens past each edge of the sign's screen.
function signText(ctx) {
  const s = ctx.screen;
  const W = ctx.world;
  const probes = [['North', s.x0 + s.w / 2, s.z0 - 1], ['East', s.x1, s.z0 + s.h / 2], ['South', s.x0 + s.w / 2, s.z1], ['West', s.x0 - 1, s.z0 + s.h / 2]];
  const lines = [];
  for (const [dir, x, z] of probes) {
    const n = W.locate(Math.floor(x), Math.floor(z))?.screen;
    if (n && n !== s && n.name) lines.push(`${dir}: ${n.name}`);
  }
  return lines.length ? [`You are in ${s.name ?? 'the wilds'}.`, lines.join('    ')] : `${s.name ?? 'The wilds'}. The roads beyond are overgrown.`;
}
// Pots (gameplay spec: sword or bomb breaks it into cubes, 50% drop roll); back on the next visit.
registerTile('overworld', 'v', {
  name: 'pot',
  prompt: 'Lift pot',
  solid: true,
  regrow: true,
  becomes: '.',
  ground: 'grass',
  build: (ctx) => land(ctx),
  prop: potProp,
  onInteract: liftPot,
  onShot: (ctx) => ctx.projectile?.source === 'pot' && breakPot(ctx),
  onSword: (ctx) => breakPot(ctx),
  onBomb: (ctx) => breakPot(ctx),
});
registerTile('overworld', 'C', { name: 'chest', solid: true, grapple: true, ground: 'grass', build: (ctx) => land(ctx), prop: chestProp, onPush: openChest });

// ---------------------------------------------------------------- secrets (fun audit: every
// screen earns a find, ALttP-style). A cracked rock looks exactly like a plain one until a bomb
// clears it: onBomb sets it to 'y', whatever the screen's own `warps` table sends that char to (a
// cave, a shortcut, a small vault) -- the same "walk into a tile, warp" the game already uses for
// doors, so a revealed secret needs no new machinery. It has no separate mesh (the rock is baked
// into the terrain), so its prop is a bare glint anchor for the reveal spell.
registerTile('overworld', 'k', {
  name: 'cracked-rock',
  solid: true,
  becomes: 'y',
  ground: 'grass',
  build(ctx) {
    rock(ctx, land(ctx) + 1);
  },
  prop(ctx) {
    const obj = new THREE.Group();
    obj.position.set(ctx.cx, GROUND_Y, ctx.cz);
    revealGlint(ctx, obj, 2.2);
    return obj;
  },
  onBomb(ctx) {
    const { world, tx, tz, def } = ctx;
    if (!world.setTile(tx, tz, def.becomes, { persist: true, reason: 'bomb-wall' })) return false;
    revealBurst(tx, tz, [TP.rock, TP.rockDark, TP.cliff]);
    emit('secret-found', { kind: 'bomb-wall', tx, tz });
    return true;
  },
});

// A cleared secret: open ground, a shadowed hollow to hint at the way down, a warp wherever the
// screen's `warps.y` (or `warps.j`, for a stair-bush) sends it.
function darkenHollow(ctx, top) {
  const { T, X0, Z0 } = ctx;
  for (let z = 2; z < 6; z++) for (let x = 2; x < 6; x++) T.set(X0 + x, top, Z0 + z, shadeHex(surfaceColor('dirt', X0 + x, Z0 + z), 0.5));
}
registerTile('overworld', 'y', {
  name: 'cleared-secret',
  ground: 'grass',
  onEnter: enterWarp,
  build(ctx) {
    darkenHollow(ctx, land(ctx));
  },
});
registerTile('overworld', 'j', {
  name: 'hidden-stairs',
  ground: 'grass',
  onEnter: enterWarp,
  build(ctx) {
    darkenHollow(ctx, land(ctx));
  },
});

// A stair-bush: a bush like any other kit bush (same model, same cut), except cutting it clears to
// 'j' instead of grass. onBomb clears it too, same as a plain bush.
function revealStairBush(ctx) {
  const { world, tx, tz, def } = ctx;
  const cols = world.propAt(tx, tz)?.userData.colors ?? [TP.leaf, TP.leafDark, TP.leafLight, TP.leaf];
  if (!world.setTile(tx, tz, def.becomes ?? '.', { reason: 'cut' })) return false;
  revealBurst(tx, tz, cols, { up: 3 });
  emit('secret-found', { kind: 'hidden-stairs', tx, tz });
  return true;
}
registerTile('overworld', 'K', {
  name: 'stair-bush',
  solid: true,
  becomes: 'j',
  ground: 'grass',
  build: (ctx) => land(ctx),
  prop(ctx) {
    const obj = bushProp(ctx);
    revealGlint(ctx, obj, 1.4);
    return obj;
  },
  onSword: revealStairBush,
  onBomb: revealStairBush,
});

// ---------------------------------------------------------------- backdrop tiles
registerTile('overworld', '4', { name: 'cliff-4', solid: true, ground: 'grass', level: 4, build: (ctx) => land(ctx) });
for (const [ch, level] of [['u', 1], ['t', 2], ['w', 4]])
  registerTile('overworld', ch, {
    name: `tree-${level}`,
    solid: true,
    ground: 'grass',
    level,
    height: 15,
    build(ctx) {
      tree(ctx, land(ctx) + 1);
    },
  });
