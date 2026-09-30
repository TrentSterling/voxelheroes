import { launch } from './playtest.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// Real game frames, with disclosed location/equipment fixtures for photography.
// Does not join public multiplayer rooms or alter a user's saved game.
const out=resolve(process.argv[2] || 'playtest-out/portfolio-refresh');
mkdirSync(out,{recursive:true});
const t=await launch({build:false,out,viewport:{width:1200,height:630}});
const receipts=[];
try {
  await t.eval(()=>{window.__voxelHeroes.game.progress.startNewGame({name:'Tront',class:'balanced',prologue:false});});
  await t.step(1.2);
  for(const [name,key,x,z] of [
    ['mossbrook','v1:1,1',7.5,12.5],
    ['crossroads','Crossroads',8,7],
    ['briar-den','rook-den:0,2',8.5,7.5],
    ['amber-queen','d2-boss:0,0',11,12.5],
    ['brineglass','d4-boss:0,0',11.5,12.2],
  ]){
    await t.teleport(key,x,z);
    await t.step(1.8);
    await t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=0;h.game.hero.hero.setFacing('south');});
    await t.step(.02);
    await t.shot(name);
    // Portfolio convention: an unobstructed game view, captured again with only
    // the interface hidden. Geometry, lighting and characters are untouched.
    await t.page.addStyleTag({content:'#ui,#touch,.tront-about{visibility:hidden!important}'});
    await t.shot(name+'-clean');
    await t.page.locator('style').last().evaluate(el=>el.remove());
    const file=name+'.png',bytes=readFileSync(resolve(out,file));
    const clean=readFileSync(resolve(out,name+'-clean.png'));
    receipts.push({file,utc:new Date().toISOString(),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,clean:{file:name+'-clean.png',sha256:createHash('sha256').update(clean).digest('hex'),bytes:clean.length,change:'UI hidden for photography'},state:await t.state(),fixture:{teleport:key,x,z,profile:'balanced',prologue:false}});
  }
  writeFileSync(resolve(out,'receipts.json'),JSON.stringify({description:'Fresh, unedited game screenshots. Isolated browser save; photography uses location/profile fixtures.',captures:receipts,errors:t.errors},null,2));
  console.log(`Captured ${receipts.length} fresh frames in ${out}`);
} finally {await t.close();}
