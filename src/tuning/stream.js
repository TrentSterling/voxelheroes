// TUNING.stream: the streamed outdoors and building ahead (systems/streaming.js, world/world.js
// "loads and streaming"). Distances are in screens (world.screenDist: 1 = touching) unless named
// in tiles; times in seconds, budgets in milliseconds of main-thread time per frame.
//
// systems/streaming.js puts this on TUNING (TUNING.stream) until core/tuning.js assembles it.

export const stream = {
  radius: 2, // outdoors: screens this close to the hero's are live (terrain, props, people)
  lowRadius: 1, // the same at the 'low' look (weak devices: fewer triangles)
  scenery: 1, // one ring further out: terrain only (no props, no people); none at 'low'
  hysteresis: 1, // a screen leaves the live ring (or the scenery) only this much further out
  active: 1, // people and foes this close are simulated; further out they lie still (dormant)
  budgetMs: 3, // building per frame in play
  loadBudgetMs: 8, // building per frame at black (a fade), where nothing else is drawn
  maxHold: 4, // a fade waits at most this long at black for the screens it will show
  prebuildTiles: 10, // near a door or cave (tiles), its area is built ahead
  prebuildDrop: 20, // ... and freed again once the hero is this far from all its doors
  clearMemory: 60, // a cleared outdoor screen re-rolls its foes only once it has been out of the live ring this long
};
