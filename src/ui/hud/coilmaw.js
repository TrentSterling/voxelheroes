import { registerHudWidget } from '../hud.js';
import { entities } from '../../entities/manager.js';
import { TUNING } from '../../core/tuning.js';
import { COLORS } from '../canvas/gfx.js';

const boss=()=>entities.find(e=>!e.removed&&e.type==='boss-serpent');
const label=()=>{
  const b=boss();
  return !b?'':b.segments.length?`Coils: ${b.segments.length}/${TUNING.boss.serpent.segments}`:`Head: ${b.hp}/${b.maxHp}`;
};
registerHudWidget({
  id:'coilmaw-progress',region:'center',order:30,key:label,
  measure(g,s,maxW){const text=label();return text?[g.measure(g.fit(text,maxW-2))+2,9]:null;},
  draw(g,s,x,y,w){g.text(g.fit(label(),w-2),x+1,y+1,{color:COLORS.gold,outline:COLORS.shade});},
});
