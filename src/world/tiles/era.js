import { defineTileset, registerTile, getTile } from '../tiles.js';
import { openGuardedChest } from '../../systems/tile-actions.js';
import './town.js';
import { land } from './overworld.js';
import { modelProp } from '../tilekit.js';
import { hourgateModel,festivalPennantModel,waterEngineModel,futureSpireModel,dawnSeedModel } from '../../models/era.js';
import { showDialog } from '../../ui/dialog.js';
import { hasFlag,setFlag } from '../../core/state.js';
import { startWarp } from '../../systems/transitions.js';
import { entities } from '../../entities/manager.js';
import { ERA } from '../../systems/era-story.js';
import { toast } from '../../ui/toast.js';
const combatNearby=ctx=>entities.some(e=>!e.removed&&e.kind==='enemy'&&ctx.world.screenAt(e.x,e.z)===ctx.screen);

defineTileset('era-garden',{parent:'town',floor:'.'});
defineTileset('era-ruins',{parent:'overworld',floor:'.'});
const spots=[{area:'v1',screen:[1,1],x:9.5,z:14.5},{area:'mossbrook-past',screen:[0,0],x:7.5,z:12.5},{area:'mossbrook-future',screen:[0,0],x:7.5,z:12.5}];
registerTile('town','@',{name:'hourgate',prompt:'Touch hourgate',solid:true,ground:'path',build:land,prop:modelProp(hourgateModel),
  onInteract(ctx){
    const from=ctx.screen?.key;
    setFlag(ERA.started);
    showDialog('The bell rings through three different skies. Where will you follow it?',{speaker:'The Hourgate',choices:['Mossbrook / today','First Bloom / 300 years ago','Silent Year / 300 years ahead','Stay here']}).then(choice=>{
      if(choice==null||choice>2||choice<0||ctx.world.screenAt(ctx.tx,ctx.tz)?.key!==from)return;
      const dest=ctx.world.resolveSpot(spots[choice]);if(dest)startWarp(dest);
    });
    return true;
  },
});
// Inheritance is explicit: future terrain has no ordinary town buildings.
registerTile('era-ruins','@',{name:'hourgate',prompt:'Touch hourgate',solid:true,ground:'path',build:land,prop:modelProp(hourgateModel),
  onInteract(ctx){
    showDialog('The copper is warm. Somewhere, someone is still winding the clock.',{speaker:'The Hourgate',choices:['Mossbrook / today','First Bloom / 300 years ago','Stay here']}).then(choice=>{
      if(choice===0||choice===1){const dest=ctx.world.resolveSpot(spots[choice]);if(dest)startWarp(dest);}
    });return true;
  },
});
registerTile('town','&',{name:'festival-pennant',solid:true,ground:'grass',build:land,prop:modelProp(festivalPennantModel),prompt:'Read festival ribbon',onInteract(ctx){if(combatNearby(ctx))return false;showDialog('The ribbon reads: A bell for today. A song for tomorrow. The eastern copperwalk leads to the bellmakers\' workshop.',{speaker:'Festival Ribbon'});return true;}});
registerTile('era-ruins','R',{name:'silent-spire',solid:true,ground:'dirt',build:land,prop:modelProp(futureSpireModel),prompt:'Read town memorial',onInteract(ctx){if(combatNearby(ctx))return false;showDialog('Names cover the copper beneath the glass. At the bottom, in a different hand: I am still keeping the garden. Tern.',{speaker:'Mossbrook Memorial'});return true;}});
const seedChest=getTile('overworld','C');
registerTile('era-ruins','C',{...seedChest,name:'dawn-seed-chest',chestLock(ctx){
  const contents=ctx.screen.def.chests?.[`${ctx.x},${ctx.z}`]??ctx.screen.def.chest;
  return contents==='dawn-seed'&&!hasFlag(ERA.repaired)?'First Bloom: start engine':null;
},onPush:ctx=>openGuardedChest(ctx,seedChest.onPush)});
registerTile('era-ruins','b',{name:'reborn-garden',ground:'grass',
  build:ctx=>land({...ctx,owner:{...ctx.owner,area:{...ctx.owner?.area,groundPalette:{grass:[0x76b391,0x497f75,0xb0dbab]}}}}),
  prop:modelProp(dawnSeedModel),
  prompt:'Inspect new growth',onInteract(){showDialog('A green shoot leans toward the light. Three centuries of waiting, and it still knows what to do.',{speaker:'Tomorrow\'s Garden'});return true;},
});
registerTile('era-garden','U',{name:'water-engine',prompt:'Start water engine',solid:true,ground:'path',build:land,prop:modelProp(waterEngineModel),
  onInteract(ctx){
    if(hasFlag(ERA.repaired)){showDialog('The wheel turns. Three centuries of water are on their way.',{speaker:'Water Engine'});return true;}
    const s=ctx.screen;
    if(entities.some(e=>!e.removed&&e.kind==='enemy'&&ctx.world.screenAt(e.x,e.z)===s)){
      toast('Scavengers jam the engine. Clear the garden first.',3);return true;
    }
    setFlag(ERA.repaired);toast('The water returns. What will grow in three hundred years?',4);
    showDialog(['The copper wheel catches. Water hurries beneath the square.','Mira: My grandmother said this engine never worked. We just changed her story.'],{speaker:'First Bloom',voiceSpeakers:[null,'Mira']});return true;
  },
});
