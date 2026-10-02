import { registerHudWidget } from '../hud.js';
import { entities } from '../../entities/manager.js';
import { COLORS } from '../canvas/gfx.js';

const boss=()=>entities.find(e=>!e.removed&&e.type==='boss-queen');
const label=()=>{
  const q=boss();if(!q)return '';
  const phase=q.ai.phase==='flipped'?`Overturned ${Math.max(1,Math.ceil(q.ai.t))}s`
    :q.ai.phase==='rest'?'Open crown':q.ai.phase==='volley'?'Amber volley':q.ai.phase==='gather'?'Landing':'Folded crown';
  return `Vespera ${q.hp}/${q.maxHp}: ${phase}`;
};
const fit=(g,w)=>{
  const q=boss();if(!q)return '';
  const phase=q.ai.phase,seconds=Math.max(1,Math.ceil(q.ai.t));
  const full=label().replace(/^Vespera /,'');
  const compact=phase==='flipped'?`Flip ${seconds}s`:phase==='rest'?'Open':phase==='volley'?'Volley':phase==='gather'?'Land':'Folded';
  const short=phase==='flipped'?`F${seconds}s`:phase==='rest'?'Hit':phase==='volley'?'Dodge':phase==='gather'?'Land':'Fly';
  for(const text of [full,`${q.hp}/${q.maxHp} ${compact}`,`${q.hp} ${short}`])if(g.measure(text)+2<=w)return text;
  return g.fit(`${q.hp} ${short}`,Math.max(1,w-2));
};
registerHudWidget({
  id:'amber-queen-progress',region:'center',order:30,key:label,
  measure(g,s,maxW){return boss()?[g.measure(fit(g,maxW))+2,9]:null;},
  draw(g,s,x,y,w){g.text(fit(g,w),x+1,y+1,{color:COLORS.gold,outline:COLORS.shade});},
});
