import { registerDungeon } from '../game/dungeons.js';
import { registerPlace } from '../game/places.js';
import { registerMusic } from '../game/music.js';
import { D2_ENTRANCE, D2_EXIT } from '../world/areas/forest.js';

registerDungeon({ id: 'd2', number: 2, name: 'Rootglass Hive', areas: ['d2', 'd2-boss'], entrance: D2_ENTRANCE, exit: D2_EXIT, keyGroup: 'd2', boss: 'boss-queen', bossRoom: 'd2-boss:0,0', tool: 'bombs', smallKeys: 3, music: 'dungeon-2', canvas: [5,5], floors: 1 });
registerMusic({ id: 'dungeon-2', name: 'Rootglass Hive' });
registerPlace({ id: 'd2', name: 'Rootglass Hive', kind: 'dungeon', order: 102, area: 'd2', spot: D2_EXIT });
