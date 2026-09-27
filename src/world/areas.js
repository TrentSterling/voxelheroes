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
//                                      // (or at: [tx, tz], its north-west tile)
//     start: [0, 1],                   // local screen used by teleport('crypt') (default: the first screen)
//     entrance: { screen: [0, 1], x: 8, z: 10.4, yaw: Math.PI }, // get up here after falling in here
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
// So `origin` counts screens of the area's own size. Screens are 16 tiles
// wide unless an area says otherwise, so origin[0] means the same column of
// the world for all of them; docs/ARCHITECTURE.md ("Global regions") says
// which columns each kind of area uses. An area with screens of another
// width (a small house) gives `at: [tx, tz]` instead of `origin`: the global
// tile of local screen '0,0's north-west corner (areaCorner below), e.g.
// at: [300 * 16, 0] for the corner of screen column 300. Areas whose screens
// touch are neighbours, whatever their sizes: walking off an edge into
// another area's screen changes area (a fade and a loading card) instead of
// sliding. Areas must not overlap (the world checks).
//
// Rooms (`rooms: true`, art bible section 9): each screen is one room, in
// dungeons 16 x 12 tiles. Row 0 is the north wall, rows 1 to 10 the floor,
// row 11 the south wall (a room may set `southWall: false` to leave out its
// black band; collision is unchanged), columns 0 and 15 the side walls. Doors
// are two open tiles in the middle of a wall: columns 7 and 8 of rows 0 and
// 11, rows 5 and 6 of columns 0 and 15. Side walls are drawn half a tile
// inward, so their collision stops bodies at x = 1.5 and x = 14.5; only the
// current room is drawn, and the camera centres on it. Rooms of one dungeon
// adjoin, so door gaps line up. Rooms of another size (house interiors) work
// the same way: the outer ring of tiles is the wall.
//
// Screens can override lighting, camera, tileset, spawns and warps, and may
// carry data for tiles, such as chest contents (`chest: 'heart-container'`,
// or `chests: { 'x,z': contents }`). Optional hooks: area.onScreenEnter(screen)
// and screen.onEnter(screen) run after the screen's spawns appear.
//
// spawns: marker char -> entity type. A marker is replaced by the floor tile
// (or `tile`) and spawns the entity at the tile's centre every time the screen
// is entered. Extra fields are passed to the entity factory; `once: true`
// means it never comes back after it is collected or killed. A marker char
// must not be a tile of the screen's tileset (startup throws).
// A screen can also place spawns by position, keeping the map tile:
// spawnsAt: { '5,4': { type: 'npc', name: 'Old Wren', lines: [...] } }.
//
// warps: tile char -> destination. Warp tiles (onEnter: enterWarp) send the
// hero to { area, screen: [local x, y], x, z (tile coords in that screen), yaw }.
// A screen-level `warps` table overrides the area's, and may key a warp by
// position ('8,1': {...}, local tile coordinates) so one screen can hold
// several doors of the same tile. A warp into an area that is not registered
// warns at startup and does nothing (another branch may add the area); a
// warp into a registered area must land inside its screen on a tile the hero
// can stand on (startup throws otherwise).
//
// entrance: a spot like a warp's (area defaults to this one). A hero who
// falls anywhere in the area gets back up there instead of at the respawn
// point: a dungeon's entrance room (gameplay spec 6.7 and 11). A boss arena
// in an area of its own names its dungeon's entrance.

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

// The global tile at the north-west corner of an area's local screen '0,0':
// `at`, or `origin` counted in the area's screens.
export function areaCorner(area) {
  if (area.at) return [area.at[0], area.at[1]];
  const [w, h] = areaScreenSize(area);
  const [ox, oy] = area.origin ?? [0, 0];
  return [ox * w, oy * h];
}

export function registerArea(def) {
  if (!def?.id) throw new Error('registerArea: an area needs an id');
  if (areas.has(def.id)) throw new Error(`Area "${def.id}" is already registered`);
  const size = areaScreenSize(def);
  if (!Array.isArray(size) || size.length !== 2 || !size.every((n) => isInt(n) && n > 0))
    throw new Error(`Area ${def.id}: screen must be [w, h] in whole tiles, got ${JSON.stringify(def.screen)}`);
  const [w, h] = size;
  if (def.origin !== undefined && !(Array.isArray(def.origin) && def.origin.length === 2 && def.origin.every(isInt)))
    throw new Error(`Area ${def.id}: origin must be [x, y] in whole screens, got ${JSON.stringify(def.origin)}`);
  if (def.at !== undefined && !(Array.isArray(def.at) && def.at.length === 2 && def.at.every(isInt)))
    throw new Error(`Area ${def.id}: at must be [x, z] in whole tiles, got ${JSON.stringify(def.at)}`);
  if (def.at !== undefined && def.origin !== undefined) throw new Error(`Area ${def.id}: give origin (screens) or at (tiles), not both`);
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

// The local screen [i, j] an area starts on: its `start`, else its first
// screen. Spots without a screen and teleport('<area id>') use it.
export const areaStart = (area) => area.start ?? Object.keys(area.screens)[0].split(',').map(Number);

// A dungeon room's local screen [i, j] from the gameplay spec's label (3):
// a row letter A-J, north to south, and a column 1-8, west to east; the
// entrance is on row J. Floor f's rooms are local rows 11 f to 11 f + 9
// ("Global regions" in docs/ARCHITECTURE.md), so
//   room('J-3') is [2, 9], room('A-1', 1) is [0, 11]
// and a room's screen key is room('J-3').join(',').
export function room(label, floor = 0) {
  const m = /^([A-J])-([1-8])$/.exec(label);
  if (!m || !isInt(floor) || floor < 0)
    throw new Error(`room(${JSON.stringify(label)}, ${floor}): a room is a row A-J and a column 1-8 ("J-3") on floor 0, 1, 2, ...`);
  return [Number(m[2]) - 1, 11 * floor + (m[1].charCodeAt(0) - 65)];
}

export const allAreas = () => [...areas.values()];
