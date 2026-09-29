// window.__voxelHeroes.game: the M2 contract modules for play-tests and
// debugging (scripts/scenarios/contracts-m2.mjs). Each member is the module
// itself, so a test reaches every exported function:
//
//   const g = window.__voxelHeroes.game;
//   g.hero.hero.receiveHit({ damage: 2, from: { x, z }, kind: 'contact' });
//   g.swords.buyLevel('blade-2', 'length');
//
// Members: the modules docs/CONTRACTS.md section 8.22 lists, plus the entity
// base and registry (entity, registry: tests register probe- types), the ui
// views (dialog.dialogView, hud.hudView, hud.muteLabel, ui.uiView, overlay.overlayView: tests read
// these, never the DOM), clears, drops and tileActions.
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
import * as entity from '../entities/entity.js';
import * as registry from '../entities/registry.js';
import * as tileActions from '../systems/tile-actions.js';
import * as drops from '../systems/drops.js';
import * as dialog from '../ui/dialog.js';
import * as objective from '../game/objective.js';
import * as banner from '../ui/banner.js';
import * as npcFx from '../entities/npc-fx.js';
import * as mapScreen from '../ui/screens/map.js';
import * as settingsPanel from '../ui/settings-panel.js';
import * as toast from '../ui/toast.js';
import * as hud from '../ui/hud.js';
import * as ui from '../ui/canvas/gfx.js';
import * as overlay from '../ui/overlay.js';
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
import * as clears from './clears.js';

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
  clears,
  entity,
  registry,
  tileActions,
  drops,
  dialog,
  hud,
  banner,
  npcFx,
  mapScreen,
  settingsPanel,
  toast,
  objective,
  ui,
  overlay,
};

if (typeof window !== 'undefined') {
  window.__voxelHeroesGame = gameApi;
  queueMicrotask(() => {
    if (window.__voxelHeroes) window.__voxelHeroes.game = gameApi;
  });
}
