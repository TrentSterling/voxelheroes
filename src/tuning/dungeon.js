// TUNING section owned by the dungeon stream: doors, keys and the puzzle and
// hazard kit (gameplay spec 6.3, 6.4). The traps (blade trap, turret, arrow
// trap) are foes-dungeon's: TUNING.traps in tuning/boss.js; the key toast is
// the ui's: TUNING.toasts.key.

export const dungeon = {
  shutterDelay: 0.3,
  keyPush: 0.2,
  pushBlock: { push: 0.4, slide: 0.35 },
  weakFloor: 0.5,
  pillar: 2,
  conveyor: 3,
  bombWallRadius: 1.5,
  candleRadius: 3,
};
