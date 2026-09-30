import { state,defineState,hasFlag } from '../../core/state.js';
import { input } from '../../core/input.js';
import { registerMode,pushMode,popMode } from '../../core/modes.js';
import { registerPlayHook } from '../../systems/flow.js';
import { currentScreen,world } from '../../world/world.js';
import { startWarp } from '../../systems/transitions.js';
import { entities } from '../../entities/manager.js';
import { showOverlay,hideOverlay } from '../overlay.js';
import { saveSlot } from '../../game/saves.js';

defineState('endingViewed',()=>false,{persist:false});
defineState('endingReturnSave',()=>false,{persist:false});
defineState('endingDelay',()=>0,{persist:false});
let page=0,delay=0;
const pages=()=>[
 {title:'The four lights shine again',msg:'The hollow crown breaks into a thousand quiet cubes. Across the coast, the watch, the hive and the valley, the long shadows lift. The road home is open.',kicker:'Adventure complete'},
 {title:'A hero comes home',msg:`${state.profile.name||'Our hero'} carried four temple lights through the dark. ${Math.floor(state.playTime/60)} minutes of adventure, ${state.deaths} fall${state.deaths===1?'':'s'}, and every new day earned together. Mossbrook is waiting.`,kicker:'Your journey'},
 {title:'Voxel Heroes',msg:'A cube adventure by Trent Sterling. Thank you for exploring. Return to Mossbrook, visit King Aldric for your homecoming, and keep adventuring with your friends.',kicker:'The end'},
];
function show(){showOverlay({...pages()[page],button:page===2?'Return to Mossbrook':'Continue',onAction:next});}
function next(){if(delay>0)return;if(page<2){page++;delay=.2;show();return;}state.endingReturnSave=true;popMode();startWarp(world.resolveSpot({area:'v1',screen:[1,1],x:8,z:11,yaw:Math.PI}));}
registerMode('ending',{enter(){page=0;delay=.7;show();},exit(){hideOverlay();},update(dt){delay=Math.max(0,delay-dt);if(input.pressed('confirm'))next();}});
registerPlayHook({id:'campaign-ending',order:95,update(dt){
 if(state.endingReturnSave&&currentScreen()?.area.id==='v1'){state.endingReturnSave=false;saveSlot(1);}
 if(!state.endingViewed&&hasFlag('campaign:complete')&&currentScreen()?.area.id==='tower-final'&&!entities.some(e=>!e.removed&&(e.type==='boss-king'||e.type==='boss-bishop'))){
  state.endingDelay+=dt;
  if(state.endingDelay>=1){state.endingViewed=true;pushMode('ending');}
 }else state.endingDelay=0;
}});
