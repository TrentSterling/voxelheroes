// Loads every content file so it can register itself. Adding a tile, area,
// entity, item, HUD widget or UI screen means adding a file to one of these
// folders; nothing else needs to import it. The globs are eager, so Vite
// bundles them as ordinary static imports (no runtime fetches).
//
//   src/world/tiles/*.js     registerTile / defineTileset
//   src/world/areas/*.js     registerArea
//   src/entities/**/*.js     registerEntity (enemies/, pickups/, projectiles/, npcs/, ...)
//   src/items/*.js           registerItem
//   src/ui/screens/*.js      registerMode (title, pause, game over, menus)
//   src/ui/hud/*.js          registerHudWidget
//   src/systems/*.js         systems that register modes, grants or listeners
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
  ],
  { eager: true }
);
