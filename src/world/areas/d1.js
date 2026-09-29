// D1, the Old Barrow (dungeon stream; gameplay spec 6.1-6.9 in the
// compact scope: 17 rooms of 16 x 12 on one floor, plus the arena).
// Dungeon 1 sits at global screen [210, 0] (CONTRACTS 10); rooms are named by
// row letter and column ('J-4' is local screen [3, 9]).
//
//                 B-4 reward (reached from the arena)
//                 D-4 antechamber --B--> d1-boss arena
//                  | l#4
//   E-3 kill-all - E-4 four eyes -E- E-5 boss key
//    |              (no door south)
//   F-3 blades     F-4 tablet --r-- F-5 red vault
//    |              | l#3
//   G-3 dark ---l#2- G-4 eye (key)   G-5 boomerang (lock-in, chest)
//                    |                |
//                   H-4 pits ------- H-5 gazers
//                    | l#1
//   I-3 block (key) - I-4 map
//                    |
//                   J-4 entrance --- J-5 kill-all (key)
//
// Four small keys (J-5 kill-all, I-3 push block, G-4 boomerang wall switch,
// E-3 kill-all) for four small-key doors (l); the boomerang in G-5 after a
// lock-in fight; the boss key behind E-4's four eyes (hit them all within
// TUNING.dungeon.wallSwitch s: the boomerang); a red lock (r) on the side
// room; G-3 is dark; the antechamber's floor switch (Z) wakes the portals
// (Y) between it and the entrance. Tiles: world/tiles/dungeon.js and d1.js.
// Markers: s skeleton, b bat, g gazer, t turret, x blade trap, a / d arrow
// traps facing east / west; in the arena q boss-serpent, k its tombstone.
import { registerArea } from '../areas.js';
import { D1_ENTRANCE, D1_EXIT } from './slice.js';

const ENTRANCE = { screen: D1_ENTRANCE.screen, x: D1_ENTRANCE.x, z: D1_ENTRANCE.z, yaw: D1_ENTRANCE.yaw };

