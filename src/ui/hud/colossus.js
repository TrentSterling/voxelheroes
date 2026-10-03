import { registerHudWidget } from '../hud.js';
import { entities } from '../../entities/manager.js';
import { COLORS } from '../canvas/gfx.js';

const boss=()=>entities.find(e=>!e.removed&&e.type==='boss-colossus');
const labels=()=>{
  const b=boss();if(!b)return [];
  const phase=b.ai.phase==='laser-tell'||b.ai.phase==='laser'?'Dodge laser':b.ai.phase==='slam-tell'?'Guard wave':b.ai.phase==='leap'?'Leave landing':'Strike';
  const stage=b.stage===1?'Feet':b.stage===2?'Arms':'Core';
  return [`${b.remainingHp()}/45: ${stage}; ${phase}`,`${b.remainingHp()} ${stage}: ${phase.replace(' laser','').replace(' wave','').replace(' landing','')}`,`${b.remainingHp()} ${stage}`];
};
const fit=(g,w)=>{const rows=labels();for(const text of rows)if(g.measure(text)+2<=w)return text;return rows.length?g.fit(rows.at(-1),Math.max(1,w-2)):'';};
registerHudWidget({
  id:'colossus-progress',region:'center',order:30,key:()=>labels()[0]??'',
  measure(g,s,maxW){return boss()?[g.measure(fit(g,maxW))+2,9]:null;},
  draw(g,s,x,y,w){g.text(fit(g,w),x+1,y+1,{color:COLORS.gold,outline:COLORS.shade});},
});
