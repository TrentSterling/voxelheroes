// TUNING sections owned by foes-overworld: enemy behaviour shared by every
// enemy (foes-dungeon reads it too) and drop rolls (gameplay spec 4.3, 5.5,
// 6.5, 8.2, 8.7).

export const enemy = {
  knock: 1.5,
  knockTime: 0.2,
  stagger: 0.25,
  heavyKnock: 0.5,
  alignTol: 0.5,
  stunBoomerang: 2.0,
  stunGrapple: 1.0,
  freeze: 5.0,
  spawnMinDist: 3,
  overworldPerScreen: [2, 6],
  roomTypical: [1, 5],
  roomMax: 8,
  crownedChance: 0.08,
  crownedSpeed: 1.5,
  rare: { 'treasure-slime': 0.08, wyrm: 0.04 }, // per entry of a group that lists them (spec Appendix A: slimeChance, wyrmChance)
  roomClearMemory: 180,
  hardExtra: 0.5,
  rareHardMultiplier: 2,
  tells: { shooterStop: 0.4, chargeTell: 0.3 }, // the turret's glow is TUNING.traps.turret.glow
  ai: {
    wanderLeg: [0.8, 1.6],
    wanderPause: [0.3, 0.6],
    chargeMult: [2, 3],
    chargeMax: 4,
    shooterCooldown: [1.5, 2.5],
    hopEvery: [1.2, 1.6],
    hopAir: 0.5,
    flierTurn: 0.4,
    teleportGone: 1.0,
    teleportMinDist: 3,
    frontGuardArc: 60,
    gazeParalyze: 1.0,
  },
  // Crowned elites: the crown floats this high over the enemy (tiles).
  crownHeight: 1.05,
  // Contact reaches the hero within r + hero r, times this.
  contactReach: 1.0,
  // Hopper-type enemies: the landing shadow grows to full size over the hop.
  hopHeight: 0.9,
  // The first-slice roster (gameplay spec 8.3): hp in damage points, contact
  // in life units (1 = half a heart), speeds in t/s, reach and ranges in tiles.
  roster: {
    hopper: { hp: 3, contact: 1, speed: 2.5, chargeSpeed: 6, chargeTime: 0.6, sight: 5, r: 0.34 },
    blob: { hp: 4, contact: 1, speed: 1.5, r: 0.36 },
    'blob-blue': { hp: 12, contact: 2, speed: 2, r: 0.4 },
    buzzer: { hp: 4, contact: 1, speed: 3.5, r: 0.3, height: 0.7 },
    stump: { hp: 8, contact: 1, speed: 2, wake: 3, r: 0.4 },
    archer: { hp: 10, contact: 1, speed: 2, sight: 7, arrowSpeed: 8, arrowDamage: 1, r: 0.36 },
    leaper: { hp: 6, contact: 2, speed: 2, hopTiles: 3, hopEvery: 1.4, r: 0.36 },
    guardian: { hp: 3, contact: 2, speed: 2, circle: 2.0, leapTiles: 4, leapAfter: 2, r: 0.55 },
    'treasure-slime': { hp: 45, contact: 1, speed: 6, flee: 5, r: 0.36 },
    wyrm: { hp: 90, contact: 6, speed: 3.5, r: 0.7 },
    skeleton: { hp: 6, contact: 1, speed: 2, turnChance: 0.25, r: 0.36 },
    bat: { hp: 3, contact: 1, speed: 4, r: 0.3, height: 0.8 },
    gazer: { hp: 6, contact: 1, speed: 1.5, sight: 7, boltSpeed: 7, boltDamage: 2, cooldown: 2.0, r: 0.38 },
  },
};

export const drops = { bushRoll: 0.25, potRoll: 0.5, lateHeartScale: 0.5 };
