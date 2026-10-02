import { registerTile, getTile } from '../tiles.js';
import { openGuardedChest } from '../../systems/tile-actions.js';
import './era.js';
import { land } from './overworld.js';
import { modelProp,cutPlant } from '../tilekit.js';
import { workshopProp } from '../../models/era-workshop.js';
import { showDialog } from '../../ui/dialog.js';
import { hasFlag,setFlag } from '../../core/state.js';
import { entities } from '../../entities/manager.js';
import { toast } from '../../ui/toast.js';

const colors={cobble:[0xaa9fba,0x7d788f],mosaic:[0x89b8b0,0xe0bd86],brick:[0xa57c82,0x685f79],rail:[0x667f98,0xc99b66],glass:[0x66afb9,0x416b8c],drain:[0x657183,0x38465a]};
function surface(kind){return ctx=>{
  land(ctx,{kind:'path'});const [a,b]=colors[kind];
  for(let z=0;z<8;z++)for(let x=0;x<8;x++){
    const seam=kind==='rail'?(x===2||x===5):kind==='drain'?(x%2===0&&z>1&&z<6):kind==='mosaic'?((x+z)%4===0):kind==='glass'?(x===0||z===0):(z%4===0||(x+(Math.floor(z/4)%2)*2)%4===0);
    ctx.T.set(ctx.X0+x,0,ctx.Z0+z,seam?b:a);
  }
};}
// Identical mechanical meaning across eras, with different nearby materials.
for(const set of['era-garden','era-ruins']){
  for(const [char,kind] of[['o','cobble'],['a','mosaic'],['e','brick'],['l','rail'],['q','glass'],['n','drain']])registerTile(set,char,{name:`era-${kind}`,ground:'path',build:surface(kind)});
  for(const [char,kind,solid] of[['(','bench',true],[']','crate',true],['|','pipe',true],['r','reeds',false],['!','lamp',true],['%','gear',true],['+','flowers',false],[';','salvage',false]]){
    const lines={bench:'The seat is worn smooth. Bellmakers waited here for the last note of every working day.',crate:'Spare copper belts. Someone packed them for a workshop that would outlive them.',pipe:'The copper pipe runs toward the eastern workshop. Its valves need the square engine.',lamp:'A sea-glass lamp. A little piece of daylight, saved for when the sun is gone.',gear:'The bellmakers cast this gear with three hundred teeth. One for each year they hoped it would turn.'};
    registerTile(set,char,{name:`era-${kind}`,solid,ground:'grass',build:land,prop:modelProp(()=>workshopProp(kind)),
      ...(solid?{prompt:`Inspect ${kind}`,onInteract(ctx){if(entities.some(e=>!e.removed&&e.kind==='enemy'&&ctx.world.screenAt(e.x,e.z)===ctx.screen))return false;showDialog(kind==='pipe'&&hasFlag('era:archive-powered')?'Pressure steady. Water and voices are finding their way east.':lines[kind],{speaker:'Copperwalk'});return true;}}:{becomes:'.',onSword:ctx=>cutPlant(ctx,[0x72cfc0,0xd3a05e,0xa57c82]),onBomb:ctx=>cutPlant(ctx,[0x72cfc0,0xd3a05e,0xa57c82])}),
    });
  }
  registerTile(set,'?',{name:'workshop-sign',solid:true,ground:'path',build:land,prop:modelProp(()=>workshopProp('console')),prompt:'Read workshop log',onInteract(ctx){if(entities.some(e=>!e.removed&&e.kind==='enemy'&&ctx.world.screenAt(e.x,e.z)===ctx.screen))return false;showDialog(ctx.screen.def.log??'Copper remembers every hand that shaped it.',{speaker:ctx.screen.name});return true;}});
}
registerTile('era-garden','V',{name:'workshop-valve',solid:true,ground:'path',build:surface('mosaic'),prop:modelProp(()=>workshopProp('gear')),prompt:'Tune pressure valve',onInteract(ctx){
  if(hasFlag('era:archive-powered')){showDialog('The valves sing in tune. Someone will hear us on the other side.',{speaker:'Copper Workshop'});return true;}
  if(!hasFlag('era:water-restored')){toast('Start the square water engine first. These pipes need pressure.',3);return true;}
  if(entities.some(e=>!e.removed&&e.kind==='enemy'&&ctx.world.screenAt(e.x,e.z)===ctx.screen)){toast('The belt thieves are still here. Clear the workshop.',3);return true;}
  setFlag('era:archive-powered');showDialog(['The tuning fork answers the last valve. The workshop falls into rhythm.','A message clicks out on copper tape: FOR ANYONE WHO FINDS THIS, WE WERE HERE.','Mira: Tern said there was nobody left. What if the town left him a voice?'],{speaker:'Mira',voice:true});return true;
}});
const chest=getTile('overworld','C');
registerTile('era-ruins','A',{...chest,name:'archive-memory-chest',chestLock(ctx){
  if(!hasFlag('era:archive-powered'))return 'First Bloom: tune valves';
  if(entities.some(e=>!e.removed&&e.kind==='enemy'&&ctx.world.screenAt(e.x,e.z)===ctx.screen))return 'Clear archive sentries';
  return null;
},onPush:ctx=>openGuardedChest(ctx,chest.onPush)});
