// The file content.js's `./music/*.js` glob actually imports: every track
// and stinger lives in tracks/ (content.js's glob is not recursive), and
// registers itself for the side effect on import. See engine.js for the
// synth core and docs at the top of game/music.js for the public API.
import './tracks/title.js';
import './tracks/overworld.js';
import './tracks/village.js';
import './tracks/dungeon.js';
import './tracks/dungeon-1.js';
import './tracks/cave.js';
import './tracks/boss.js';
import './tracks/stingers.js';
import { renderOffline, getRenderable, renderableIds } from './engine.js';

// Tooling only (scripts/render-music.mjs): an OfflineAudioContext render, so
// the lead can listen to a WAV of each loop without opening the game. Not
// part of the play(out)/registerStinger(out) gameplay API above.
if (typeof window !== 'undefined') {
  window.__voxelHeroesMusic = { renderOffline, getRenderable, renderableIds };
}
