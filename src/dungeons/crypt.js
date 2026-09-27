// Cairn Crypt, the M1 test dungeon (number 0: no boss, no orb). The dungeon
// stream replaces it with d1 in M2; it stays registered so dungeon progress,
// the entrance respawn and the dungeon events have something to run on.
import { registerDungeon } from '../game/dungeons.js';

registerDungeon({
  id: 'crypt',
  number: 0,
  name: 'Cairn Crypt',
  areas: ['crypt'],
  // Where the doorway on Cairn Ridge brings the hero in (main's 16 x 11
  // rooms). After feat/world the crypt area's own `entrance` is used.
  entrance: { area: 'crypt', screen: [0, 1], x: 8, z: 8.4, yaw: Math.PI },
  exit: { area: 'overworld', screen: [1, 0], x: 8, z: 1.7, yaw: 0 },
  keyGroup: 'crypt',
  boss: null,
  smallKeys: 1,
  music: 'dungeon',
  canvas: [2, 2],
  floors: 1,
});
