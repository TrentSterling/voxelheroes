import { registerArea } from '../areas.js';
import { GOLD } from '../palette.js';
import { D2_ENTRANCE, D2_EXIT } from './forest.js';

export const HIVE_PALETTE = { ...GOLD, floor: 0x435e50, floorRing: 0x64816a, grout: 0x304c3d, floorUnder: 0x293b30, wall: 0x91a17b, wallDark: 0x657455, mortar: 0x3d513e, trim: 0x386f61, ledge: 0xd5b563 };

// Authored room graph. Gates sit on both sides of their shared edge; bomb
// passages use explicit warps so the breach persists independently of room clears.
const room = (name, doors, props = [], extra = {}) => {
  const rows = Array.from({ length: 12 }, (_, z) => Array.from({ length: 16 }, (_, x) => x === 0 || x === 15 || z === 0 || z === 11 ? 'W' : '.'));
  for (const [side, tile] of Object.entries(doors)) {
    for (const k of [0, 1]) rows[side === 'n' ? 0 : side === 's' ? 11 : 5+k][side === 'w' ? 0 : side === 'e' ? 15 : 7+k] = tile;
  }
  for (const [x,z,tile] of props) rows[z][x] = tile;
  return { name, ...extra, rows: rows.map(r => r.join('')) };
};
const screens = {
  '2,4': room('Rootglass Mouth', { n: '.', e: '.', s: 'X' }, [[4,4,'T'],[12,8,'Y'],[3,7,'v'],[12,4,'v'],[3,2,'F'],[12,2,'F']], {
    tablet: ['The amber queen rests between flights. Her open wings mean: strike.', 'A bomb beneath her crown tips her onto her back. Four seconds to strike; the swarm scatters.', 'Three keys guard the upper hive. The bomb cache waits west of the first locked hall.'],
    warps: { '12,8': { area: 'd2', screen: [2,0], x: 4.5, z: 8.5, yaw: 0 } },
    spawnsAt: { '11,6': 'bomb-supply' },
  }),
  '3,4': room('Broken Patrol', { w: 'H' }, [[5,3,'s'],[11,7,'n'],[5,6,'S'],[10,4,'S'],[3,3,'v'],[12,8,'v']], { clear: 'key', keyAt: [8,7], encounterHint: 'Throw clay at the shield; move out of a raised blade’s path.' }),
  '2,3': room('Fern Cartography', { s: '.', w: '.', n: 'l' }, [[8,4,'c'],[3,3,'F'],[12,3,'F'],[4,8,'v'],[11,8,'v']], { chest: 'map' }),
  '1,3': room('Root Counterweight', { e: '.' }, [[5,7,'Q'],[9,7,'_'],[8,2,'c'],[3,8,'v'], ...Array.from({length:14},(_,i)=>[i+1,4,i===6||i===7?'E':'W'])], { chest: { grant: 'coins', amount: 55 }, puzzle: 'E' }),
  '2,2': room('Sealed Gallery', { s: '.', w: '.', n: 'l', e: 'z' }, [[3,2,'F'],[12,2,'F'],[5,5,'S'],[10,8,'S'],[6,8,'T']], {
    tablet: ['Stone that sparkles under true sight can be blasted.', 'Beyond the eastern seam: another key, then the queen’s key.'],
    warps: { y: { area: 'd2', screen: [3,2], x: 2.5, z: 6, yaw: Math.PI/2 } },
  }),
  '1,2': room('Powder Cache', { e: 'H' }, [[8,4,'h'],[5,7,'s'],[10,7,'s'],[8,8,'b'],[4,3,'v'],[11,3,'v'],[4,6,'S'],[11,6,'S']], { clear: 'chest', chest: { grant: 'bombs', amount: 10 }, spawnsAt: { '12,8': 'bomb-supply' }, encounterHint: 'Bait the guards past the pillars. Their recovery is your opening.' }),
  '3,2': room('Breached Gallery', { w: 'y', e: 'z', n: '.', s: '.' }, [[5,3,'g'],[10,8,'g'],[4,6,'S'],[11,4,'S'],[12,8,'v']], {
    warps: { '0,5': { area: 'd2', screen: [2,2], x: 13, z: 6, yaw: -Math.PI/2 }, '0,6': { area: 'd2', screen: [2,2], x: 13, z: 6, yaw: -Math.PI/2 }, y: { area: 'd2', screen: [4,2], x: 2.5, z: 6, yaw: Math.PI/2 } },
  }),
  '3,3': room('Forgotten Pay', { n: '.' }, [[8,4,'c'],[5,7,'b'],[11,7,'b'],[3,3,'F'],[12,3,'F']], { chest: { grant: 'coins', amount: 70 } }),
  '3,1': room('Crossfire Nursery', { s: 'H' }, [[4,3,'t'],[11,8,'t'],[7,3,'S'],[8,8,'S'],[5,6,'b'],[11,4,'v'],[4,8,'v']], { clear: 'key', keyAt: [8,6], encounterHint: 'Use the two pillars to break the turrets’ lines of fire.' }),
  '4,2': room('Amber Key', { w: 'y' }, [[8,4,'c'],[3,3,'F'],[12,3,'F'],[3,8,'v'],[12,8,'v']], { chest: 'key-boss', warps: { y: { area: 'd2', screen: [3,2], x: 13, z: 6, yaw: -Math.PI/2 } } }),
  '2,1': room('Mossbridge', { s: '.', w: '.', n: 'l' }, [[3,2,'O'],[4,2,'O'],[3,3,'O'],[4,3,'O'],[11,7,'O'],[12,7,'O'],[11,8,'O'],[12,8,'O'],[5,4,'b'],[10,6,'b'],[3,9,'v']], {}),
  '1,1': room('Three Watchers', { e: '.', n: 'r' }, [[3,0,'w'],[5,0,'w'],[12,0,'w'],[4,4,'S'],[11,4,'S'],[8,8,'T']], { switches: { opens: 'key', window: 7 }, keyAt: [8,6], tablet: ['Wake the three eyes together. Send the returning wood along the north wall.', 'The red door keeps a larger well of magic.'] }),
  '1,0': room('Scarlet Well', { s: '.' }, [[8,4,'c'],[4,3,'F'],[11,3,'F']], { chest: 'magic-container' }),
  '2,0': room('Crown Antechamber', { s: '.', n: 'B' }, [[8,6,'Z'],[3,8,'Y'],[5,4,'T'],[3,3,'F'],[12,3,'F'],[12,8,'v']], {
    tablet: ['The queen circles, folds, then rests. Strike the open crown.', 'Her amber shots bend toward you. Move sideways; a steel shield can catch them.', 'A bomb beneath the queen scatters her brood and turns her crown over.'],
    warps: { B: { area: 'd2-boss', screen: [0,0], x: 11, z: 13.5, yaw: Math.PI }, '3,8': { area: 'd2', screen: [2,4], x: 11.5, z: 8.5, yaw: 0 } },
    spawnsAt: { '11,6': 'bomb-supply' },
  }),
  '0,0': room('Second Light', { s: 'X' }, [[8,4,'c'],[3,3,'F'],[12,3,'F']], { chest: 'orb-2', spawnsAt: { '4,6': { type: 'npc-sage', name: 'Sage Oriel', spell:'spell-reflect', grantLines:['Two lights awake. Let your guard send a spell back to its caster.','Reflect lasts ten seconds. Hold your shield when a shot reaches you.'], afterLines:['Keep the bombs. Old stone hides more than this one path.','The eastern road leads to Sunreach Basin.'] } } }),
};
registerArea({ id: 'd2', name: 'Rootglass Hive', kind: 'dungeon', tileset: 'dungeon', lighting: 'crypt', camera: 'dungeon', rooms: true, origin: [220,0], start: [2,4], entrance: D2_ENTRANCE, keyGroup: 'd2', palette: HIVE_PALETTE, spawns: { s: 'skeleton', n: 'barrow-warden', b: 'bat', g: 'gazer', t: 'turret' }, warps: { X: D2_EXIT }, screens });

