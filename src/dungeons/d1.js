// D1, the Hollow Barrow: dungeon 1 (gameplay spec 6.8, 6.9, compact scope).
// Its rooms are world/areas/d1.js, its door and kit tiles world/tiles/d1.js,
// its boss boss-serpent (entities/bosses/serpent.js, which calls
// defeatBoss('d1'): number 1 pays TUNING.economy.bossPay[0]).
import { registerDungeon } from '../game/dungeons.js';
import { registerMusic } from '../game/music.js';
import { registerPlace } from '../game/places.js';
import { registerLighting } from '../core/renderer.js';
import { D1_ENTRANCE, D1_EXIT } from '../world/areas/slice.js';

registerDungeon({
  id: 'd1',
  number: 1,
  name: 'Hollow Barrow',
  areas: ['d1', 'd1-boss'],
  entrance: D1_ENTRANCE,
  exit: D1_EXIT,
  keyGroup: 'd1',
  boss: 'boss-serpent',
  bossRoom: 'd1-boss:0,0',
  tool: 'boomerang',
  smallKeys: 4,
  music: 'dungeon-1',
  canvas: [8, 10],
  floors: 1,
});

registerMusic({ id: 'dungeon-1', name: 'Hollow Barrow' });

registerPlace({ id: 'd1', name: 'Hollow Barrow', kind: 'dungeon', order: 101, area: 'd1', spot: D1_EXIT });

// Dark rooms (spec 6.4; CONTRACTS 11): the crypt look with the fill and key
// turned right down, so only the lamps and the braziers light the floor.
registerLighting('dark', {
  extends: 'crypt',
  lights: { hemi: { intensity: 0.25 }, sun: { intensity: 0.35 } },
});
