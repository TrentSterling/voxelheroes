// Overworld screens, 16 x 11 tiles each, laid out on a grid like the SNES
// Zelda overworld. Legend:
//   .  grass        ,  flowers        p  dirt path     s  sand
//   T  tree         R  boulder        #  cliff         ~  water
//   B  bush (cut it with the sword)
//   D  crypt entrance (cliff doorway)
//   e  slime spawn  o  spitter spawn  (both stand on grass)
//
// Dungeon rooms (dark: true) reuse the same grid far south of the overworld:
//   .  floor        W  wall           S  stone pillar  F  brazier
//   L  locked door  C  chest          K  small key     X  stairs out

export const SCREEN_W = 16;
export const SCREEN_H = 11;

export const START_SCREEN = [1, 1];

export const SCREENS = {
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

  // ---- Cairn Crypt, entered through the doorway on Cairn Ridge
  '0,11': {
    name: 'Sunken Gate',
    dark: true,
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
  '1,11': {
    name: 'Pillar Hall',
    dark: true,
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
  '0,10': {
    name: 'Key Vault',
    dark: true,
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
  '1,10': {
    name: 'Treasure Chamber',
    dark: true,
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
};

// Where each warp tile sends the hero: tile coords within the target screen.
export const WARPS = {
  D: { sx: 0, sy: 11, x: 8, z: 8.4, yaw: Math.PI },
  X: { sx: 1, sy: 0, x: 8, z: 1.7, yaw: 0 },
};

for (const [key, s] of Object.entries(SCREENS)) {
  if (s.rows.length !== SCREEN_H) throw new Error(`Screen ${key} has ${s.rows.length} rows`);
  s.rows.forEach((r, i) => {
    if (r.length !== SCREEN_W) throw new Error(`Screen ${key} row ${i} has ${r.length} tiles`);
  });
}
