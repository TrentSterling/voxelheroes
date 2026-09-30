import { registerItem } from './registry.js';
import { input } from '../core/input.js';
import { hero } from '../game/hero.js';
import { TUNING } from '../core/tuning.js';
import { sfx } from '../core/audio.js';
import { prizeMesh } from '../models/items/items.js';
import { fireWandModel } from '../models/items/fire-wand.js';
registerItem({id:'fire-wand',name:'Fire Wand',kind:'tool',order:40,model:prizeMesh(fireWandModel),getText:'The Fire Wand!',
  icon:'<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path fill="#a57b4a" d="M3 4h2v4H3z"/><path fill="#e96937" d="M2 2h1V0h2v2h1v3H2z"/><path fill="#ffdf83" d="M3 2h2v2H3z"/></svg>',
  use(ctx){const m=input.move(),a=Math.round(Math.atan2(m.z,m.x)/(Math.PI/4))*(Math.PI/4),d=m.len>TUNING.hero.deadzone?{x:Math.cos(a),z:Math.sin(a)}:hero.facingVector();
    ctx.spawn('fire-bolt',{x:ctx.player.x+d.x*.4,z:ctx.player.z+d.z*.4,dir:d});sfx.shoot();return true;},
});
