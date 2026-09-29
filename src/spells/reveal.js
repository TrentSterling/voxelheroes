// Reveal: the sage's reward after D1 (world/areas/d1.js's Buried spawnsAt names 'spell-reveal',
// entities/npcs/slice.js's Sage grants whatever spell it is told once hasGrant() says it exists).
// It was never registered, so the sage never had anything to give; this is that registration.
// While it runs (TUNING.spells.reveal.time, gameplay spec 9.4), secrets nearby glint gold:
// world/tilekit.js revealGlint reads effectActive('reveal') from every cracked wall, cracked rock
// and stair-bush's tick.
import { registerSpell } from '../game/spells.js';
import { startEffect } from '../game/effects.js';
import { TUNING } from '../core/tuning.js';

const ICON =
  '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="6" y="1" width="4" height="4" fill="#f1c232"/><rect x="6" y="11" width="4" height="4" fill="#f1c232"/><rect x="1" y="6" width="4" height="4" fill="#f1c232"/><rect x="11" y="6" width="4" height="4" fill="#f1c232"/></svg>';

registerSpell({
  id: 'spell-reveal',
  name: 'Reveal',
  icon: ICON,
  order: 10,
  cost: TUNING.spells.reveal.cost,
  getText: 'Reveal! Secret walls, rocks and bushes nearby glint gold for a while.',
  cast() {
    startEffect('reveal', TUNING.spells.reveal.time);
    return true;
  },
});
