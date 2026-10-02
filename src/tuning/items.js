// TUNING sections owned by the items stream: pickups, tools, spells and the
// life and magic progression (gameplay spec 7.12, 8.7, 9, 10).

export const pickups = { life: 8.5, blink: 1.5, bossDropLife: 15, heart: 2, magic: 1 };

export const items = {
  boomerang: { speed: 10, range: 6, returnSpeed: 12, damage: 0, catch: 0.5, spin: 18 },
  bomb: { fuse: 2.0, radius: 1.5, damage: 6, maxOut: 2, capacity: [10, 20, 30, 40], start: 10, place: 0.6, blinkFrom: 0.6, flash: 0.25, pickup: 1 },
  arrow: { speed: 12, damage: 4, capacity: [10, 30, 60, 99] },
  grapple: { speed: 16, range: 6, dialRange: 8, longRange: 11, pull: 12 },
  fireWand: { speed: 10, damage: 6, magic: 0 },
  book: { damage: 1 },
  useLock: 0.25,
  castLock: 0.4,
  usePose: 0.25, // the item pose after a B item is used (s)
  bottles: 4,
};

// cost is [might, focus]: what the spell costs a hero of each trait.
export const spells = {
  reveal: { cost: [1, 1], time: 10 },
  reflect: { cost: [1, 1], time: 10 },
  quake: { cost: [3, 2], radius: 4, time: 0.5, damage: 8 },
  freeze: { cost: [4, 3], radius: 5, time: 5 },
  slow: { cost: [5, 4], factor: 0.5, time: 10 },
  truesight: { cost: [3, 2], time: 15 },
};

export const progression = {
  classes: { life: [10, 3], balanced: [8, 4], magic: [6, 5] }, // [life units, magic]
  bossHearts: 6,
  pieces: 29,
  piecesPerHeart: 4,
  magicContainers: 8,
  spellMagic: 1,
  ringCut: [0.25, 0.5],
  mightStrength: 1,
  focusCost: 1,
  revive: 8,
};
