// Loads every content file so it can register itself. Adding a tile, area,
// entity, item, sword, spell, dungeon, shop, HUD widget or UI screen means
// adding a file to one of these folders; nothing else needs to import it.
// The globs are eager, so Vite bundles them as ordinary static imports (no
// runtime fetches).
//
//   src/world/tiles/*.js     registerTile / defineTileset
//   src/world/areas/*.js     registerArea
//   src/entities/**/*.js     registerEntity (enemies/, pickups/, projectiles/, npcs/, ...)
//   src/items/*.js           registerItem
//   src/ui/screens/*.js      registerMode (title, pause, game over, menus)
//   src/ui/hud/*.js          registerHudWidget
//   src/systems/*.js         systems that register modes, grants or listeners
//   src/game/*.js            the M2 contract modules (docs/CONTRACTS.md)
//   src/swords/*.js          registerSword
//   src/spells/*.js          registerSpell
//   src/dungeons/*.js        registerDungeon
//   src/shops/*.js           registerShop, registerInn
//   src/music/*.js           registerMusic
//   src/cards/*.js           registerLoadingCard
//
// Registration order is not guaranteed: registries must not depend on it.
import.meta.glob(
  [
    './world/tiles/*.js',
    './world/areas/*.js',
    './entities/**/*.js',
    './items/*.js',
    './ui/screens/*.js',
    './ui/hud/*.js',
    './systems/*.js',
    './game/*.js',
    './swords/*.js',
    './spells/*.js',
    './dungeons/*.js',
    './shops/*.js',
    './music/*.js',
    './cards/*.js',
  ],
  { eager: true }
);
