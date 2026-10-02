import { registerHudWidget } from '../hud.js';
import { COLORS } from '../canvas/gfx.js';
import { fairMachine, fairScore, FAIR } from '../../systems/clockfair.js';
const label=()=>{const a=fairMachine()?.ai;return a?.phase==='running'?`Bells ${fairScore(a.mask)}/6: ${Math.ceil(FAIR.duration-a.elapsed)}s`:a?.phase==='won'?'Six bells together':a?.phase==='timeout'?'Time up: read the board':'Clockfair: read the board';};
registerHudWidget({id:'clockfair',region:'center',order:30,key:()=>fairMachine()?label():'-',measure(g,s,maxW){return fairMachine()?[g.measure(g.fit(label(),Math.max(1,(maxW??g.w)-2)))+2,9]:null;},draw(g,s,x,y,w){g.text(g.fit(label(),w-2),x+1,y+1,{color:COLORS.gold,outline:COLORS.shade});}});
