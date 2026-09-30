import { Npc } from '../npc.js';
import { registerEntity } from '../registry.js';
import { TOWNSFOLK } from './npc.js';
import { makeHero } from '../../models/hero.js';
import { getMaterial } from '../../core/materials.js';
import { state } from '../../core/state.js';
import { showDialog } from '../../ui/dialog.js';
import { spendCoins } from '../../game/vitals.js';
import { grant, registerGrant } from '../../systems/grants.js';
import { addAmmo } from '../../items/inventory.js';

registerGrant('bomb-bag-1', () => { state.bombBag = Math.max(1, state.bombBag ?? 0); addAmmo('bombs', 20); },
  { name: 'Powderwright Bag', fanfare: true, text: 'A larger bomb bag! Carry twenty bombs.' });
registerGrant('bomb-bag-2', () => { state.bombBag = Math.max(2, state.bombBag ?? 0); addAmmo('bombs', 30); }, { name:'Deep Powder Bag',fanfare:true,text:'Thirty bombs!' });
class Powderwright extends Npc {
  constructor(opts) {
    super(opts, {name:'Powderwright Pell',schedule:'always',rig:makeHero(getMaterial('character'),{...TOWNSFOLK,tunic:0x487589,cap:0xd6b365,extras:['glasses']})});
  }
  async talk() {
    const speaker={speaker:this.name};
    if(state.bombBag>=1)return showDialog('Twenty bombs in a good bag. Mind the fuse.',speaker);
    const choice=await showDialog('A larger bag holds twenty bombs. Two hundred coins; shall I stitch one?',{...speaker,choices:['Buy for 200 coins','Leave']});
    if(choice!==0 || state.bombBag>=1)return;
    if(!spendCoins(200,'bomb-bag'))return showDialog('Bring two hundred coins and I will make it.',speaker);
    grant('bomb-bag-1',1,{source:'npc'});
  }
}
registerEntity('bomb-upgrader',opts=>new Powderwright(opts));
