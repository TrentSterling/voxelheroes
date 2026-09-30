import { registerItem } from './registry.js';
import { input } from '../core/input.js';
import { TUNING } from '../core/tuning.js';
import { sfx } from '../core/audio.js';
import { hero } from '../game/hero.js';
import { prizeMesh } from '../models/items/items.js';
import { hunterBowModel } from '../models/items/hunter.js';

registerItem({
  id:'bow',name:'Hunter Bow',kind:'tool',order:25,ammo:'arrows',startAmmo:10,
  maxAmmo:s=>TUNING.items.arrow.capacity[Math.min(TUNING.items.arrow.capacity.length-1,s.bags?.arrows??0)],
  model:prizeMesh(hunterBowModel),getText:'The Hunter Bow!',
  icon:'<svg viewBox="0 0 8 8" shape-rendering="crispEdges"><path fill="#b59256" d="M2 0h2v1h1v1h1v4H5v1H4v1H2V7h1V6h1V2H3V1H2z"/><path fill="#e2d4af" d="M2 1h1v6H2z"/><path fill="#c5d0cc" d="M0 4h7V3h1v3H7V5H0z"/></svg>',
  use(ctx){
    if(!ctx.useAmmo(1))return false;
    const m=input.move8(),dir=m.dir>=0?{x:m.x,z:m.z}:hero.facingVector();
    ctx.spawn('hero-arrow',{x:ctx.player.x,z:ctx.player.z,dir});
    sfx.shoot();return true;
  },
});
