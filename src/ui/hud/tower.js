import { registerHudWidget } from '../hud.js';
import { entities } from '../../entities/manager.js';
import { COLORS } from '../canvas/gfx.js';
const remaining=()=>{const b=entities.find(e=>e.type==='boss-bishop'&&e.trial&&!e.removed);return b?Math.max(0,Math.ceil(120-b.ai.clock)):null;};
registerHudWidget({id:'reflection-time',region:'center',order:30,key:()=>String(remaining()),measure(g){const t=remaining();return t===null?null:[g.measure('Endure: '+t+'s')+2,9];},draw(g,s,x,y){g.text('Endure: '+remaining()+'s',x+1,y+1,{color:COLORS.gold,outline:COLORS.shade});}});
