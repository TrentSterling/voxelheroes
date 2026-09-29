// The Warden's Blade (economy lane, fun audit: "screens are empty" needed a
// second sword to find): longer reach and a harder hit than a fully-worked
// Squire Blade, out of the box. The secrets lane places the chest that
// grants it, in a hidden cave; this file only registers the sword so that
// chest (or a test) can grant('blade-warden').
import { registerSword } from '../game/swords.js';

registerSword({
  id: 'blade-warden',
  name: "Warden's Blade",
  description: 'Long-forged steel, heavier than a smith can make from a Squire Blade. It spins at full life.',
  source: 'a hidden vault',
  order: 20,
  base: { length: 4, width: 2, strength: 5, spin: 1, beam: 0, pierce: 0, special: 0 },
  // Already better than the Squire Blade can be worked to; nothing more to sell.
  price: {},
  budget: 0,
});
