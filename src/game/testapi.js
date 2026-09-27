// window.__voxelHeroes.game: the M2 contract modules for play-tests and
// debugging (scripts/scenarios/contracts-m2.mjs). Each member is the module
// itself, so a test reaches every exported function:
//
//   const g = window.__voxelHeroes.game;
//   g.hero.hero.receiveHit({ damage: 2, from: { x, z }, kind: 'contact' });
//   g.swords.buyLevel('blade-2', 'length');
//
// The test hook (debug/testhook.js) is installed after the content modules
// load, so this attaches on the next microtask; window.__voxelHeroesGame
// holds the same object in case the hook is missing.
import * as tuning from '../core/tuning.js';
import * as events from '../core/events.js';
import * as input from '../core/input.js';
import * as loop from '../core/loop.js';
import * as save from '../core/save.js';
import * as audio from '../core/audio.js';
import * as stateModule from '../core/state.js';
import * as grants from '../systems/grants.js';
import * as combat from '../systems/combat.js';
import * as interact from '../systems/interact.js';
import * as keys from '../systems/keys.js';
import * as inventory from '../items/inventory.js';
import * as itemRegistry from '../items/registry.js';
import * as projectile from '../entities/projectile.js';
import * as vitals from './vitals.js';
import * as progress from './progress.js';
import * as places from './places.js';
import * as effects from './effects.js';
import * as settings from './settings.js';
import * as hero from './hero.js';
import * as swords from './swords.js';
import * as damage from './damage.js';
import * as spells from './spells.js';
import * as dungeons from './dungeons.js';
import * as shops from './shops.js';
import * as services from './services.js';
import * as saves from './saves.js';
import * as bestiary from './bestiary.js';
import * as music from './music.js';
import * as cards from './cards.js';
import * as prompts from './prompts.js';
import * as pickups from './pickups.js';
import * as menus from './menus.js';

export const gameApi = {
  version: 1,
  tuning,
  events,
  input,
  loop,
  save,
  audio,
  state: stateModule,
  grants,
  combat,
  interact,
  keys,
  inventory,
  items: itemRegistry,
  projectile,
  vitals,
  progress,
  places,
  effects,
  settings,
  hero,
  swords,
  damage,
  spells,
  dungeons,
  shops,
  services,
  saves,
  bestiary,
  music,
  cards,
  prompts,
  pickups,
  menus,
};

if (typeof window !== 'undefined') {
  window.__voxelHeroesGame = gameApi;
  queueMicrotask(() => {
    if (window.__voxelHeroes) window.__voxelHeroes.game = gameApi;
  });
}
