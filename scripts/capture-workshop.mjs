import { launch } from './playtest.mjs';
import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const out=process.argv[2]??'playtest-out/workshop-beauty';
const t=await launch({build:false,out,viewport:{width:1200,height:630}}),captures=[];
try{
 await t.eval(()=>window.__voxelHeroes.game.progress.startNewGame({prologue:false}));await t.step(1.2);
 for(const [name,key,x,z,powered]of[
  ['01-past-copperwalk','mossbrook-past:1,0',8.5,10.5,false],
  ['02-singing-workshop','mossbrook-past:2,0',8.5,10.5,false],
  ['03-future-copperwalk','mossbrook-future:1,0',8.5,10.5,false],
  ['04-future-copperwalk-restored','mossbrook-future:1,0',8.5,10.5,true],
  ['05-silent-archive','mossbrook-future:2,0',8.5,10.5,false],
  ['06-archive-awake','mossbrook-future:2,0',8.5,10.5,true],
 ]){
  await t.teleport(key,x,z);
  await t.eval(powered=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.kind==='enemy')e.remove();h.state.flags.add('era:water-restored');if(powered)h.state.flags.add('era:archive-powered');else h.state.flags.delete('era:archive-powered');h.player.invT=0;h.game.hero.hero.setFacing('south');},powered);
  await t.step(.4);await t.page.waitForTimeout(2600);
  await t.shot(name);
  await t.page.addStyleTag({content:'#ui,#touch,.tront-about{visibility:hidden!important}'});
  await t.shot(name+'-clean');await t.page.locator('style').last().evaluate(el=>el.remove());
  for(const suffix of['','-clean']){
   const file=name+suffix+'.png';captures.push({file,sha256:createHash('sha256').update(readFileSync(`${out}/${file}`)).digest('hex'),utc:new Date().toISOString(),fixture:{location:key,x,z,patrolRemoved:true,powered,uiHidden:!!suffix}});
  }
 }
 writeFileSync(`${out}/receipts.json`,JSON.stringify({captures,errors:t.errors},null,2));
 if(t.errors.length)throw Error(t.errors.join('\n'));
 console.log('Captured six workshop views with gameplay and clean variants.');
}finally{await t.close();}
