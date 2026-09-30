import { registerSpell } from '../game/spells.js';
import { startEffect } from '../game/effects.js';
import { TUNING } from '../core/tuning.js';
registerSpell({id:'spell-truesight',name:'Truesight',order:50,cost:TUNING.spells.truesight.cost,
  icon:'<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><g fill="#b8a1d7"><rect x="5" y="3" width="6" height="2"/><rect x="3" y="5" width="10" height="2"/><rect x="1" y="7" width="14" height="2"/><rect x="3" y="9" width="10" height="2"/><rect x="5" y="11" width="6" height="2"/></g><rect x="5" y="5" width="6" height="6" fill="#393040"/><rect x="7" y="6" width="2" height="4" fill="#ffe7ad"/></svg>',
  getText:'Truesight reveals the real body among reflections. Follow its shadow and strike before the spell fades.',
  cast(){startEffect('truesight',TUNING.spells.truesight.time);return true;},
});
