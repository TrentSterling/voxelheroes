import { on } from '../core/events.js';
import { state, setFlag, hasFlag } from '../core/state.js';
import { world } from '../world/world.js';
import { registerGrant } from './grants.js';
import { addAmmo } from '../items/inventory.js';
import { modelMesh } from '../models/kit.js';
import { luckyDiceModel, trailQuiverModel } from '../models/items/hunter.js';
import { toast } from '../ui/toast.js';

registerGrant('rook-dice',()=>setFlag('errand:rook:dice'),{name:'Rook\'s Lucky Dice',fanfare:true,
  model:()=>modelMesh(luckyDiceModel()),text:'Rook\'s Lucky Dice!'});
registerGrant('arrow-bag-1',()=>{
  state.bags.arrows=Math.max(state.bags.arrows??0,1);addAmmo('arrows',30);
},{name:'Trail Quiver',fanfare:true,model:()=>modelMesh(trailQuiverModel()),text:'The Trail Quiver holds thirty arrows!'});

on('room-cleared',({screen})=>{
  if(screen?.area.id!=='rook-den')return;
  const patrol=screen.key==='rook-den:0,2',vault=screen.key==='rook-den:0,0';
  if(!patrol&&!vault)return;
  const flag=patrol?'rook:patrol-cleared':'rook:vault-cleared';
  if(hasFlag(flag))return;
  setFlag(flag);
  world.setTile(screen.x0+8,screen.z0+2,'c',{persist:true,reason:flag});
  if(patrol)for(const x of[7,8])world.setTile(screen.x0+x,screen.z0,'.',{persist:true,reason:flag});
  toast(patrol?'The patrol yields. A bow waits by the wall.':'The vault is clear. Rook\'s dice wait in the chest.',3);
});
