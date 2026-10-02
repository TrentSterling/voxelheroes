// TUNING sections owned by the hero stream: body and movement, the sword,
// guard, dash, and damage to the hero (gameplay spec sections 7.2 to 7.11).

export const hero = {
  box: 0.8,
  cornerAssist: 0.25,
  walk: 4.5,
  stairs: 0.75,
  deadzone: 0.3,
  posePeriod: 0.125,
  sway: 6,
  ledgePush: 0.2,
  ledgeHop: 0.35,
  interactRange: 1.0,
  prize: { time: 1.65, height: 1.14, size: 1.0, yaw: 0.35, turn: 0.45, bob: 0.035,
    top: 0.21, phoneTop: 0.24, phoneHeader: 200 },
};

export const sword = {
  handOffset: 0.35,
  extend: 2 / 60,
  hold: 0.2, // was 0.3: the thrust rooted him long enough to feel stuck
  retract: 0.08,
  inputBuffer: 0.12, // remember one early press until the blade can swing again
  smallLength: 1.25,
  smallHitWidth: 0.55, // was 0.35: a bare line whiffed constantly (fun audit)
  length: (L) => 2.5 + 0.7 * L, // tiles, full-life blade
  width: (W) => 0.25 + 0.1 * W, // tiles
  minHitWidth: 0.5, // was 0.35, with smallHitWidth
  spinRate: 1440, // degrees per second
  // The ALttP swipe (fun audit): a press sweeps this many degrees across the
  // facing (half to either side), reusing the spin's sector test, instead of
  // an instant thrust straight ahead. 0 restores the old straight thrust.
  swipe: 90,
  beam: { speed: 12, size: 0.4, range: 6.5 }, // the full-life sword beam (systems/sword.js startSwing)
  enemyFlash: 0.3,
  enemyFlashColor: 0xffe0b0,
  enemyFlashStrength: .32,
  regainFlash: 0.2,
  freezePerLevel: 1.0, // seconds a freeze-special hit freezes, per level
  starTime: 3, // seconds of invulnerability from the star special
};

export const pots = { speed: 9, flightTime: 0.55, damage: 4, stun: 0.7, radius: 0.28 };

export const guard = {
  speed: 0.5,
  arc: 60, // degrees either side of the facing
  pushBack: 0.3,
  pushTime: 0.1,
  attackerKnock: 1.0,
  attackerStun: 0.4,
  reflectSpeed: 1.5,
};

export const dash = {
  start: 2.0,
  perSecond: 0.25,
  perTurn: 0.25,
  cap: 3.5,
  crashBounce: 0.5,
  crashBounceTime: 0.15,
  crashStall: 0.4,
  enemyRehit: 0.3,
  stopNeutral: 0.15,
};

// Damage to the hero, in life units (1 unit = half a heart).
export const damage = {
  iframes: 1.5,
  knock: 1.0,
  knockTime: 0.15,
  knockLock: 0.25,
  beepInterval: 0.53,
  beepHearts: [
    [7, 1],
    [14, 2],
    [99, 3],
  ], // [max hearts up to, beep at or below]
  pit: 2,
  spikes: 2,
  lava: 4,
  swampPerSec: 1,
  ownBomb: 2,
  ownBombKnock: 1.5,
  darkPuddle: 2,
  hardMultiplier: 2,
  deathCollapse: 1.0,
};
