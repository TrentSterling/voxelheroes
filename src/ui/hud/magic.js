import { registerHudWidget } from '../hud.js';
import { COLORS } from '../canvas/gfx.js';
import { magic } from '../canvas/sprites.js';

registerHudWidget({
  id:'magic',region:'magic',order:10,
  key:s=>`${s.magic}/${s.maxMagic}`,
  measure:(g,s)=>s.maxMagic>0?[18+Math.min(s.maxMagic,10)*9,Math.ceil(s.maxMagic/10)*10]:null,
  draw(g,s,x,y){
    g.text('MP',x,y+2,{color:COLORS.muted,outline:COLORS.shade});
    for(let i=0;i<s.maxMagic;i++)g.sprite(magic(i<s.magic),x+18+(i%10)*9,y+Math.floor(i/10)*10);
  },
});
