import {registerTile} from '../tiles.js';
import {land} from './overworld.js';
import {modelProp} from '../tilekit.js';
import {waysideSpringModel} from '../../models/wayside-spring.js';
import {entities} from '../../entities/manager.js';
import {state} from '../../core/state.js';
import {heal} from '../../game/vitals.js';
import {toast} from '../../ui/toast.js';
import {sparks} from '../../systems/particles.js';
import {GROUND_Y} from '../../core/constants.js';

registerTile('overworld','O',{name:'wayside-spring',solid:true,ground:'grass',build:land,
  prop:modelProp(waysideSpringModel),prompt:'Drink spring',onInteract(ctx) {
    if(entities.some(e=>!e.removed&&e.kind==='enemy'&&e.countsForClear!==false)) {
      toast('Clear barrow guards.',2.5); return true;
    }
    const restored=heal(state.maxHp,'wayside-spring');
    if(restored) sparks(ctx.tx+.5,GROUND_Y+.4,ctx.tz+.5,[0x91d5c2,0xe4d297],12);
    toast(restored?'Hearts restored.':'Hearts already full.',2.5);
    return true;
  },
});
