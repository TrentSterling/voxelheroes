import { hasFlag, setFlag } from '../core/state.js';
import { world, currentScreen } from '../world/world.js';
import { registerPlayHook } from './flow.js';
import { grant, registerGrant } from './grants.js';
import { dawnSeedModel } from '../models/era.js';
import { modelMesh } from '../models/kit.js';
import { workshopProp } from '../models/era-workshop.js';

export const ERA={started:'era:bell', repaired:'era:water-restored', seed:'era:dawn-seed', home:'era:homecoming'};
registerGrant('dawn-seed',()=>{
  if(hasFlag(ERA.seed))return;
  setFlag(ERA.seed);
  grant('heart-container',1,{fanfare:false,source:'era-garden'});
},{name:'Dawn Seed',fanfare:true,model:()=>modelMesh(dawnSeedModel()),text:'Dawn Seed! A new heart, a future worth saving.'});
registerGrant('copper-memory',()=>{
  if(hasFlag('era:copper-memory'))return;
  setFlag('era:copper-memory');
  grant('magic-container',2,{fanfare:false,source:'era-archive'});
},{name:'Copper Memory',fanfare:true,model:()=>modelMesh(workshopProp('capacitor')),text:'Copper Memory! Two more magic gems. The town still has a voice.'});

// Derive the future from the shared, saved flag, including when a friend is
// already in that era. Do not cache: save loads and room replication can change
// either flags or tiles independently.
registerPlayHook({id:'era-causality',phase:'after',update(){
  const s=currentScreen();
  if(s?.area.id!=='mossbrook-future'||!hasFlag(ERA.repaired))return;
  if(s.lx!==0||s.ly!==0){
    if(hasFlag('era:archive-powered')){
      if(s.lx===1)for(const z of[6,7,8,11,12,13]){
        if(world.tile(s.x0+7,s.z0+z)==='~')world.setTile(s.x0+7,s.z0+z,'q',{persist:true,reason:'era-archive-drained'});
      }
      if(s.lx===2)for(const x of[6,7,8])for(const z of[6,7,8,11,12,13]){
        if(world.tile(s.x0+x,s.z0+z)==='n')world.setTile(s.x0+x,s.z0+z,'a',{persist:true,reason:'era-archive-lit'});
      }
    }
    return;
  }
  for(const x of[7,8])for(const z of[6,7,8]){
    if(world.tile(s.x0+x,s.z0+z)!=='=')world.setTile(s.x0+x,s.z0+z,'=',{persist:true,reason:'era-water-restored'});
  }
  for(const x of[4,5,10,11])for(const z of[3,4]){
    if(world.tile(s.x0+x,s.z0+z)!=='b')world.setTile(s.x0+x,s.z0+z,'b',{persist:true,reason:'era-garden-reborn'});
  }
  if(hasFlag('dungeon:d2:nursery-vented'))for(const x of[2,3])for(const z of[10,11]){
    if(world.tile(s.x0+x,s.z0+z)!=='b')world.setTile(s.x0+x,s.z0+z,'b',{persist:true,reason:'era-nursery-reborn'});
  }
}});

export function eraJournalEntry(){
  const done=hasFlag(ERA.home),seed=hasFlag(ERA.seed),fixed=hasFlag(ERA.repaired),started=hasFlag(ERA.started);
  return {id:'era-bell',title:'Tomorrow\'s Bell',giver:'Mira',where:'Mossbrook Square',status:done?'done':seed?'ready':started?'active':'offer',
    detail:done?'A garden grows where tomorrow was silent. Mira kept one seed; the others belong to whoever comes next.':seed?'Bring the Dawn Seed back to Mira beside the hourgate in present-day Mossbrook.':fixed?'Return through the hourgate to the Silent Year. The old water engine has grown a crossing to Tern\'s garden.':started?'Visit the First Bloom through the hourgate. Defeat the engine scavengers and restart the water engine. Then see what changes in the Silent Year.':'Find Mira beside the copper hourgate, beside the eastern houses in Mossbrook Square. A bell is ringing from a day that has not happened.',
    progress:done?'A future changed':seed?'Return to Mira':fixed?'The engine is running':started?'Two eras to explore':'A bell out of time',reward:'Dawn Seed + a full heart'};
}

export function archiveJournalEntry(){
 const done=hasFlag('era:voices-returned'),memory=hasFlag('era:copper-memory'),powered=hasFlag('era:archive-powered');
 return {id:'era-archive',title:'Voices in Copper',giver:'Tern',where:'The Silent Year',status:done?'done':memory?'ready':hasFlag(ERA.started)?'active':'offer',
  detail:done?'Tern plays the festival choir in a town that has forgotten silence. The bellmakers left him something worth remembering.':memory?'Bring the Copper Memory to caretaker Tern in the Silent Year square.':powered?'Walk east through the Silent Year copperwalk. Clear the archive sentries and open the glowing memory chest.':'Restore the square engine, then follow the eastern copperwalk in the First Bloom. Clear the workshop belt thieves and tune its pressure valve. A future archive is waiting for power.',
  progress:done?'The choir sings again':memory?'Return to Tern':powered?'Recover the archive memory':'Tune the past workshop',reward:'Two permanent magic gems'};
}
