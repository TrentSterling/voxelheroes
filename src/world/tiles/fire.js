import * as THREE from 'three';
import { registerTile } from '../tiles.js';
import { fineFloor } from './dungeon.js';
import { land } from './overworld.js';
import { world } from '../world.js';
import { modelMesh } from '../../models/kit.js';
import { iceGateModel,dryTreeModel } from '../../models/items/fire-wand.js';
import { brazierModel } from '../../models/props.js';
import { flameProp,revealBurst } from '../tilekit.js';
import { GROUND_Y } from '../../core/constants.js';
import { emit } from '../../core/events.js';
import { sfx } from '../../core/audio.js';
import { openEventShutters,dropKey,roomFlag } from './d1.js';
import { hasFlag,setFlag } from '../../core/state.js';
const fireShot=ctx=>ctx.hit?.source==='fire'&&ctx.def.onFire?.(ctx);
const prop=make=>ctx=>{const o=modelMesh(make());o.position.set(ctx.cx,GROUND_Y,ctx.cz);return o;};
const melt=ctx=>{if(!world.setTile(ctx.tx,ctx.tz,'.',{persist:true,reason:'melt'}))return false;revealBurst(ctx.tx,ctx.tz,[0x8cdce9,0xd6f4e9]);emit('secret-found',{kind:'melt',tx:ctx.tx,tz:ctx.tz});return true;};
registerTile('dungeon',':',{name:'tideglass-ice',solid:true,build:fineFloor,prop:prop(iceGateModel),onFire:melt,onShot:fireShot});
registerTile('dungeon',',',{name:'frozen-flame',solid:true,build:fineFloor,prop:prop(iceGateModel),onFire:melt,onShot:fireShot,onSword:melt});
registerTile('dungeon',';',{name:'flame-wall',solid:true,build:fineFloor,prop:ctx=>{const group=new THREE.Group(),flame=flameProp(ctx);flame.position.set(0,flame.position.y,0);group.position.set(ctx.cx,0,ctx.cz);group.scale.set(1.4,2,1.4);group.add(flame);group.userData.tick=(...args)=>flame.userData.tick(...args);return group;},
  onFreeze(ctx){return world.setTile(ctx.tx,ctx.tz,',',{persist:true,reason:'freeze-flame'});},
});
registerTile('dungeon','f',{name:'unlit-torch',solid:true,build:fineFloor,prop:prop(brazierModel),onShot:fireShot,
  onFire(ctx){
    if(!world.setTile(ctx.tx,ctx.tz,'F',{persist:true,reason:'torch'}))return false;
    emit('switch-pressed',{id:'torch:'+ctx.tx+','+ctx.tz,tx:ctx.tx,tz:ctx.tz,kind:'torch',on:true});sfx.door();
    const s=ctx.screen;if(s.tiles.some(row=>row.includes('f')))return true;
    const flag=roomFlag(s,'torches');if(hasFlag(flag))return true;setFlag(flag);openEventShutters(s);
    if(s.def.torchReward==='key')dropKey(s,'torches');
    if(s.def.torchReward==='chest')for(let z=0;z<s.h;z++)for(let x=0;x<s.w;x++)if(s.tiles[z][x]==='h')world.setTile(s.x0+x,s.z0+z,'c',{persist:true,reason:'torch-chest'});
    return true;
  },
});
registerTile('overworld',';', {name:'dead-tree',solid:true,ground:'grass',build:land,prop:prop(dryTreeModel),onShot:fireShot,
  onFire(ctx){if(!world.setTile(ctx.tx,ctx.tz,'.',{persist:true,reason:'burn-tree'}))return false;revealBurst(ctx.tx,ctx.tz,[0x756255,0xe08a36]);emit('secret-found',{kind:'burn-tree',tx:ctx.tx,tz:ctx.tz});return true;},
});
