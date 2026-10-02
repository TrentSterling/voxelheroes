import { registerArea } from '../areas.js';
import { registerPlace } from '../../game/places.js';

const woods = {
  tileset: 'whisperwood', lighting: 'day', camera: 'A', screen: [16, 16],
  groundPalette: { grass: [0x4f9168, 0x408152, 0x579777] },
  foliage: { leaf: 0x3f8866, leafDark: 0x2d674c, leafSpeck: 0x9cc99a },
};
export const FOREST_RETURN = { area: 'forest', screen: [1, 0], x: 8, z: 6, yaw: 0 };
export const D2_EXIT = { area: 'lost-woods', screen: [4, 0], x: 8, z: 6, yaw: 0 };
export const D2_ENTRANCE = { area: 'd2', screen: [2, 4], x: 8, z: 10.3, yaw: Math.PI };

// Replace only ordinary ground. Scenery, actors, loot and every maze passage
// retain their authored positions. Each clearing has its own ground motif.
const woodlandGround = (rows,theme) => rows.map((row,z)=>[...row].map((ch,x)=>{
  if(ch==='p')return (theme===1&&z>=4&&z<=9)||(theme===2&&z<9)||theme===5||theme===7?'c':'o';
  if(ch!=='.'||x===0||z===0||x===15||z===15)return ch;
  if(theme===6)return (x+z)%3===0?'h':(x*2+z)%5===0?'a':ch;
  if(theme===7)return z>=6&&z<=11&&(x===6||x===10)?'a':(x+z)%5===0?'h':ch;
  if(theme===5&&x>=6&&x<=10&&z>=6&&z<=10)return x===8||z===8?'c':'o';
  if(theme===2&&z>=5&&z<=9&&x>=6&&x<=10)return 'a';
  return (x*3+z+theme)%7<2?'h':ch;
}).join(''));

registerArea({
  ...woods, id: 'forest', name: 'Whisperwood', kind: 'overworld', origin: [9, 0], start: [1, 2],
  spawns: { G: { type: 'group', of: ['buzzer', 'hopper'], count: [2, 3] } },
  screens: {
    '1,2': {
      name: 'Northwood Trail',
      spawnsAt: { '11,11': { type: 'npc', name: 'Forester Fen', palette: { tunic: 0x496953, cap: 0xb99d63 }, lines: ['The hive is beyond the tangled wood. Watch for its golden wings.', 'The paths repeat. From the carved stone: north, west, east, north. A wrong turn brings you back.'] } },
      rows: woodlandGround(['TTTTTT....TTTTTT','TTTT...pp...TTTT','TTT....pp....TTT','TT..B..pp..B..TT','T......pp......T','T..G...pp..R...T','T..RR..pp......T','T......pp..,,..T','T.B....pp..,,..T','T......pp..G...T','T..,,..pp......T','T..,,..pp......T','TT.....pp.....TT','TTT....pp....TTT','TTTT...pp...TTTT','TTTpppppppTTTTTT'],0),
    },
    '1,1': {
      name: 'Mothwater Crossing',
      rows: woodlandGround(['TTTTTT....TTTTTT','TT.....pp.....TT','T...B..pp..B...T','T......pp......T','T.G.~~~pp~~~...T','T..~~~~pp~~~~..T','T..~~~~pp~~~~..T','T..~~~~pp~~~~..T','T..~~~~pp~~~~..T','T...~~~pp~~~.G.T','T......pp......T','T.B....pp......T','T...RR.pp..B...T','T......pp......T','TT.....pp.....TT','TTTTTT....TTTTTT'],1),
    },
    '1,0': {
      name: 'Carved Stone Clearing',
      warps: { j: { area: 'lost-woods', screen: [0, 0], x: 8, z: 12, yaw: Math.PI } },
      spawnsAt: { '5,6': { type: 'forest-stone' } },
      chests: { '12,10': { grant: 'coins', amount: 45 } },
      rows: woodlandGround(['TTTTTTTTTTTTTTTT','TTTT........TTTT','TTT..........TTT','TT......j.....TT','T......pp......T','T..B...pp..B...T','T......pp......T','T..G...pp..G...T','T......pp......T','T...RR.pp......T','T......pp...C..T','T..,,,pppp.....T','T..,,,pppp..B..T','TT....pppp....TT','TTT...pppp...TTT','TTTTTT....TTTTTT'],2),
    },
  },
});

// Each fork is a real room. Explicit edge warps make wrong turns repeat the
// first clearing while friends can take different paths through the wood.
const route = ['n', 'w', 'e', 'n'];
const directions = { n: [8, 0], e: [15, 8], s: [8, 15], w: [0, 8] };
const names = ['The First Wind', 'Leaning Oaks', 'Split Root', 'Golden Leaves', 'Amber Gate'];
const screens = {};
for (let i = 0; i < 5; i++) {
  const rows = Array.from({ length: 16 }, (_, z) => Array.from({ length: 16 }, (_, x) => x === 0 || x === 15 || z === 0 || z === 15 ? 'T' : '.'));
  const warps = {};
  if (i < 4) {
    for (const [dir, [x, z]] of Object.entries(directions)) {
      rows[z][x] = 'j';
      for (let k = 1; k < 5; k++) rows[z === 0 ? k : z === 15 ? 15-k : 8][x === 0 ? k : x === 15 ? 15-k : 8] = 'p';
      warps[`${x},${z}`] = { area: 'lost-woods', screen: [dir === route[i] ? i + 1 : 0, 0], x: 8, z: 11, yaw: Math.PI };
    }
    rows[13][2] = 'j'; warps['2,13'] = FOREST_RETURN;
    rows[4][4] = 'T'; rows[5][4] = 'T'; rows[4][11] = 'T'; rows[5][11] = 'T';
    rows[10][4] = 'B'; rows[10][11] = 'B'; rows[3][8] = 'G';
  } else {
    rows[3][8] = 'j'; warps['8,3'] = D2_ENTRANCE;
    rows[15][8] = 'j'; warps['8,15'] = FOREST_RETURN;
    for (let z = 4; z < 15; z++) rows[z][8] = 'p';
    rows[8][4] = 'v'; rows[8][11] = 'v';
  }
  screens[`${i},0`] = { name: names[i], rows: woodlandGround(rows.map(r => r.join('')),i+3), warps };
}
registerArea({ ...woods, id: 'lost-woods', name: 'The Tangled Wood', kind: 'cave', rooms: true, at: [312 * 16, 0], start: [0,0], entrance: FOREST_RETURN, spawns: { G: { type: 'group', of: ['buzzer'], count: [1, 2] } }, screens });
registerPlace({ id: 'forest', name: 'Whisperwood', kind: 'other', order: 30, area: 'forest', spot: FOREST_RETURN });
