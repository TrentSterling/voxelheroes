// The starting sword, from the king (gameplay spec 10.5): strength 3 and the
// spin, everything else 0, nothing to buy. The hero stream owns this folder
// and adds blade-2 to blade-4 in M2; names are placeholders until then.
import { registerSword } from '../game/swords.js';

registerSword({
  id: 'blade-start',
  name: 'Squire Blade',
  description: 'The blade the king hands every new hero. It spins at full life.',
  source: 'the king',
  order: 10,
  base: { length: 0, width: 0, strength: 3, spin: 1, beam: 0, pierce: 0, special: 0 },
  // max defaults to base: this sword cannot be improved
  price: {},
  budget: 0,
});
