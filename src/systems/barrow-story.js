import { hasFlag, setFlag } from '../core/state.js';
import { registerGrant, grant } from './grants.js';
import { registerPlayHook } from './flow.js';
import { currentScreen, world } from '../world/world.js';
import { ECHO } from '../entities/barrow-bell.js';
import { echoMemoryModel } from '../models/barrow-echo.js';
import { modelMesh } from '../models/kit.js';

registerGrant('barrow-memory',()=>{
  if(hasFlag(ECHO.memory))return;
  setFlag(ECHO.memory);grant('magic-container',1,{fanfare:false,source:'barrow-echo'});
},{name:'Echo Memory',fanfare:true,model:()=>modelMesh(echoMemoryModel()),text:'Echo Memory! One more magic gem. The old bell remembers tomorrow.'});
registerPlayHook({id:'barrow-memory-chest',phase:'after',update(){
  const s=currentScreen();if(s?.key!=='d1:2,4'||!hasFlag(ECHO.cleared)||!hasFlag(ECHO.muted))return;
  if(world.tile(s.x0+12,s.z0+8)==='h')world.setTile(s.x0+12,s.z0+8,'c',{persist:true,reason:'barrow-memory'});
}});
export function barrowJournalEntry() {
  const done=hasFlag(ECHO.memory),quiet=hasFlag(ECHO.muted),clear=hasFlag(ECHO.cleared);
  return {id:'barrow-echo',title:'The Note Beneath',giver:'A copper inscription',where:'Old Barrow: Crossed Bones',status:done?'done':quiet&&clear?'ready':hasFlag('dungeon:d1:entered')?'active':'offer',
    detail:done?'The buried bell remembers Mossbrook. Its copper note now travels with you.':quiet&&clear?'Both waves are down. Open the eastern memory chest in Crossed Bones.':clear?'Throw a pot at the copper bell. Its quiet note opens the eastern memory chest.':'Throw a pot at the bell in Crossed Bones. Defeat both waves and open the east chest.',
    progress:done?'A note recovered':quiet&&clear?'Memory chest revealed':clear?'Quiet the old bell':quiet?'Bell quieted; guardians remain':'Two waves and a copper bell',reward:'Echo Memory + a magic gem'};
}
