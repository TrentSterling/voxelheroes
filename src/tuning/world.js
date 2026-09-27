// TUNING sections owned by world: sizes, cameras, screen changes and loads
// (gameplay spec sections 4.1 to 4.4). core/tuning.js assembles every section.
// Values tagged in the spec as guesses ([I]) are meant to be tuned; change the
// spec's Appendix A in the same step.

export const world = {
  overworldScreen: [16, 16],
  areaScreens: [4, 4],
  areas: [7, 5],
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
  follow: { A: 'hero', B: 'screen', C: 'screen', D: 'hero' },
  bossHeight: 17.5,
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
