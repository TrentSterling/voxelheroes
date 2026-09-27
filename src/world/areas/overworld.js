// The overworld: six 16 x 11 screens laid out on a grid, in the overworld
// columns of the global grid (origin [0, 0]). Tiles: see world/tiles/overworld.js.
// Spawn markers: e = slime, o = spitter (both stand on grass).
import { registerArea } from '../areas.js';

export default registerArea({
  id: 'overworld',
  name: 'Overworld',
  tileset: 'overworld',
  lighting: 'day',
  // no camera: the player's chosen preset (state.settings.camera)
  origin: [0, 0],
  start: [1, 1],
  spawns: { e: 'slime', o: 'spitter' },
  warps: {
    // The doorway in the Cairn Ridge cliffs leads into the crypt: the hero
    // arrives just inside the Sunken Gate's south doorway, above the stairs.
    D: { area: 'crypt', screen: [0, 1], x: 8, z: 10.4, yaw: Math.PI },
  },
  screens: {
    '0,0': {
      name: 'Whisperwood',
      rows: [
        'TTTTTTTTTTTTTTTT',
        'TT..,...T....,.T',
        'T..B..e...TT...T',
        'T.....TT.......T',
        'T.,.......B..e..',
        'T...TT.........p',
        'T......,..TT....',
        'T.B...o.......,.',
        'T.......TT.....T',
        'TT..,.........TT',
        'TTTTTTT..TTTTTTT',
      ],
    },
    '1,0': {
      name: 'Cairn Ridge',
      rows: [
        '#######DD#######',
        '#RR..........RR#',
        '#.....R...o....#',
        '#..R.......R...#',
        '....s.......R...',
        'pppppppppppppppp',
        '...s...e........',
        '.....R.....RR...',
        '#R........o...R#',
        '##R...pppp...RR#',
        '######pppp######',
      ],
    },
    '2,0': {
      name: 'Mirror Lake',
      rows: [
        'TTTTTTTTTTTTTTTT',
        'T~~~~~~~~~~~~~~T',
        'T~~~~~~~~~~~~~~T',
        'T~~~~ss~~~~~~~sT',
        '.sss~~~ss~~~ssBT',
        'ppsss.s..sss.s.T',
        '..s.e..~~~..o..T',
        '.....B.~~~.....T',
        'T..,...........T',
        'TT.,...B...,..TT',
        'TTTTTT....TTTTTT',
      ],
    },
    '0,1': {
      name: 'Bloom Meadow',
      rows: [
        'TTTTTTT..TTTTTTT',
        'T,,,.....,,,,..T',
        'T,B,..,,....,,.T',
        'T.,,..e...,,...T',
        'T....,,,....B...',
        'T.,,..........pp',
        'T...,,..o..,,...',
        'T.B......,,....T',
        'T,,..,,..B...,,T',
        'T..,,...,,,..,,T',
        'TTTTTTTTTTTTTTTT',
      ],
    },
    '1,1': {
      name: 'Crossroads',
      rows: [
        'TTTTTTppppTTTTTT',
        'T.....pppp.....T',
        'T.,B..pppp..B,.T',
        'T.....pppp.....T',
        '......pppp......',
        'pppppppppppppppp',
        '......pppp......',
        'T..B..pppp..B..T',
        'T.,...pppp...,.T',
        'T.....pppp.....T',
        'TTTTTTTTTTTTTTTT',
      ],
    },
    '2,1': {
      name: 'Rattlestone Hollow',
      rows: [
        'TTTTTT....TTTTTT',
        'T.....pppp....RT',
        'T.R..........R.T',
        'T....e...R.....T',
        '.......R.....o.T',
        'pppppp.........T',
        '.........e.....T',
        'T..RR.......R..T',
        'T.......o......T',
        'TR....R......RRT',
        'TTTTTTTTTTTTTTTT',
      ],
    },
  },
});
