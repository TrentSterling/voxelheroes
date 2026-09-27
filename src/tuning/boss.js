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
};

export const traps = {
  bladeTrap: { out: 8, back: 3 },
  turret: { period: 2.0, bolt: 6, glow: 0.3 },
  arrowTrap: { period: 2.5 },
};
