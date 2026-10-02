import { clockAnchorCount } from '../../systems/tower-clock.js';
import { registerHudWidget } from '../hud.js';
import { entities } from '../../entities/manager.js';
import { COLORS } from '../canvas/gfx.js';
const visible=()=>entities.some(e=>e.type==='boss-bishop'&&e.trial&&!e.removed);
const label=()=>`Anchors: ${clockAnchorCount()}/4`;
registerHudWidget({id:'reflection-clock',region:'center',order:30,key:()=>visible()?label():'-',measure(g,s,maxW){if(!visible())return null;return[g.measure(g.fit(label(),Math.max(1,(maxW??g.w)-2)))+2,9];},draw(g,s,x,y,w){g.text(g.fit(label(),w-2),x+1,y+1,{color:COLORS.gold,outline:COLORS.shade});}});
