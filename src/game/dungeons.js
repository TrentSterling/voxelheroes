// Dungeons: one file per dungeon in src/dungeons/ (dungeon stream), plus the
// progress every other stream asks about: the map, the boss key, colored
// keys, the boss, the orb.
//
//   registerDungeon({
//     id: 'd1',                            // the place id (gameplay spec Appendix B)
//     number: 1,                           // orb number and boss-pay index; 0 for test dungeons
//     name: 'Hollow Barrow',
//     areas: ['d1', 'd1-boss'],            // every area that belongs to it (floors, the boss arena)
//     entrance: { area: 'd1', screen: [3, 9], x: 8, z: 10.4, yaw: Math.PI },
//     exit: { area: 'overworld', screen: [2, 3], x: 8, z: 6.5, yaw: 0 },   // outside its door
//     keyGroup: 'd1',                      // small keys (default: the first area's keyGroup, else id)
//     boss: 'boss-serpent',                // the boss's id (foes-dungeon)
//     tool: 'boomerang', smallKeys: 4,     // for menus and checks
//     music: 'dungeon-1',                  // music id (game/music.js)
//     canvas: [8, 10], floors: 1,          // the dungeon map's grid (gameplay spec 6.1)
//     bossRoom: 'd1-boss:0,0',             // screen id the map item marks (spec 4.6)
//   });
//
// The entrance is where a hero who falls inside gets up and where a save
// made inside loads (spec 6.7, 11). feat/world gives areas an `entrance`
// field; when the dungeon's first area has one, it wins over `entrance` here.
//
// Progress lives in state.flags with the spec's names (Appendix B; P1.5
// names the boss flag by dungeon, boss:d1):
//   dungeon:<id>:map, dungeon:<id>:bosskey, boss:<id>, orb:<n>,
// plus dungeon:<id>:entered, dungeon:<id>:complete and dungeon:<id>:portal;
// the dungeon stream adds dungeon:<id>:door:<room>:<side> for opened doors
// (room as roomLabel gives it, side n, e, s or w).
// Colored keys are counts in state.colorKeys (the master key opens every
// colored lock and is never spent).
//
// Grants (chests, shops): map, key-boss (the current dungeon's), key-red,
// key-blue, key-green, key-master, orb-1 .. orb-6.
//
// Map data: dungeonRooms(id) lists every room with its map label (spec 3:
// row letter A-J from the north, column 1-8 from the west, 'J-4'), its floor
// and whether it was visited; the dungeon map (ui) draws visited rooms, and
// every room plus the boss mark once hasMap(id).
//
// Events: 'dungeon-enter' { id, via: 'door' | 'start' } and 'dungeon-leave'
// { id } when the hero crosses into or out of a dungeon's areas ('start':
// the first screen after the page loaded); 'boss-defeated' from defeatBoss;
// 'dungeon-complete' from completeDungeon.
import { state, hasFlag, setFlag } from '../core/state.js';
import { emit } from '../core/events.js';
import { TUNING } from '../core/tuning.js';
import { world, currentScreen } from '../world/world.js';
import { getArea } from '../world/areas.js';
import { registerGrant } from '../systems/grants.js';
import { keyCount } from '../systems/keys.js';
import { registerRespawnRule, onAreaChange, hasVisited, screenId, fullSpot } from './places.js';
import './fields.js';

export const COLORS = ['red', 'blue', 'green'];

const dungeons = new Map();
const byArea = new Map(); // area id -> dungeon

export function registerDungeon(def) {
  if (!def?.id) throw new Error('registerDungeon: a dungeon needs an id');
  if (dungeons.has(def.id)) throw new Error(`Dungeon "${def.id}" is already registered`);
  if (!Array.isArray(def.areas) || !def.areas.length) throw new Error(`Dungeon "${def.id}" needs areas: [areaId, ...]`);
  for (const a of def.areas) if (byArea.has(a)) throw new Error(`Area "${a}" already belongs to dungeon "${byArea.get(a).id}"`);
  const full = { name: def.id, number: 0, boss: null, bossRoom: null, tool: null, smallKeys: 0, music: null, canvas: [8, 10], floors: 1, entrance: null, exit: null, ...def };
  dungeons.set(def.id, full);
  for (const a of def.areas) byArea.set(a, full);
  return full;
}

