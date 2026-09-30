import { registerTile,getTile } from '../tiles.js';
import { hasFlag } from '../../core/state.js';
import { enterWarp } from '../../systems/transitions.js';
import { modelMesh } from '../../models/kit.js';
import { fourLightGateModel } from '../../models/foes/crown.js';
import { GROUND_Y } from '../../core/constants.js';
import { toast } from '../../ui/toast.js';
const awake=()=>[1,2,3,4].every(n=>hasFlag('orb:'+n));
function gate(ctx){if(awake())enterWarp(ctx);else toast('Four temple lights open the tower. You have '+[1,2,3,4].filter(n=>hasFlag('orb:'+n)).length+' of four.',3);}
gate.isWarp=true;
registerTile('overworld','@',{name:'four-light-tower',ground:'grass',build:ctx=>getTile('overworld','D').build(ctx),
  prop:ctx=>{const m=modelMesh(fourLightGateModel());m.position.set(ctx.cx,GROUND_Y,ctx.cz-0.5);return m;},onEnter:gate});
