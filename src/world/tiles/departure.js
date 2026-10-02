import { registerTile, getTile } from '../tiles.js';
import { openGuardedChest } from '../../systems/tile-actions.js';
import './era-workshop.js';
import { land } from './overworld.js';
import { modelProp } from '../tilekit.js';
import { departureProp } from '../../models/departure.js';
import { hasFlag, setFlag } from '../../core/state.js';
import { entities } from '../../entities/manager.js';
import { showDialog } from '../../ui/dialog.js';
import { toast } from '../../ui/toast.js';
import { grant } from '../../systems/grants.js';
import { DEPARTURE } from '../../systems/departure-story.js';
import { currentScreen } from '../world.js';

const busy = ctx => entities.some(e => !e.removed && e.kind === 'enemy' && ctx.world.screenAt(e.x,e.z) === ctx.screen);
// Four distinguishable native floor materials, shared across the two eras.
for (const set of ['era-garden','era-ruins']) {
  registerTile(set,'Q',{name:'station-low-rail',solid:true,ground:'path',build(ctx){
    land(ctx,{kind:'path'});
    const post=set==='era-garden'?0xb58c64:0x728a9b,bar=0xd3ad83;
    for(const x of[1,6])for(let y=1;y<=4;y++)for(const z of[3,4])ctx.T.set(ctx.X0+x,y,ctx.Z0+z,post);
    for(let x=0;x<8;x++)for(const z of[3,4])ctx.T.set(ctx.X0+x,3,ctx.Z0+z,bar);
  }});
  for (const [char,kind,a,b] of [['j','station-boards',0x866f87,0xd3ad83],['k','platform-edge',0x6c91a1,0xe7c58d],['u','ticket-mosaic',0x8abbb1,0x9c7694],['w','signal-grate',0x465e79,0x93aaa6]])
    registerTile(set,char,{name:kind,decor:true,ground:'path',pushableFloor:true,build(ctx) {
      land(ctx,{kind:'path'});
      for(let z=0;z<8;z++)for(let x=0;x<8;x++) {
        const line=char==='j'?z%3===0:char==='k'?x<2:char==='u'?(x+z)%4===0:x%2===0&&z>0&&z<7;
        ctx.T.set(ctx.X0+x,0,ctx.Z0+z,line?b:a);
      }
    }});
  for (const [char,kind] of [['Z','signal'],['Y','lit'],['B','bench']]) registerTile(set,char,{name:`departure-${kind}`,decor:true,solid:true,ground:'path',build:land,prop:modelProp(()=>departureProp(kind))});
}
registerTile('town','Y',{name:'homeward-station-light',solid:false,ground:'path',build:land,prop:modelProp(()=>departureProp('lit')),prompt:'Read station light',onInteract(){
  showDialog('A little station light. Beneath it: FOR ANYONE STILL ON THEIR WAY.',{speaker:'Homeward Chime'});return true;
}});
registerTile('era-garden','S',{name:'past-station-signal',solid:true,ground:'path',build:land,prop:modelProp(()=>departureProp('signal')),prompt:'Repair station signal',onInteract(ctx){
  setFlag(DEPARTURE.started);
  if(hasFlag(DEPARTURE.powered)){showDialog(['The lamp is still lit. I think I can wait a little longer.','If you go forward, take the copperwalk south in the Silent Year. Someone should tell that old bell it can come home.'],{speaker:'Tern'});return true;}
  if(!hasFlag('era:water-restored')||!hasFlag('era:archive-powered')){toast('The station needs the square engine and tuned workshop valve.',3);return true;}
  if(busy(ctx)){toast('The signal thieves are still on the platform.',3);return true;}
  setFlag(DEPARTURE.powered);ctx.world.setTile(ctx.tx,ctx.tz,'J',{persist:true,reason:'departure-signal-restored'});
  showDialog(['The signal is green. Thank you. I will leave a lamp by the track.','If they are late, they can still see the way home.'],{speaker:'Tern'});return true;
}});
// Keep a repaired signal interactive for late arrivals and old saves.
const lit=getTile('era-garden','Y');
registerTile('era-garden','J',{...getTile('era-garden','S'),prop:lit.prop,name:'past-station-inscription',prompt:'Read first departure'});
registerTile('era-ruins','S',{name:'future-station-signal',solid:true,ground:'path',build:land,prop:modelProp(()=>departureProp('signal')),prompt:'Answer the last signal',onInteract(ctx){
  setFlag(DEPARTURE.started);
  if(busy(ctx)){toast('The bell courier is still calling. Dodge its marked notes; strike when its shutters open.',3);return true;}
  if(hasFlag(DEPARTURE.home)){showDialog(['The last departure is closed. The courier can rest.','I was afraid letting it stop would mean nobody had needed us. But you came.'],{speaker:'Tern'});return true;}
  if(!hasFlag(DEPARTURE.tag)){showDialog(['I know that bell. I sent it out in my first spring.','For six hundred years it kept my last instruction: wait until everyone is aboard.','The old signal needs power from the First Bloom station. Then recover its departure tag from the chest across this platform.'],{speaker:'Tern'});return true;}
  showDialog(['One passenger still waiting. It wrote my name.','I cannot tell it to wait forever again. Will you help me call it home?'],{speaker:'Tern',choices:['Call the courier home','Let me think']}).then(choice=>{
    if(choice!==0||currentScreen()?.key!==ctx.screen.key)return;
    // Claim authority stays stable as both players close their conversations.
    ctx.world.trigger(ctx.tx,ctx.tz,'onClaim');
  });return true;
},onClaim(ctx){
  if(ctx.screen.key!=='mossbrook-future:1,1'||!hasFlag(DEPARTURE.tag)||hasFlag(DEPARTURE.claimed)||busy(ctx))return false;
  setFlag(DEPARTURE.claimed);grant('departure-chime',1,{source:'departure-station'});return true;
}});
registerTile('era-ruins','E',{...getTile('era-ruins','S'),name:'restored-station-signal',prop:modelProp(()=>departureProp('lit'))});
const chest=getTile('overworld','C');
registerTile('era-ruins','D',{...chest,name:'departure-tag-chest',chestLock(ctx){
  if(!hasFlag(DEPARTURE.powered))return 'First Bloom: fix signal';
  if(busy(ctx))return 'Defeat Bell Courier';
  return null;
},onPush:ctx=>openGuardedChest(ctx,chest.onPush)});