export const getDungeon = (id) => dungeons.get(id) ?? null;
export const allDungeons = () => [...dungeons.values()].sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
export const dungeonOfArea = (areaId) => byArea.get(areaId) ?? null;
export const dungeonByNumber = (n) => allDungeons().find((d) => d.number === n) ?? null;
export const currentDungeon = () => dungeonOfArea(currentScreen()?.area?.id);

function need(id) {
  const d = typeof id === 'object' && id ? id : getDungeon(id ?? currentDungeon()?.id);
  if (!d) throw new Error(id ? `Unknown dungeon "${id}"` : 'Not in a dungeon');
  return d;
}

export function dungeonKeyGroup(id) {
  const d = need(id);
  const area = getArea(d.areas[0]);
  return d.keyGroup ?? area?.keyGroup ?? d.areas[0];
}

// The entrance spot, filled in (null if it names nothing).
export function dungeonEntrance(id) {
  const d = need(id);
  const area = getArea(d.areas[0]);
  const spot = area?.entrance ? { area: area.id, ...area.entrance } : d.entrance ?? { area: d.areas[0] };
  return fullSpot(spot);
}

export const dungeonExit = (id) => (need(id).exit ? fullSpot(need(id).exit) : null);

// ---------------------------------------------------------------- progress
const flag = (d, what) => `dungeon:${d.id}:${what}`;

export function dungeonProgress(id) {
  const d = need(id);
  return {
    id: d.id,
    entered: hasFlag(flag(d, 'entered')),
    map: hasFlag(flag(d, 'map')),
    bossKey: hasFlag(flag(d, 'bosskey')),
    boss: hasFlag(`boss:${d.id}`),
    complete: hasFlag(flag(d, 'complete')),
    portal: hasFlag(flag(d, 'portal')),
    keys: keyCount(dungeonKeyGroup(d)),
  };
}

export const hasMap = (id) => hasFlag(flag(need(id), 'map'));
export const hasBossKey = (id) => hasFlag(flag(need(id), 'bosskey'));
export const isComplete = (id) => hasFlag(flag(need(id), 'complete'));
export const bossDefeated = (id) => hasFlag(`boss:${need(id).id}`);
export const orbs = () => [1, 2, 3, 4, 5, 6].filter((n) => hasFlag(`orb:${n}`));

export function giveMap(id) {
  setFlag(flag(need(id), 'map'));
}

export function giveBossKey(id) {
  setFlag(flag(need(id), 'bosskey'));
}

// The retry portal between the antechamber and the entrance (spec 6.1).
export function openPortal(id) {
  setFlag(flag(need(id), 'portal'));
}

// The boss is down (foes-dungeon calls this when it bursts). The first time,
// the fight pays a heart container and TUNING.economy.bossPay[number - 1]
// coins; a re-fight pays the coins only. Sets boss:<dungeon id>. Returns
// { heartContainer, coins } for the caller to drop.
export function defeatBoss(id, { refight } = {}) {
  const d = need(id);
  const again = refight ?? hasFlag(`boss:${d.id}`);
  setFlag(`boss:${d.id}`);
  emit('boss-defeated', { id: d.boss, dungeon: d.id, refight: again });
  return { heartContainer: !again, coins: TUNING.economy.bossPay[d.number - 1] ?? 0 };
}

// The orb is taken: the dungeon is done.
export function completeDungeon(id) {
  const d = need(id);
  if (hasFlag(flag(d, 'complete'))) return false;
  setFlag(flag(d, 'complete'));
  if (d.number > 0) setFlag(`orb:${d.number}`);
  emit('dungeon-complete', { id: d.id, orb: d.number || null });
  return true;
}

// A room's place on the dungeon map from its local screen [i, j]: floor f
// holds local rows (rows + 1) f to (rows + 1) f + rows - 1 (one empty row
// between floors, as feat/world lays dungeons out); the label is the row
// letter and the column number, 'J-4' (null outside the canvas).
const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function roomLabel([i, j], canvas = [8, 10]) {
  const [cols, rows] = canvas;
  const floor = Math.floor(j / (rows + 1));
  const r = j - floor * (rows + 1);
  const room = i >= 0 && i < cols && r < rows ? `${ROW_LETTERS[r]}-${i + 1}` : null;
  return { floor, room };
}