registerArea({
  id: 'd1',
  name: 'The Old Barrow',
  kind: 'dungeon',
  tileset: 'dungeon',
  lighting: 'crypt',
  camera: 'dungeon',
  rooms: true,
  origin: [210, 0],
  start: [3, 9],
  entrance: ENTRANCE,
  keyGroup: 'd1',
  spawns: {
    s: 'skeleton',
    b: 'bat',
    g: 'gazer',
    t: 'turret',
    x: 'blade-trap',
    a: { type: 'arrow-trap', dir: 'east' },
    d: { type: 'arrow-trap', dir: 'west' },
  },
  warps: { X: D1_EXIT },
  screens: {
    // J-4
    '3,9': {
      name: "Barrow Mouth",
      tablet: ['Four keys sleep in these halls.', 'What turns in the air comes back to the hand.', 'Wake the four eyes together, and the warden\'s door will know you.'],
      warps: { '12,8': { area: 'd1', screen: [3, 3], x: 4.5, z: 8.5, yaw: 0 } },
      rows: [
        'WWWWWWW..WWWWWWW',
        'W.F..........F.W',
        'W.v............W',
        'W...S......S...W',
        'W......T.......W',
        'W...............',
        'W...............',
        'W...S......S...W',
        'W...........Y..W',
        'W..............W',
        'W.F..........F.W',
        'WWWWWWWXXWWWWWWW',
      ],
    },
    // J-5
    '4,9': {
      name: "Bone Pit",
      clear: 'key',
      keyAt: [8, 6],
      rows: [
        'WWWWWWWWWWWWWWWW',
        'W.F..........F.W',
        'W............v.W',
        'W....s.....s...W',
        'W..............W',
        'H..............W',
        'H.......s......W',
        'W..............W',
        'W...S......S...W',
        'W..............W',
        'W.F..........F.W',
        'WWWWWWWWWWWWWWWW',
      ],
    },
    // I-3
    '2,8': {
      name: "Block Hall",
      puzzle: 'key',
      keyAt: [8, 8],
      rows: [
        'WWWWWWWWWWWWWWWW',
        'W.F..........F.W',
        'W..............W',
        'W..SS......SS..W',
        'W..............W',
        'W....Q...._.....',
        'W...............',
        'W..............W',
        'W..SS......SS..W',
        'W..............W',
        'W.F..........F.W',
        'WWWWWWWWWWWWWWWW',
      ],
    },
    // I-4
    '3,8': {
      name: "Map Hall",
      chest: 'map',
      rows: [
        'WWWWWWWllWWWWWWW',
        'W.F..........F.W',
        'W.v..........v.W',
        'W..S........S..W',
        'W.......c......W',
        '...............W',
        '....b......b...W',
        'W..............W',
        'W..S........S..W',
        'W..............W',
        'W.F..........F.W',
        'WWWWWWW..WWWWWWW',
      ],
    },
    // H-4
    '3,7': {
      name: "Pit Walk",
      rows: [
        'WWWWWWW..WWWWWWW',
        'W..OOOO...OOOO.W',
        'W..OOOO...OOOO.W',
        'W..OO.b....OO..W',
        'W..OO.OOO..OO..W',
        'W.....OOO..b....',
        'W.....OOO.......',
        'W..OO.OOO..OO..W',
        'W..OO..b...OO..W',
        'W..OOOO...OOOO.W',
        'W..OOOO...OOOO.W',
        'WWWWWWW..WWWWWWW',
      ],
    },
    // H-5
    '4,7': {
      name: "Gazer Walk",
      // Reward pacing (fun audit item 5): a coin chest partway through, so the smith is in reach
      // before the boss (most of boss-serpent's coin drop moved here and to Dark Hall below).
      chest: { grant: 'coins', amount: 70 },
      rows: [
        'WWWWWWW..WWWWWWW',
        'W.F..........F.W',
        'W..S..S..S..S..W',
        'W..........g...W',
        'W.v............W',
        '....g..........W',
        '.......c.......W',
        'W..........g...W',
        'W..............W',
        'W..S..S..S..S..W',
        'W.F..........F.W',
        'WWWWWWWWWWWWWWWW',
      ],
    },
    // G-3
    '2,6': {
      name: "Dark Hall",
      lighting: 'dark',
      dark: true,
      // Reward pacing (fun audit item 5): the second of the two chests that carry most of
      // boss-serpent's coin drop (Gazer Walk above holds the other), so it lands mid-dungeon.
      chest: { grant: 'coins', amount: 60 },
      rows: [
        'WWWWWWW..WWWWWWW',
        'W..............W',
        'W..S........S..W',
        'W..............W',
        'W.....s........W',
        'W...............',
        'W.........s.....',
        'W..............W',
        'W..S........S..W',
        'W......c.......W',
        'W..............W',
        'WWWWWWWWWWWWWWWW',
      ],
    },
    // G-4
    '3,6': {
      name: "Eye Hall",
      switches: { opens: 'key' },
      keyAt: [5, 5],
      rows: [
        'WWWWWWWllWwWWWWW',
        'W.F..........F.W',
        'W..............W',
        'W..S........S..W',
        'W..............W',
        'l.........t....W',
        'l..............W',
        'W..............W',
        'W..S........S..W',
        'W..............W',
        'W.F..........F.W',
        'WWWWWWW..WWWWWWW',
      ],
    },
    // G-5
    '4,6': {
      name: "Turning Room",
      clear: 'chest',
      chest: 'boomerang',
      rows: [
        'WWWWWWWWWWWWWWWW',
        'W.F..........F.W',
        'W..............W',
        'W...S......S...W',
        'W..............W',
        'W....s.h..s....W',
        'W..............W',
        'W......b.......W',
        'W...S......S...W',
        'W..............W',
        'W.F..........F.W',
        'WWWWWWWHHWWWWWWW',
      ],
    },
    // F-3
    '2,5': {
      name: "Blade Gallery",
      // A cracked wall backing the real one, no different to look at (buildWall draws the same
      // panel off the room's edge): warps.y is where a bomb sends the hero once it gives way (the
      // vault, in the free columns off the main grid, the way the boss arena sits off it too).
      warps: { y: { area: 'd1-vault', screen: [0, 0], x: 1.5, z: 4.5, yaw: Math.PI / 2 } },
      rows: [
        'WWWWWWW..WWWWWWW',
        'Wx............xW',
        'Wz.............W',
        'W...S.....S....W',
        'W..v...........W',
        'W..............W',
        'W..............W',
        'W..............W',
        'W...S.....S....W',
        'W..............W',
        'Wx............xW',
        'WWWWWWW..WWWWWWW',
      ],
    },
    // F-4
    '3,5': {
      name: "Watchers' Room",
      tablet: ['A red door keeps a heart that was lost here.', 'Red keys are sold far to the east, or found much deeper.'],
      rows: [
        'WWWWWWWWWWWWWWWW',
        'W.F..........F.W',
        'Wa.............W',
        'W..S..S..S..S..W',
        'W..............W',
        'W......T.......r',
        'W..............r',
        'W.v............W',
        'W..S..S..S..S..W',
        'W.............dW',
        'W.F..........F.W',
        'WWWWWWW..WWWWWWW',
      ],
    },
    // F-5
    '4,5': {
      name: "Red Vault",
      chest: 'heart-piece',
      rows: [
        'WWWWWWWWWWWWWWWW',
        'W..............W',
        'W..F........F..W',
        'W..............W',
        'W..............W',
        '........c......W',
        '...............W',
        'W..............W',
        'W..F........F..W',
        'W..............W',
        'W..............W',
        'WWWWWWWWWWWWWWWW',
      ],
    },
    // E-3
    '2,4': {
      name: "Crossed Bones",
      clear: 'key',
      keyAt: [8, 5],
      rows: [
        'WWWWWWWWWWWWWWWW',
        'W.F..........F.W',
        'W.v............W',
        'W...s......s...W',
        'W..............W',
        'W.....b........H',
        'W..............H',
        'W........s.....W',
        'W..............W',
        'W..............W',
        'W.F..........F.W',
        'WWWWWWWHHWWWWWWW',
      ],
    },
    // E-4
    '3,4': {
      name: "Hall of Eyes",
      switches: { opens: 'E' },
      rows: [
        'WWwWWwWllWwWWwWW',
        'W..............W',
        'W..............W',
        'W..S........S..W',
        'W..............W',
        '...............E',
        '...............E',
        'W..............W',
        'W..S........S..W',
        'W..............W',
        'W.F..........F.W',
        'WWWWWWWWWWWWWWWW',
      ],
    },
    // E-5
    '4,4': {
      name: "Warden's Key",
      chest: 'key-boss',
      rows: [
        'WWWWWWWWWWWWWWWW',
        'W.F..........F.W',
        'W.v............W',
        'W..............W',
        'W...S......S...W',
        '........c......W',
        '...............W',
        'W...S......S...W',
        'W..............W',
        'W..............W',
        'W.F..........F.W',
        'WWWWWWWWWWWWWWWW',
      ],
    },
    // D-4
    '3,3': {
      name: "Antechamber",
      warps: { '3,8': { area: 'd1', screen: [3, 9], x: 11.5, z: 8.5, yaw: 0 }, B: { area: 'd1-boss', screen: [0, 0], x: 11, z: 13.5, yaw: Math.PI } },
      rows: [
        'WWWWWWWBBWWWWWWW',
        'W.F..........F.W',
        'W..............W',
        'W..S........S..W',
        'W..............W',
        'W..............W',
        'W.......Z......W',
        'W..............W',
        'W..Y...........W',
        'W..............W',
        'W.F..........F.W',
        'WWWWWWW..WWWWWWW',
      ],
    },
    // B-4
    '3,1': {
      name: "Reward Room",
      chest: 'orb-1',
      spawnsAt: { '4,4': { type: 'npc-sage', spell: 'spell-reveal' } },
      rows: [
        'WWWWWWWWWWWWWWWW',
        'W..............W',
        'W.F..........F.W',
        'W..............W',
        'W.......c......W',
        'W..............W',
        'W..............W',
        'W...S......S...W',
        'W..............W',
        'W..............W',
        'W..............W',
        'WWWWWWWXXWWWWWWW',
      ],
    },
  },
});

