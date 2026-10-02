// Tile registry: map characters -> tile definitions, grouped in tilesets.
//
// Every area names a tileset (overworld, dungeon, ...). The same character can
// mean different things in different tilesets ('.' is grass outdoors and
// flagstones in a dungeon). A tileset can extend another and inherit its
// tiles, so a town tileset only has to add what is new:
//
//   defineTileset('town', { parent: 'overworld' });
//
// Registering a tile (from any file in src/world/tiles/, which load
// automatically):
//
//   registerTile('dungeon', 'P', {
//     name: 'push-block',
//     solid: true,                      // or (body) => boolean
//     build(ctx) { floor(ctx); },       // voxels baked into the screen mesh
//     prop(ctx) { return mesh; },       // a separate Object3D on the tile
//     onPush(ctx) { ... },              // hero walks into it (every frame, ctx.dt)
//   });
//
// Definition fields (all optional):
//   name         readable id
//   solid        blocks walking; boolean or (body) => boolean. Default false.
//   blocksShots  stops projectiles. Default: same as solid. Set it false on
//                low tiles (water, pits, lava): shots and flying bodies
//                (entity.flying) pass over them.
//   build(ctx)   emit voxels. ctx: { g, layer(name), rand, pick, x, z, bx, bz,
//                tx, tz, ch, def, screen, area, world, tileAt(dx, dz) }.
//                g is the terrain grid in terrain voxels (8 per tile); bx/bz
//                is this tile's corner in it. Draw ONLY from ctx.rand so the
//                screen looks the same on every load.
//   prop(ctx)    return a THREE.Object3D for this tile, positioned in world
//                space (ctx.cx, ctx.cz = tile centre). Removed automatically
//                when the tile changes. obj.userData.tick(t, dt) animates it.
//   regrow       true: restored every time its screen is entered (bushes).
//   pushableFloor true: decorative floor that can receive a pushed block.
//   becomes      char this tile turns into when destroyed or opened.
//   Hooks, each called with ctx = { world, screen, area, tx, tz, x, z, ch, def, ...extra }:
//   onEnter / onLeave   the hero's centre moves onto / off the tile
//   onPush       the hero walks into the tile (extra: player, dt)
//   onSword      a sword hit point lands on the tile (extra: hit, player)
//   onBomb       an 'explosion' event covers the tile (extra: explosion)
//   onLight      a 'light' event covers the tile (extra: light)
//   onShot       a projectile stopped on the tile (extra: projectile, hit);
//                arrows, thrown blades and enemy rocks all call it
//   onInteract   A pressed while facing the tile (extra: player); return true
//                to use up the press so the sword does not swing
//   onClaim      an explicit story choice claims a shared tile reward once;
//                routed to stable living-party authority across dialog modes

const tilesets = new Map();

function tileset(name) {
  let ts = tilesets.get(name);
  if (!ts) {
    ts = { name, parent: null, floor: '.', tiles: new Map() };
    tilesets.set(name, ts);
  }
  return ts;
}

// floor: the char placed under spawn markers in this tileset.
export function defineTileset(name, { parent = null, floor = '.' } = {}) {
  const ts = tileset(name);
  ts.parent = parent;
  ts.floor = floor;
  return ts;
}

export function registerTile(set, char, def) {
  if (typeof char !== 'string' || char.length !== 1) throw new Error(`Tile char must be one character, got "${char}"`);
  const ts = tileset(set);
  if (ts.tiles.has(char)) throw new Error(`Tile "${char}" is already registered in tileset "${set}"`);
  const full = { name: char, solid: false, ...def, char, tileset: set };
  ts.tiles.set(char, full);
  return full;
}

// The definition for a char, looking through parent tilesets. null if unknown.
export function getTile(set, char) {
  for (let ts = tilesets.get(set); ts; ts = ts.parent ? tilesets.get(ts.parent) : null) {
    const def = ts.tiles.get(char);
    if (def) return def;
  }
  return null;
}

export function tilesetFloor(set) {
  return tilesets.get(set)?.floor ?? '.';
}

export function listTilesets() {
  return [...tilesets.values()].map((ts) => ({ name: ts.name, parent: ts.parent, chars: [...ts.tiles.keys()].join('') }));
}

// Resolve a def's solid flag for a moving body (or no body). Flying bodies
// pass over low tiles (blocksShots: false).
export function isSolidDef(def, body) {
  if (body?.flying && def.blocksShots === false) return false;
  const s = def.solid;
  return typeof s === 'function' ? !!s(body) : !!s;
}
