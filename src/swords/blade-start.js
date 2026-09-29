// The starting sword, from the king (gameplay spec 10.5): strength 3 and the
// spin, everything else 0. The hero stream owns this folder and adds
// blade-2 to blade-4 in M2; names are placeholders until then.
//
// Smith levels (economy lane, fun audit: coins bought nothing): Brannoc
// works length, width and strength for coin, each a flat price per level
// (game/swords.js has no per-level scaling), so the ladder climbs by moving
// from the cheap stat to the pricier ones rather than within one stat. See
// TUNING.economy.smith for the prices and smithBudget for the total he will
// ever take for this blade.
import { registerSword } from '../game/swords.js';
import { TUNING } from '../core/tuning.js';

registerSword({
  id: 'blade-start',
  name: 'Squire Blade',
  description: 'The blade the king hands every new hero. It spins at full life.',
  source: 'the king',
  order: 10,
  base: { length: 0, width: 0, strength: 3, spin: 1, beam: 0, pierce: 0, special: 0 },
  max: { length: 4, width: 4, strength: 6, spin: 1, beam: 0, pierce: 0, special: 0 },
  price: { length: TUNING.economy.smith.length, width: TUNING.economy.smith.width, strength: TUNING.economy.smith.strength },
  budget: TUNING.economy.smithBudget,
});