registerArea({ id: 'd2-boss', name: 'Amber Crown', kind: 'arena', tileset: 'dungeon', lighting: 'crypt', camera: 'boss', rooms: true, screen: [22,16], at: [228*16,0], entrance: D2_ENTRANCE, keyGroup: 'd2', palette: HIVE_PALETTE, spawns: { q: { type: 'boss-queen', dungeon: 'd2' }, k: { type: 'queen-tombstone', dungeon: 'd2' } }, screens: { '0,0': {
  name: 'Amber Crown',
  warps: { '10,0': { area: 'd2', screen: [0,0], x: 8, z: 9, yaw: Math.PI }, '11,0': { area: 'd2', screen: [0,0], x: 8, z: 9, yaw: Math.PI }, '10,15': { area: 'd2', screen: [2,0], x: 8, z: 2, yaw: 0 }, '11,15': { area: 'd2', screen: [2,0], x: 8, z: 2, yaw: 0 } },
  rows: ['WWWWWWWWWWUUWWWWWWWWWW','W....................W','W.F................F.W','W....................W','W..........q.........W','W....................W','W....................W','W....................W','W....................W','W....................W','W....................W','W..........k.........W','W....................W','W.F................F.W','W....................W','WWWWWWWWWWUUWWWWWWWWWW'],
} } });
