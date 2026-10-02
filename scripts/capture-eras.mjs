import { launch } from './playtest.mjs';
import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const out=process.argv[2] ?? 'playtest-out/era-beauty';
const t=await launch({build:false,out,viewport:{width:1200,height:630}}),captures=[];
try{
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});});
 await t.step(1.2);
 for(const [name,key,x,z,repaired]of[
  ['01-mossbrook','v1:1,1',8,14,false],
  ['02-first-bloom','mossbrook-past:0,0',8.5,7.5,false],
  ['03-silent-year','mossbrook-future:0,0',7.5,11,false],
  ['04-garden-reborn','mossbrook-future:0,0',7.5,11,true],
 ]){
  await t.teleport(key,x,z);
  await t.eval(repaired=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.kind==='enemy')e.remove();if(repaired)h.state.flags.add('era:water-restored');h.player.invT=0;h.game.hero.hero.setFacing('south');},repaired);
  await t.step(.4);await t.page.waitForTimeout(2600);
  await t.shot(name);
  await t.page.addStyleTag({content:'#ui,#touch,.tront-about{visibility:hidden!important}'});
  await t.shot(name+'-clean');await t.page.locator('style').last().evaluate(el=>el.remove());
  for(const suffix of['','-clean']){
   const file=name+suffix+'.png',bytes=readFileSync(out+'/'+file);
   captures.push({file,sha256:createHash('sha256').update(bytes).digest('hex'),utc:new Date().toISOString(),fixture:{location:key,x,z,patrolRemoved:true,repaired,uiHidden:!!suffix}});
  }
 }
 writeFileSync(out+'/receipts.json',JSON.stringify({captures,errors:t.errors},null,2));
 console.log('Captured four era views with gameplay and clean variants.');
}finally{await t.close();}
