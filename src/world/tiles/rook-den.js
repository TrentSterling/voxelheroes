import { defineTileset, registerTile, getTile } from '../tiles.js';
import './town.js';
import { fineFloor } from './dungeon.js';
import { modelProp, revealBurst } from '../tilekit.js';
import { arrowRackModel, arrowTargetModel, briarGateModel, briarBridgeModel } from '../../models/items/hunter.js';
import { hasFlag, setFlag } from '../../core/state.js';
import { emit } from '../../core/events.js';
import { sfx } from '../../core/audio.js';
import { hasItem, ammo, addAmmo } from '../../items/inventory.js';
import { toast } from '../../ui/toast.js';
import { showDialog } from '../../ui/dialog.js';

defineTileset('rook-den',{parent:'dungeon',floor:'.'});
function openDen(ctx){
  if(!ctx.world.setTile(ctx.tx,ctx.tz,'j',{persist:true,reason:'rook-den'}))return false;
  setFlag('rook:den-open');revealBurst(ctx.tx,ctx.tz,[0x416d36,0x83a657]);
  emit('secret-found',{kind:'briar-den',tx:ctx.tx,tz:ctx.tz});return true;
}
registerTile('town','K',{...getTile('overworld','K'),onSword:openDen,onBomb:openDen});
registerTile('rook-den','d',{name:'briar-gate',solid:true,doorway:true,becomes:'.',build:fineFloor,prop:modelProp(briarGateModel),
  prompt:'Inspect gate',onInteract(){toast('Defeat both sentries to open this gate.',2);return true;},
});
registerTile('rook-den','+',{name:'briar-bridge',build:fineFloor,prop:modelProp(briarBridgeModel)});
registerTile('rook-den','&',{name:'arrow-rack',solid:true,prompt:'Take arrows',build:fineFloor,prop:modelProp(arrowRackModel),
  onInteract(){
    if(!hasItem('bow')){toast('Clear the patrol to find the bow.',2);return false;}
    const before=ammo('arrows');addAmmo('arrows',10);
    toast(ammo('arrows')===before?'Your quiver is full.':'Ten arrows. Aim across the span.',2);sfx.gem();return true;
  },
});
const targetFlag=(x,z)=>`rook:target:${x},${z}`;
function makeBridge(ctx){
  if(hasFlag('rook:bridge')||!hasFlag(targetFlag(5,2))||!hasFlag(targetFlag(10,2)))return;
  for(let z=4;z<=6;z++)for(const x of[7,8])ctx.world.setTile(ctx.screen.x0+x,ctx.screen.z0+z,'+',{persist:true,reason:'rook-bridge'});
  setFlag('rook:bridge');toast('Both targets answered. The bridge is down!',3);
  emit('secret-found',{kind:'arrow-bridge',tx:ctx.tx,tz:ctx.tz});
}
registerTile('rook-den','%',{name:'arrow-target',solid:true,prompt:'Read target',build:fineFloor,prop:modelProp(()=>arrowTargetModel(false)),
  onInteract(){showDialog('An arrow flies where steel cannot reach. Hit both far-bank targets to lower the bridge.',{speaker:'Range target'});return true;},
  onSword(){sfx.block();return false;},
  onShot(ctx){
    if(ctx.projectile?.source!=='arrow')return false;
    ctx.world.setTile(ctx.tx,ctx.tz,':',{persist:true,reason:'rook-target'});
    setFlag(targetFlag(ctx.x,ctx.z));revealBurst(ctx.tx,ctx.tz,[0xe4d2a0,0x80bf65]);sfx.block();makeBridge(ctx);return true;
  },
});
registerTile('rook-den',':',{name:'lit-arrow-target',solid:true,build:fineFloor,prop:modelProp(()=>arrowTargetModel(true))});