// Rooms of a dungeon for its map screen, by floor then key:
// [{ key, area, screen: [i, j], name, room: 'B-1', floor, visited, boss }].
// Only rooms of the dungeon's first area are on the canvas; rooms of its
// other areas (a boss arena that is an area of its own) have room null and
// floor 0, and boss is true for the def's bossRoom.
export function dungeonRooms(id) {
  const d = need(id);
  const out = [];
  for (const s of world.screens.values()) {
    if (!d.areas.includes(s.area.id)) continue;
    const key = screenId(s);
    const { floor, room } = s.area.id === d.areas[0] ? roomLabel([s.lx, s.ly], d.canvas) : { floor: 0, room: null };
    out.push({ key, area: s.area.id, screen: [s.lx, s.ly], name: s.name, room, floor, visited: hasVisited(s), boss: key === d.bossRoom });
  }
  return out.sort((a, b) => a.floor - b.floor || a.key.localeCompare(b.key));
}

// ---------------------------------------------------------------- colored keys
export const colorKeyCount = (color) => state.colorKeys[color] ?? 0;
export const hasMasterKey = () => !!state.colorKeys.master;

export function addColorKey(color, n = 1) {
  if (!COLORS.includes(color)) throw new Error(`Unknown key color "${color}" (${COLORS.join(', ')})`);
  state.colorKeys[color] = Math.max(0, colorKeyCount(color) + n);
  emit('keys-changed', { group: color, count: state.colorKeys[color], delta: n });
}

// A colored lock: true if it opens (spends a key of that color unless the
// hero has the master key).
export function useColorKey(color) {
  if (!COLORS.includes(color)) throw new Error(`Unknown key color "${color}"`);
  if (hasMasterKey()) return true;
  if (colorKeyCount(color) <= 0) return false;
  addColorKey(color, -1);
  return true;
}

// ---------------------------------------------------------------- grants
// map and key-boss belong to the dungeon the hero is in (or ctx.dungeon:
// grant({ grant: 'map', dungeon: 'd1' })).
function forDungeon(what, ctx, fn) {
  const d = getDungeon(ctx.dungeon) ?? currentDungeon();
  if (d) fn(d.id);
  else console.warn(`grant("${what}"): not in a dungeon`);
}
registerGrant('map', (n, ctx) => forDungeon('map', ctx, giveMap), { name: 'Dungeon Map', fanfare: true, kind: 'key' });
registerGrant('key-boss', (n, ctx) => forDungeon('key-boss', ctx, giveBossKey), { name: 'Boss Key', fanfare: true, kind: 'key' });
registerGrant('key-red', (n) => addColorKey('red', n), { name: 'Red Key', fanfare: true, kind: 'key' });
registerGrant('key-blue', (n) => addColorKey('blue', n), { name: 'Blue Key', fanfare: true, kind: 'key' });
registerGrant('key-green', (n) => addColorKey('green', n), { name: 'Green Key', fanfare: true, kind: 'key' });
registerGrant(
  'key-master',
  () => {
    state.colorKeys.master = true;
    emit('keys-changed', { group: 'master', count: 1, delta: 1 });
  },
  { name: 'Master Key', fanfare: true, kind: 'key' }
);
for (let n = 1; n <= 6; n++)
  registerGrant(
    `orb-${n}`,
    () => {
      const d = dungeonByNumber(n);
      if (d) completeDungeon(d);
      else setFlag(`orb:${n}`);
    },
    { name: 'Orb', fanfare: true, kind: 'orb' }
  );

// ---------------------------------------------------------------- where the hero is
// Falling inside a dungeon, or loading a save made inside one, puts the hero
// at its entrance (spec 6.7, 11).
registerRespawnRule('dungeons', ({ area }) => {
  const d = dungeonOfArea(area);
  return d ? dungeonEntrance(d) : null;
});

onAreaChange((area, prev) => {
  const now = dungeonOfArea(area?.id);
  const was = dungeonOfArea(prev?.id);
  if (now === was) return;
  if (was) emit('dungeon-leave', { id: was.id });
  if (now) {
    setFlag(flag(now, 'entered'));
    emit('dungeon-enter', { id: now.id, via: prev ? 'door' : 'start' });
  }
});