// The boss arena, 22 x 16 (art bible 9, the large-room rig), placed by tile
// in D1's free columns (218-219). Its doors (U) stay barred while the boss
// lives: south back to the antechamber, north to the reward room.
registerArea({
  id: 'd1-boss',
  name: 'Coil Pit',
  kind: 'arena',
  tileset: 'dungeon',
  lighting: 'crypt',
  camera: 'boss',
  rooms: true,
  screen: [22, 16],
  at: [218 * 16, 0],
  entrance: { area: 'd1', ...ENTRANCE },
  keyGroup: 'd1',
  spawns: {
    q: { type: 'boss-serpent', dungeon: 'd1' },
    k: { type: 'boss-tombstone', dungeon: 'd1' },
  },
  screens: {
    '0,0': {
      name: 'Coil Pit',
      warps: {
        '10,0': { area: 'd1', screen: [3, 1], x: 8, z: 9.4, yaw: Math.PI },
        '11,0': { area: 'd1', screen: [3, 1], x: 8, z: 9.4, yaw: Math.PI },
        '10,15': { area: 'd1', screen: [3, 3], x: 8, z: 1.8, yaw: 0 },
        '11,15': { area: 'd1', screen: [3, 3], x: 8, z: 1.8, yaw: 0 },
      },
      rows: [
        'WWWWWWWWWWUUWWWWWWWWWW',
        'W....................W',
        'W.F................F.W',
        'W....................W',
        'W..........q.........W',
        'W....S..........S....W',
        'W....................W',
        'W....................W',
        'W....................W',
        'W....................W',
        'W....S..........S....W',
        'W..........k.........W',
        'W....................W',
        'W.F................F.W',
        'W....................W',
        'WWWWWWWWWWUUWWWWWWWWWW',
      ],
    },
  },
});

