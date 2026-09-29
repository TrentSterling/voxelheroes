// Four small secret caves (fun audit item 2: every combat screen earns a find), one room each,
// stacked in the same free column cave-barrow already uses (world/areas/slice.js, x = 300 * 16),
// spaced 15 rows apart (each room is 9 tall) so none overlap. Each pays a heart piece: with the
// two already in the game (cave-barrow, Barrow Meadow) and D1's two (Red Vault, the Buried Vault),
// that is eight, the fun audit's floor. A cracked rock (a bomb) or a stair-bush (the sword) in the
// overworld screen hides the way in; world/tiles/overworld.js has both.
import { registerArea } from '../areas.js';

// The room every one of these caves shares: statues either side, the chest in the middle, braziers
// at the back, the same south stairs cave-barrow uses.
const room = (name, guarded) => ({
  '0,0': {
    name,
    chest: 'heart-piece',
    ...(guarded ? { spawnsAt: { '6,2': { type: 'guardian', wander: 1 } } } : {}),
    rows: [
      'WWWWWWWWWWWW',
      'W..........W',
      'W..S....S..W',
      'W..........W',
      'W....c.....W',
      'W..........W',
      'W..F....F..W',
      'W..........W',
      'WWWWWXXWWWWW',
    ],
  },
});

registerArea({
  id: 'cave-crownhold-1',
  name: 'Pasture Hollow',
  kind: 'cave',
  tileset: 'dungeon',
  lighting: 'crypt',
  camera: 'interior',
  rooms: true,
  screen: [12, 9],
  at: [300 * 16, 15],
  warps: { X: { area: 'ow-4-3', screen: [2, 0], x: 7.5, z: 5.5, yaw: Math.PI } },
  screens: room('Pasture Hollow', true),
});

registerArea({
  id: 'cave-crownhold-2',
  name: 'Sunken Nook',
  kind: 'cave',
  tileset: 'dungeon',
  lighting: 'crypt',
  camera: 'interior',
  rooms: true,
  screen: [12, 9],
  at: [300 * 16, 30],
  warps: { X: { area: 'ow-4-3', screen: [0, 2], x: 3.5, z: 7.5, yaw: Math.PI } },
  screens: room('Sunken Nook', false),
});

registerArea({
  id: 'cave-barrowfield-1',
  name: 'Stump Hollow',
  kind: 'cave',
  tileset: 'dungeon',
  lighting: 'crypt',
  camera: 'interior',
  rooms: true,
  screen: [12, 9],
  at: [300 * 16, 45],
  warps: { X: { area: 'ow-3-2', screen: [2, 0], x: 8.5, z: 4.5, yaw: Math.PI } },
  screens: room('Stump Hollow', true),
});

registerArea({
  id: 'cave-barrowfield-2',
  name: 'Roadside Nook',
  kind: 'cave',
  tileset: 'dungeon',
  lighting: 'crypt',
  camera: 'interior',
  rooms: true,
  screen: [12, 9],
  at: [300 * 16, 60],
  warps: { X: { area: 'ow-3-2', screen: [2, 1], x: 4.5, z: 11.5, yaw: Math.PI } },
  screens: room('Roadside Nook', false),
});
