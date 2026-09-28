// TUNING sections owned by world: sizes, cameras, screen changes and loads
// (gameplay spec sections 4.1 to 4.4). core/tuning.js assembles every section.
// Values tagged in the spec as guesses ([I]) are meant to be tuned; change the
// spec's Appendix A in the same step.

export const world = {
  overworldScreen: [16, 16],
  // The smaller world (spec Q25, docs/PLAN.md "Scope"): 4 x 3 areas of 3 x 3
  // screens, about 108 screens, in place of the spec's 7 x 5 areas of 4 x 4.
  areaScreens: [3, 3],
  areas: [4, 3],
  dungeonRoom: [16, 12],
  dungeonFloor: [14, 10],
  sideWallInset: 0.5,
  dungeonCanvas: { cols: 8, rows: 10 },
  doorWidth: 2,
  bossArena: [22, 16],
  borderScenery: 12,
};

// Camera poses live in the art bible and src/core/camera.js; this is how each follows.
export const camera = {
  // 'hero': the subject is the hero (clamped to the area, or to a room's rows);
  // 'screen': held on the screen, slides; 'room': fixed on the room centre, slides.
  follow: { A: 'hero', B: 'screen', C: 'screen', D: 'hero', dungeon: 'room', 'dungeon-big': 'hero', boss: 'hero', interior: 'hero' },
  // Follow rigs in rooms (art bible 9): frame rows at 720p the north wall's top
  // edge stays above (north) and the black south wall's top below (south);
  // wall is the walls' height and inset the side walls' inner face from the
  // room edge, in tiles.
  roomClamp: { north: 16, south: 659, row: 720, wall: 2, inset: 1.5 },
  bossHeight: 15.103, // the large-room rig (art bible 3, DGN_BIG)
  interiorMinHeight: 8,
  bossIntro: { in: 1.5, out: 0.5, zoom: 0.3 },
};

export const scroll = {
  duration: 0.8,
  carry: 1.0,
  followDeadband: 0.5,
  spawnStagger: 0.1,
  spawnWait: 0.5,
  projectileRange: 20,
};

export const load = {
  fade: 0.25,
  cardMin: 1.0,
  cardOff: 0.3,
  maxTotal: 1.5,
  innerFade: 0.3,
  musicFade: 0.5,
};