// The vault behind Blade Gallery's cracked wall (fun audit item 3: a real reward moment). One
// small room, its own column off the main grid the way the boss arena sits off it (free columns
// 216-217; the arena itself starts at 218), reached only through the breach, with the best find in
// the dungeon: a chest granting the blade-warden sword the economy lane registers, plus a heart
// piece so the barrow's total heart pieces clears the fun audit's bar of at least 8 (see
// world/areas/slice.js for the other four).
registerArea({
  id: 'd1-vault',
  name: 'Buried Vault',
  kind: 'cave',
  tileset: 'dungeon',
  lighting: 'crypt',
  camera: 'interior',
  rooms: true,
  screen: [12, 9],
  at: [216 * 16, 0],
  warps: { X: { area: 'd1', screen: [2, 5], x: 2.5, z: 2.5, yaw: Math.PI } },
  screens: {
    '0,0': {
      name: 'Buried Vault',
      chests: { '4,4': 'blade-warden', '9,4': 'heart-piece' },
      rows: [
        'WWWWWWWWWWWW',
        'W..........W',
        'W.S......S.W',
        'W..........W',
        'W...c....c.W',
        'W..........W',
        'W..v....v..W',
        'W..........W',
        'WWWWWXXWWWWW',
      ],
    },
  },
});
