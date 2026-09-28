// Test areas of the items-and-foes stream (CONTRACTS 10: 410-419 the
// overworld enemy field, 420-429 dungeon enemy and boss rooms, 430-439 the
// item range), reached only by teleport from scripts/scenarios/foes.mjs.
//
//   test-foes-field   one 16 x 16 overworld screen of open grass (column 410)
//   test-foes-rooms   two 16 x 12 dungeon rooms (columns 420-421)
//   test-foes-arena   a 22 x 16 boss arena (placed by tile at column 423)
//                     with boss-serpent and its tombstone (dungeon
//                     'test-foes': the scenario registers it, number 1, so
//                     the arena pays D1's container and coins)
//   test-foes-range   one 16 x 16 screen for the tools (column 430)
import { registerArea } from '../areas.js';

const ring = (w, h, marks = {}, wall = 'T', floor = '.') => {
  const rows = [];
  for (let z = 0; z < h; z++) {
    let row = '';
    for (let x = 0; x < w; x++) row += marks[`${x},${z}`] ?? (x === 0 || z === 0 || x === w - 1 || z === h - 1 ? wall : floor);
    rows.push(row);
  }
  return rows;
};

registerArea({
  id: 'test-foes-field',
  name: 'Foe Field',
  kind: 'overworld',
  tileset: 'overworld',
  lighting: 'day',
  screen: [16, 16],
  origin: [410, 0],
  start: [0, 0],
  screens: { '0,0': { name: 'Foe Field', rows: ring(16, 16) } },
});

registerArea({
  id: 'test-foes-range',
  name: 'Tool Range',
  kind: 'overworld',
  tileset: 'overworld',
  lighting: 'day',
  screen: [16, 16],
  origin: [430, 0],
  start: [0, 0],
  screens: { '0,0': { name: 'Tool Range', rows: ring(16, 16, { '12,4': 'R', '12,5': 'R', '12,6': 'R' }) } },
});

registerArea({
  id: 'test-foes-rooms',
  name: 'Foe Rooms',
  kind: 'dungeon',
  tileset: 'dungeon',
  lighting: 'crypt',
  camera: 'dungeon',
  screen: [16, 12],
  rooms: true,
  origin: [420, 0],
  start: [0, 0],
  screens: {
    '0,0': { name: 'Foe Room West', rows: ring(16, 12, {}, 'W') },
    '1,0': { name: 'Foe Room East', rows: ring(16, 12, {}, 'W') },
  },
});

registerArea({
  id: 'test-foes-arena',
  name: 'Coil Arena',
  kind: 'dungeon',
  tileset: 'dungeon',
  lighting: 'crypt',
  camera: 'boss',
  screen: [22, 16],
  rooms: true,
  at: [423 * 16, 0],
  start: [0, 0],
  spawns: {
    t: { type: 'boss-tombstone', dungeon: 'test-foes' },
  },
  screens: { '0,0': { name: 'Coil Arena', rows: ring(22, 16, { '11,12': 't' }, 'W') } },
});
