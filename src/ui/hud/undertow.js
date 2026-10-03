import { registerHudWidget } from '../hud.js';
import { entities } from '../../entities/manager.js';
import { COLORS } from '../canvas/gfx.js';

const boss=()=>entities.find(e=>!e.removed&&e.type==='boss-beast');
const labels=()=>{
  const b=boss();if(!b)return [];
  const phase=b.ai.phase==='ripple'?'Follow ripple':b.ai.phase==='surface'?'Strike; guard ink':'Next bank';
  return [`Nacre ${b.hp}/105: ${phase}`,`${b.hp}: ${phase}`,`${b.hp} Nacre`];
};
const fit=(g,w)=>{const rows=labels();for(const text of rows)if(g.measure(text)+2<=w)return text;return rows.length?g.fit(rows.at(-1),Math.max(1,w-2)):'';};
registerHudWidget({
  id:'undertow-progress',region:'center',order:30,key:()=>labels()[0]??'',
  measure(g,s,maxW){return boss()?[g.measure(fit(g,maxW))+2,9]:null;},
  draw(g,s,x,y,w){g.text(fit(g,w),x+1,y+1,{color:COLORS.gold,outline:COLORS.shade});},
});
