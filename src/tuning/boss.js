// TUNING sections owned by foes-dungeon: the boss template (gameplay spec
// 8.5) and the traps it builds (6.4, 12.4). The spec's Appendix A lists the
// trap numbers under dungeon and the turret glow under enemy.tells; the
// TUNING paths here win.

export const boss = {
  window: [1.5, 3],
  phases: [0.66, 0.33],
  phaseSpeed: 0.2,
  rematchSpeed: 0.25,
  partHeart: 1.0,
  addHeart: 0.5,
  // boss-serpent (D1, gameplay spec 8.6)
  serpent: {
    segments: 6, gap: 0.9, segmentSize: 1.2, headSize: 1.6,
    speed: 3, speedPerLost: 0.5, speedMax: 6, turnRate: 100, // degrees per second of steady curving
    wallMargin: 2.2, // tiles from the arena wall where it starts to turn in
    glowDelay: 2.5, ringCount: 8, ringSpeed: 5, ringDamage: 1,
    volleyEvery: 4, volleyCount: 3, volleySpread: 15, volleySpeed: 6, volleyDamage: 1, volleyTier: 3,
    headHp: 24, contact: 2, hitFlash: 0.3,
  },
  intro: { name: 1.2 }, // the name card lingers this long into the fight (s)
};

export const traps = {
  bladeTrap: { out: 8, back: 3 },
  turret: { period: 2.0, bolt: 6, glow: 0.3 },
  arrowTrap: { period: 2.5, speed: 8, damage: 1, tier: 2 },
  turretBolt: { damage: 1, tier: 3 },
  bladeTrapDamage: 2,
  bladeTrapReach: 12, // tiles it looks along its row and column
};
