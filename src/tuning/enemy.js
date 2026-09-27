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
};

export const drops = { bushRoll: 0.25, potRoll: 0.5, lateHeartScale: 0.5 };
