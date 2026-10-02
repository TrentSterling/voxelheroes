import { Npc } from '../npc.js';
import { registerEntity } from '../registry.js';
import { makeHero } from '../../models/hero.js';
import { getMaterial } from '../../core/materials.js';
import { hasFlag,setFlag } from '../../core/state.js';
import { showDialog } from '../../ui/dialog.js';
import { ERA } from '../../systems/era-story.js';
import { MIRA_PALETTE, MIRA_TRAVEL, MIRA_CHOICES, setMiraTravelling, TERN_TRAVEL, talkToTern } from '../../game/companions.js';
import { makeTern } from '../../models/tern.js';
import { DEPARTURE } from '../../systems/departure-story.js';
import { world, currentScreen } from '../../world/world.js';

class Mira extends Npc {
 constructor(opts){super(opts,{name:'Mira',schedule:'always',wander:0,personality:'worker',barks:{greet:'Did you hear tomorrow?',idle:'One more turn...',startled:'Mind the lens!',ouch:'Careful!'},rig:makeHero(getMaterial('character'),MIRA_PALETTE)});this.era=opts.era;}
 update(dt){
  if(hasFlag(MIRA_TRAVEL)){if(this.holder.visible)this.bubble.dispose();this.holder.visible=false;this.out=false;this.solid=false;return;}
  this.holder.visible=true;this.out=true;this.solid=true;super.update(dt);
 }
 talk(){
  const speaker={speaker:'Mira',choices:MIRA_CHOICES};
  const decide=promise=>promise.then(choice=>{if(choice!==null)setMiraTravelling(choice===0);});
  if(this.era==='past')return decide(showDialog(hasFlag(ERA.repaired)?['Listen. That water will still be running when everyone we know is gone.','Come on. I want to see what we made possible.']:['Same square. Different sky. Those roofs are the color underneath ours.','The engine scavengers are chewing its drive belts. Clear them out, then turn the copper wheel.','If it runs for three hundred years... maybe tomorrow still gets a garden.'],speaker));
  if(hasFlag(ERA.seed)){
   setFlag(ERA.home);
   return decide(showDialog(['A seed? From that empty town?','Keep it. I was trying to fix a clock. You found someone on the other side who needed us.','The four old temples use the same copper as this gate. Whatever broke time did not start here.'],speaker));
  }
  setFlag(ERA.started);
  return decide(showDialog(['The town bell rang thirteen times this morning. We only hung twelve bells.','I followed the extra note into this clock. There is a Mossbrook inside it where nobody answers their door.','Touch the copper hourgate beside me. Visit the Silent Year, then help me restart the old water engine in the First Bloom.','Bring a sword. King Aldric at Crownhold, south of town, can lend you one. I brought a wrench. It was optimistic.'],speaker));
 }
}
class Tern extends Npc {
 constructor(opts){super(opts,{name:'Tern',schedule:'always',rig:makeTern()});this.era=opts.era;}
 update(dt){
  if(hasFlag(TERN_TRAVEL)){if(this.holder.visible)this.bubble.dispose();this.holder.visible=false;this.out=false;this.solid=false;return;}
  this.holder.visible=true;this.out=true;this.solid=true;super.update(dt);
 }
 talk(){
  if(this.era==='station'){
   const screen=currentScreen();return world.trigger(screen.x0+3,screen.z0+4,'onInteract');
  }
  if(hasFlag('era:voices-returned'))return talkToTern();
  if(hasFlag('era:copper-memory')){
   setFlag('era:voices-returned');
   return showDialog(['A festival choir. I have heard birds, and rain, and the wheels in my chest. Never this.', 'They left their names in the tape. They thought someone would come looking.', 'Tomorrow I will play it in the square. Perhaps the garden would like to hear it too.'],{speaker:'Tern'}).then(talkToTern);
  }
  if(hasFlag('era:archive-powered'))return showDialog(['The eastern archive is awake. I can hear its lamps from here.','Please recover its memory from the sentries. Something of my town might still be inside.'],{speaker:'Tern'});
  return showDialog(hasFlag(ERA.repaired)?['Water detected. Root pressure rising. Oh.','I practiced saying thank you for two hundred years. I thought I had forgotten how.','The seed chest is across the new bridge. Please take one somewhere people still sing.']:['Caretaker Tern. Municipal garden service. Population: one.','I kept the seed chest above the flood. The old water engine stopped before my first spring.','If you meet the people who built it, tell them I am still here.'],{speaker:'Tern'});}
}
class FirstSpringTern extends Npc {
 constructor(opts){super(opts,{name:'Tern',schedule:'always',wander:0,rig:makeTern()});}
 talk(){
  setFlag(DEPARTURE.started);
  return showDialog(hasFlag(DEPARTURE.powered)?[
   'The lamp is still lit. I think I can wait a little longer.',
   'If you go forward, take the copperwalk south in the Silent Year. Someone should tell that old bell it can come home.'
  ]:[
   'Caretaker Tern. First day. I am practicing departures.',
   'The last courier never came back. Its bell keeps ringing on the east platform.',
   'The signal thieves stole its copper. Clear them, then repair the regulator beside me. It needs the square engine and workshop.',
   'I could close the route. But what if someone is still waiting?'
  ],{speaker:'Tern'});
 }
}
registerEntity('npc-mira',opts=>new Mira(opts));
registerEntity('npc-tern',opts=>new Tern(opts));
registerEntity('npc-tern-first',opts=>new FirstSpringTern(opts));
