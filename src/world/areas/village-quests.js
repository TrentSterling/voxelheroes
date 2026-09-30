import { registerArea } from '../areas.js';
import { registerPlace } from '../../game/places.js';

registerArea({
  id: 'cellar-tobin', name: 'Tobin\'s Root Cellar', kind: 'cave',
  tileset: 'root-cellar', lighting: 'crypt', camera: 'interior', rooms: true,
  screen: [12, 10], at: [300 * 16, 75],
  warps: { X: { area: 'v1', screen: [1, 1], x: 14.5, z: 8.6, yaw: 0 } },
  screens: {
    '0,0': {
      name: 'Tobin\'s Root Cellar', chest: 'tobin-keepsake', potSeal: [6, 2],
      rows: [
        'WWWWWWWWWWWW',
        'W..F....F..W',
        'W..........W',
        'W..........W',
        'W..........W',
        'W.....j....W',
        'W..........W',
        'W.&......v.W',
        'W..........W',
        'WWWWWXXWWWWW',
      ],
    },
  },
});

registerPlace({ id: 'cellar-tobin', name: 'Tobin\'s Root Cellar', kind: 'cave', order: 61,
  spot: { area: 'v1', screen: [1, 1], x: 14.5, z: 7.5, yaw: 0 }, area: 'cellar-tobin' });
