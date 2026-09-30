import { registerSpell } from '../game/spells.js';
import { damageAt } from '../game/damage.js';
import { hero } from '../game/hero.js';
import { TUNING } from '../core/tuning.js';
import { burst } from '../systems/particles.js';
import { GROUND_Y } from '../core/constants.js';
import { sfx } from '../core/audio.js';
registerSpell({id:'spell-quake',name:'Quake',order:20,cost:TUNING.spells.quake.cost,
  icon:'<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path fill="#d6b16b" d="M0 6h2V4h2v2h2V3h2v4H0z"/></svg>',
  getText:'Quake!',
  cast(){
    const p=hero.position(),q=TUNING.spells.quake;
    damageAt(p.x,p.z,q.radius,{amount:q.damage,source:'quake',from:p});
    for(let i=0;i<24;i++){const a=i*Math.PI*2/24;burst(p.x+Math.cos(a)*q.radius,GROUND_Y+.1,p.z+Math.sin(a)*q.radius,[0xd6b16b,0x8b7154],2,{speed:1,size:.09,life:q.time,up:1});}
    sfx.shatter();return true;
  },
});
