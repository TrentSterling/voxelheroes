import { registerSpell } from '../game/spells.js';
import { startEffect } from '../game/effects.js';
import { TUNING } from '../core/tuning.js';
registerSpell({id:'spell-reflect',name:'Reflect',order:210,cost:TUNING.spells.reflect.cost,getText:'Reflect!',
  icon:'<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path fill="#8fbde8" d="M1 0h6v5L4 8 1 5z"/><path fill="#eaf9ec" d="M3 1h2v4H3zM3 6h2v1H3z"/></svg>',
  cast(){startEffect('reflect',TUNING.spells.reflect.time);return true;},
});
