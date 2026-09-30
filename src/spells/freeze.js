import { registerSpell } from '../game/spells.js';
import { freezeAt } from '../game/damage.js';
import { hero } from '../game/hero.js';
import { TUNING } from '../core/tuning.js';
import { sfx } from '../core/audio.js';
registerSpell({id:'spell-freeze',name:'Freeze',order:220,cost:TUNING.spells.freeze.cost,getText:'Freeze!',
  icon:'<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path fill="#9ce5ef" d="M3 0h2v3h3v2H5v3H3V5H0V3h3zM0 0h1v1H0zM7 0h1v1H7zM0 7h1v1H0zM7 7h1v1H7z"/></svg>',
  cast(){const p=hero.position(),f=TUNING.spells.freeze;freezeAt(p.x,p.z,f.radius,f.time);sfx.block();return true;},
});
