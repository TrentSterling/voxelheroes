// Area registry. Each file in src/world/areas/ registers one area: a lattice
// of equal-size ASCII screens plus metadata. Files load automatically.
//
//   export default registerArea({
//     id: 'crypt',                     // unique id
//     name: 'Cairn Crypt',             // shown on maps and menus
//     tileset: 'dungeon',              // which tile registry set the rows use
//     lighting: 'crypt',               // core/renderer.js LIGHTING preset
//     camera: 'dungeon',               // core/camera.js preset; omit to use the player's choice
//     screen: [16, 12],                // tiles per screen (w, h); default [16, 11], rooms [16, 12]
//     rooms: true,                     // dungeon rooms: walls and doors of art bible section 9
//     origin: [200, 0],                // global screen of the local '0,0' screen (see below)
//     start: [0, 1],                   // local screen used by teleport('crypt')
//     keyGroup: 'crypt',               // small keys are counted per group (default: id)
//     spawns: { e: 'slime', K: { type: 'key', once: true } },
//     warps: { X: { area: 'overworld', screen: [1, 0], x: 8, z: 1.7, yaw: 0 } },
//     screens: {
//       '0,1': { name: 'Sunken Gate', rows: [ ...h strings of w chars ] },
//     },
//   });
//
// Addressing. Every area sits in one global grid of tiles (1 tile = 1 world
// unit, x east, z south). Its screens form a lattice of w x h tile screens:
// local screen 'i,j' covers global tiles
//   x from (origin[0] + i) * w to (origin[0] + i + 1) * w - 1
//   z from (origin[1] + j) * h to (origin[1] + j + 1) * h - 1.
// So `origin` counts screens of the area's own size. Every screen is 16 tiles
// wide, so origin[0] means the same column of the world for every area;
// docs/ARCHITECTURE.md ("Global regions") says which columns each kind of
// area uses. Areas of the same size whose screens touch are neighbours:
// walking off an edge into another area's screen changes area (a fade and a
// loading card) instead of sliding. Areas must not overlap (the world checks).
//
// Rooms (`rooms: true`, art bible section 9): each screen is one room of
// 16 x 12 tiles. Row 0 is the north wall, rows 1 to 10 the floor, row 11 the
// south wall (a room may set `southWall: false` to leave out its black band;
// collision is unchanged), columns 0 and 15 the side walls. Doors are two
// open tiles in the middle of a wall: columns 7 and 8 of rows 0 and 11, rows
// 5 and 6 of columns 0 and 15. Side walls are drawn half a tile inward, so
// their collision stops bodies at x = 1.5 and x = 14.5; only the current
// room is drawn. Rooms of one dungeon adjoin, so door gaps line up.
//
// Screens can override lighting, camera, tileset, spawns and warps, and may
// carry data for tiles, such as chest contents (`chest: 'heart-container'`,
// or `chests: { 'x,z': contents }`). Optional hooks: area.onScreenEnter(screen)
// and screen.onEnter(screen) run after the screen's spawns appear.
//
// spawns: marker char -> entity type. A marker is replaced by the floor tile
// (or `tile`) and spawns the entity at the tile's centre every time the screen
// is entered. Extra fields are passed to the entity factory; `once: true`
// means it never comes back after it is collected or killed.
//
// warps: tile char -> destination. Warp tiles (onEnter: warp) send the hero to
// { area, screen: [local x, y], x, z (tile coords in that screen), yaw }.
// A screen-level `warps` table overrides the area's.

export const DEFAULT_SCREEN = [16, 11]; // overworld screens, towns
export const ROOM_SCREEN = [16, 12]; // dungeon rooms (art bible section 9)

// Where a new game starts, and where the hero gets back up after falling
// (a spot: area, local screen, and local tile coordinates; x and z default
// to the middle of the screen).
export const START = { area: 'overworld', screen: [1, 1] };

const areas = new Map();

const isInt = (v) => Number.isInteger(v);

// Tiles per screen for an area: [w, h].
export const areaScreenSize = (area) => area.screen ?? (area.rooms ? ROOM_SCREEN : DEFAULT_SCREEN);

export function registerArea(def) {
  if (!def?.id) throw new Error('registerArea: an area needs an id');
  if (areas.has(def.id)) throw new Error(`Area "${def.id}" is already registered`);
  const size = areaScreenSize(def);
  if (!Array.isArray(size) || size.length !== 2 || !size.every((n) => isInt(n) && n > 0))
    throw new Error(`Area ${def.id}: screen must be [w, h] in whole tiles, got ${JSON.stringify(def.screen)}`);
  const [w, h] = size;
  if (def.origin !== undefined && !(Array.isArray(def.origin) && def.origin.length === 2 && def.origin.every(isInt)))
    throw new Error(`Area ${def.id}: origin must be [x, y] in whole screens, got ${JSON.stringify(def.origin)}`);
  for (const [key, s] of Object.entries(def.screens ?? {})) {
    if (!/^-?\d+,-?\d+$/.test(key)) throw new Error(`Area ${def.id}: screen key "${key}" must look like "x,y"`);
    if (!Array.isArray(s.rows) || s.rows.length !== h)
      throw new Error(`Area ${def.id} screen ${key} has ${s.rows?.length} rows, expected ${h} (screen: [${w}, ${h}])`);
    s.rows.forEach((r, i) => {
      if (r.length !== w) throw new Error(`Area ${def.id} screen ${key} row ${i} has ${r.length} tiles, expected ${w}`);
    });
  }
  areas.set(def.id, def);
  return def;
}

export const getArea = (id) => areas.get(id) ?? null;

export const allAreas = () => [...areas.values()];
