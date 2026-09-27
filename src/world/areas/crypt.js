// Cairn Crypt: four dim rooms behind the doorway in the Cairn Ridge cliffs.
// Rooms follow art bible section 9 (see areas.js, "Rooms"): 16 x 12 tiles,
// walls on rows 0 and 11 and columns 0 and 15, doors two tiles wide in the
// middle of a wall (columns 7-8, rows 5-6), lined up between neighbours.
//
//   Key Vault (0,0)      Treasure Chamber (1,0)
//        | door                | locked door
//   Sunken Gate (0,1) -- Pillar Hall (1,1)
//        | stairs out to Cairn Ridge
//
// It sits in the dungeon columns of the global grid (origin [200, 0], see
// "Global regions" in docs/ARCHITECTURE.md).
// Tiles: see world/tiles/dungeon.js. Markers: e = blue slime, o = spitter,
// K = the small key (taken once).
import { registerArea } from '../areas.js';

export default registerArea({
  id: 'crypt',
  name: 'Cairn Crypt',
  tileset: 'dungeon',
  lighting: 'crypt',
  camera: 'dungeon',
  screen: [16, 12],
  rooms: true,
  origin: [200, 0],
  start: [0, 1],
  keyGroup: 'crypt',
  spawns: {
    e: { type: 'slime', variant: 'blue' },
    o: 'spitter',
    K: { type: 'key', once: true },
  },
  warps: {
    // The stairs in the Sunken Gate's south doorway lead back out to the
    // doorway on Cairn Ridge.
    X: { area: 'overworld', screen: [1, 0], x: 8, z: 1.7, yaw: 0 },
  },
  screens: {
    '0,1': {
      name: 'Sunken Gate',
      rows: [
        'WWWWWWW..WWWWWWW',
        'W.F..........F.W',
        'W..S........S..W',
        'W..............W',
        'W.....e........W',
        'W...............',
        'W........e......',
        'W..............W',
        'W..............W',
        'W..S........S..W',
        'W..............W',
        'WWWWWWWXXWWWWWWW',
      ],
    },
    '1,1': {
      name: 'Pillar Hall',
      rows: [
        'WWWWWWWLLWWWWWWW',
        'W.F..........F.W',
        'W..............W',
        'W..SS......SS..W',
        'W....o.........W',
        '...............W',
        '...............W',
        'W.........o....W',
        'W..SS......SS..W',
        'W..............W',
        'W.F..........F.W',
        'WWWWWWWWWWWWWWWW',
      ],
    },
    '0,0': {
      name: 'Key Vault',
      rows: [
        'WWWWWWWWWWWWWWWW',
        'W.F..........F.W',
        'W..~~~~..~~~~..W',
        'W..~........~..W',
        'W..~.e....e.~..W',
        'W..~...K....~..W',
        'W..~........~..W',
        'W..~~~~..~~~~..W',
        'W......o.......W',
        'W..............W',
        'W..............W',
        'WWWWWWW..WWWWWWW',
      ],
    },
    '1,0': {
      name: 'Treasure Chamber',
      chest: 'heart-container',
      rows: [
        'WWWWWWWWWWWWWWWW',
        'W.F..........F.W',
        'W....e....e....W',
        'W...S......S...W',
        'W..............W',
        'W......C.......W',
        'W..............W',
        'W..............W',
        'W...S......S...W',
        'W..............W',
        'W.F..........F.W',
        'WWWWWWW..WWWWWWW',
      ],
    },
  },
});
