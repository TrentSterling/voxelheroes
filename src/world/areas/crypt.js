// Cairn Crypt: four dim rooms behind the doorway in the Cairn Ridge cliffs.
// It sits far south of the overworld in the global grid (origin [0, 10]).
// Tiles: see world/tiles/dungeon.js. Markers: e = blue slime, o = spitter,
// K = the small key (taken once).
import { registerArea } from '../areas.js';

export default registerArea({
  id: 'crypt',
  name: 'Cairn Crypt',
  tileset: 'dungeon',
  lighting: 'crypt',
  camera: 'dungeon',
  origin: [0, 10],
  start: [0, 1],
  keyGroup: 'crypt',
  spawns: {
    e: { type: 'slime', variant: 'blue' },
    o: 'spitter',
    K: { type: 'key', once: true },
  },
  warps: {
    // The stairs lead back out to the doorway on Cairn Ridge.
    X: { area: 'overworld', screen: [1, 0], x: 8, z: 1.7, yaw: 0 },
  },
  screens: {
    '0,1': {
      name: 'Sunken Gate',
      rows: [
        'WWWWWWW..WWWWWWW',
        'WF............FW',
        'W..S........S..W',
        'W..............W',
        'W.....e........W',
        'W...............',
        'W........e.....W',
        'W..............W',
        'W..S........S..W',
        'W......XX......W',
        'WWWWWWWWWWWWWWWW',
      ],
    },
    '1,1': {
      name: 'Pillar Hall',
      rows: [
        'WWWWWWWLLWWWWWWW',
        'WF............FW',
        'W..............W',
        'W..SS......SS..W',
        'W....o.........W',
        '...............W',
        'W.........o....W',
        'W..SS......SS..W',
        'W..............W',
        'WF............FW',
        'WWWWWWWWWWWWWWWW',
      ],
    },
    '0,0': {
      name: 'Key Vault',
      rows: [
        'WWWWWWWWWWWWWWWW',
        'WF............FW',
        'W..~~~~..~~~~..W',
        'W..~........~..W',
        'W..~.e....e.~..W',
        'W..~...K....~..W',
        'W..~........~..W',
        'W..~~~~..~~~~..W',
        'W......o.......W',
        'W..............W',
        'WWWWWWW..WWWWWWW',
      ],
    },
    '1,0': {
      name: 'Treasure Chamber',
      chest: 'heart-container',
      rows: [
        'WWWWWWWWWWWWWWWW',
        'WF............FW',
        'W....e....e....W',
        'W...S......S...W',
        'W..............W',
        'W......C.......W',
        'W..............W',
        'W...S......S...W',
        'W..............W',
        'WF............FW',
        'WWWWWWW..WWWWWWW',
      ],
    },
  },
});
