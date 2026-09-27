// Area registry. Each file in src/world/areas/ registers one area: a set of
// 16 x 11 ASCII screens plus metadata. Files load automatically.
//
//   export default registerArea({
//     id: 'crypt',                     // unique id
//     name: 'Cairn Crypt',             // shown on maps and menus
//     tileset: 'dungeon',              // which tile registry set the rows use
//     lighting: 'crypt',               // core/renderer.js LIGHTING preset
//     camera: 'dungeon',               // core/camera.js preset; omit to use the player's choice
//     origin: [0, 10],                 // global screen of the local '0,0' screen
//     keyGroup: 'crypt',               // small keys are counted per group (default: id)
//     spawns: { e: 'slime', K: { type: 'key', once: true } },
//     warps: { X: { area: 'overworld', screen: [1, 0], x: 8, z: 1.7, yaw: 0 } },
//     screens: {
//       '0,1': { name: 'Sunken Gate', rows: [ ...11 strings of 16 chars ] },
//     },
//   });
//
// Screen keys are local 'x,y' grid positions; origin shifts the whole area in
// the one global grid (areas must not overlap; the world checks). Screens can
// override lighting, camera, tileset, spawns and warps, and may carry data for
// tiles, such as chest contents (`chest: 'heart-container'`, or
// `chests: { 'x,z': contents }`). Optional hooks: area.onScreenEnter(screen)
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
// position ('8,1': {...}) so one screen can hold several doors of the same
// tile. A warp into an area that is not registered warns at startup and does
// nothing (another branch may add the area).
import { SCREEN_W, SCREEN_H } from '../core/constants.js';

// Where a new game starts, and where the hero gets back up after falling.
export const START = { area: 'overworld', screen: [1, 1] };

const areas = new Map();

export function registerArea(def) {
  if (!def?.id) throw new Error('registerArea: an area needs an id');
  if (areas.has(def.id)) throw new Error(`Area "${def.id}" is already registered`);
  for (const [key, s] of Object.entries(def.screens ?? {})) {
    if (!/^-?\d+,-?\d+$/.test(key)) throw new Error(`Area ${def.id}: screen key "${key}" must look like "x,y"`);
    if (!Array.isArray(s.rows) || s.rows.length !== SCREEN_H)
      throw new Error(`Area ${def.id} screen ${key} has ${s.rows?.length} rows, expected ${SCREEN_H}`);
    s.rows.forEach((r, i) => {
      if (r.length !== SCREEN_W) throw new Error(`Area ${def.id} screen ${key} row ${i} has ${r.length} tiles, expected ${SCREEN_W}`);
    });
  }
  areas.set(def.id, def);
  return def;
}

export const getArea = (id) => areas.get(id) ?? null;

export const allAreas = () => [...areas.values()];
