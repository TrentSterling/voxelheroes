import * as THREE from 'three';
import { defineTileset, registerTile, getTile } from '../tiles.js';
import { land } from './overworld.js';
import './town.js';
import { modelMesh } from '../../models/kit.js';
import { fairModel } from '../../models/clockfair.js';
import { FAIR, fairMachine, fairRequest, fairBest } from '../../systems/clockfair.js';
import { setFlag, hasFlag } from '../../core/state.js';
import { showDialog } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';
import { liftPot } from '../../systems/pots.js';
import { shatterPot } from '../../systems/pot-fx.js';
import { GROUND_Y } from '../../core/constants.js';
import { currentScreen } from '../world.js';

defineTileset('clockfair',{parent:'town',floor:'.'});
for(const[char,a,b]of[['.',0xb998ae,0x86bcb0],['o',0x71617c,0xd8be91],['p',0xc5b18e,0x81bcb5],['u',0x80b4a9,0xf0cf9b]])registerTile('clockfair',char,{name:`fair-floor-${char}`,pushableFloor:true,ground:'path',build(ctx){land(ctx,{kind:'path'});for(let z=0;z<8;z++)for(let x=0;x<8;x++){const light=char==='.'?(x+z)%4===0:char==='o'?z%3===0:char==='p'?x<2||x>5:Math.abs(x-z)<2;ctx.T.set(ctx.X0+x,0,ctx.Z0+z,light?b:a);}}});
registerTile('clockfair','#',{name:'festival-rail',solid:true,ground:'path',build(ctx){land(ctx,{kind:'path'});ctx.T.box(ctx.X0,1,ctx.Z0+3,ctx.X0+8,4,ctx.Z0+5,0xb7948d);}});
const prop=(kind,lit=false)=>ctx=>{const m=modelMesh(fairModel(kind,lit));m.position.set(ctx.cx,GROUND_Y,ctx.cz);return m;};
const fairArch=offset=>ctx=>{const g=new THREE.Group(),off=modelMesh(fairModel('arch')),on=modelMesh(fairModel('arch',true));g.add(off,on);g.position.set(ctx.cx+offset,GROUND_Y,ctx.cz);g.userData.tick=()=>{on.visible=hasFlag(FAIR.medal);off.visible=!on.visible;};g.userData.tick();return g;};
registerTile('town','V',{...getTile('overworld','y'),name:'clockfair-arch',ground:'path',build:land,prop:fairArch(0)});
registerTile('clockfair','X',{...getTile('overworld','y'),name:'fair-return',build:land,prop:fairArch(.5)});
registerTile('clockfair','Y',{...getTile('overworld','y'),name:'fair-return',build:land});
const clayBreak=ctx=>{ctx.world.setTile(ctx.tx,ctx.tz,'o',{rebuild:false,reason:'fair-clay-broken'});shatterPot(ctx.tx+.5,ctx.tz+.5,.4,[0x986348,0xdb9670],{loot:false});return true;};
registerTile('clockfair','v',{...getTile('overworld','v'),loot:false,regrow:false,becomes:'o',build:ctx=>getTile('clockfair','o').build(ctx),onInteract:ctx=>liftPot(ctx,{loot:false}),onSword:clayBreak,onBomb:clayBreak,onShot:ctx=>ctx.projectile?.source==='pot'&&clayBreak(ctx)});
for(let i=0;i<6;i++)registerTile('clockfair',String(i+1),{name:`fair-bell-${i+1}`,solid:true,blocksShots:true,build:land,prop(ctx){
  const g=new THREE.Group(),off=modelMesh(fairModel('bell')),on=modelMesh(fairModel('bell',true));g.add(off,on);g.position.set(ctx.cx,GROUND_Y,ctx.cz);
  g.userData.tick=time=>{const a=fairMachine()?.ai,done=!!(a?.mask&(1<<i)),lit=a?.phase==='running'&&a.lit&&a.target===i;on.visible=done||lit;off.visible=!on.visible;g.rotation.z=done?Math.sin((time??0)*5+i)*.025:0;};g.userData.tick(0);return g;
},onShot(ctx){if((ctx.projectile?.source??ctx.hit?.source)!=='pot')return false;return fairMachine()?.ring(i)??false;},onSword(){toast('Clay rings this bell while its lamp is bright.',2);return false;}});
registerTile('clockfair','B',{name:'clockfair-board',solid:true,prompt:'Read Clockfair board',build:land,prop:prop('board'),onInteract(ctx){
  if(fairMachine()?.ai.phase==='running'){showDialog(['Listen for the light, not just the noise. Throw a pot at the glowing bell. A dark bell does not count.','The wind-up notes sting. Guard toward the warning or move sideways. Your friends can ring different bells in the same round.'],{speaker:'Tinker Wyll'});return true;}
  const best=fairBest();
  if(hasFlag(FAIR.medal))showDialog(['Six bells together. Your first medal is safe, and the fair is still here.','Try for a better time if you like. Another round pays no extra coins; the clay belongs to everyone.'],{speaker:'Tinker Wyll',choices:['Play another round','Later']}).then(choice=>{if(choice===0&&currentScreen()===ctx.screen)ctx.world.trigger(ctx.tx,ctx.tz,'onClaim',{claim:'fair-start'});});
  else showDialog(['Every spring we borrowed six bells for the fair. Nobody asked whether the next spring could spare them.','Lift clay at the four southern stands with A. A again throws it. Only the glowing bell counts; all six must ring in seventy seconds.','Each lamp blinks until its bell rings, then the next lamp takes over. Stand clear after lifting and I will set out fresh clay. Nothing here drops coins.','The little machine warns before its notes. Bring a shield from King Aldric, or step sideways. Friends share a round, even if one leaves.'],{speaker:'Tinker Wyll',choices:['Ring the six bells','Later']}).then(choice=>{if(choice===0&&currentScreen()===ctx.screen)ctx.world.trigger(ctx.tx,ctx.tz,'onClaim',{claim:'fair-start'});});
  if(best!==null)toast(`Clockfair best: ${best.toFixed(1)} seconds.`,2);return true;
},onClaim(ctx){const m=fairMachine();if(ctx.claim!=='fair-start'||!m||m.ai.phase==='running'||fairRequest()>m.ai.serial)return false;setFlag(`fair:start:${fairRequest()+1}`);return true;}});
