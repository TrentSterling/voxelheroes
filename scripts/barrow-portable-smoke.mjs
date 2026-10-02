import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {firefox} from 'playwright';
import {launch} from './playtest.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/barrow-portable';
const url=process.argv.find(a=>a.startsWith('--url='))?.slice(6)??'http://127.0.0.1:5173/dist-artifact/voxel-heroes.html';
const tern=process.argv.includes('--tern');
const guidance=process.argv.includes('--guidance');
const hive=process.argv.includes('--hive');
const watch=process.argv.includes('--watch');
const brine=process.argv.includes('--brineglass');
const mara=process.argv.includes('--mara');
mkdirSync(out,{recursive:true});
const report={utc:new Date().toISOString(),ok:false,artifactSha256:createHash('sha256').update(readFileSync('dist-artifact/voxel-heroes.html')).digest('hex'),checks:[],scope:'Muted portable HTML startup and first barrow encounter in Chromium and Firefox; no recorded voice playback or decoding.'};
let fox;
try{
 fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
 for(const [name,browser]of[['chromium',null],['firefox',fox]]){
  const t=await launch({url,browser,out:`${out}/${name}`});
  try{
   assert.equal((await t.state()).mode,'title');
   await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);});
   await t.teleport('d1:2,4',8.5,7.5);await t.step(1.3);
   assert.equal(await t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.type==='barrow-bell').length),1);
   assert.equal(await t.eval(()=>window.__voxelHeroes.game.combat.roomClearBlocked()),true);
   assert.equal(await t.eval(()=>window.__voxelHeroes.game.journal.journalView().entries.some(e=>e.title==='The Note Beneath')),true);
   assert.deepEqual(t.errors,[]);
   await t.shot('01-portable-barrow');
   if(tern){
    // The encounter check intentionally leaves three live guards. Test portable
    // companion input in the quiet town, rather than during their hit recovery.
    await t.teleport('v1:1,1',8,10);
    await t.step(.5);
    await t.eval(async()=>{const h=window.__voxelHeroes;h.game.grants.grant('copper-memory',1,{fanfare:false});h.game.state.setFlag('era:voices-returned');h.game.companions.setMiraTravelling(true);h.game.companions.setTernTravelling(true);await h.step(.2);h.input.down('guard');h.input.tap('sword');await h.tick();h.input.up('guard');await h.tick();});
    const c=await t.eval(()=>window.__voxelHeroes.game.companions.companionView());assert.equal(c.tern.visible,true);assert.equal(c.mira.visible,true);assert.equal(c.shelterCount,1);assert.ok(c.wardT>2.9);assert.equal(await t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.kind==='companion'&&!e.removed).length),2);assert.deepEqual(t.errors,[]);
    await t.shot('02-portable-shelter');
   }
   if(guidance){
    await t.teleport('v1:1,1',8,10);
    await t.eval(()=>{const h=window.__voxelHeroes;h.game.journal.openJournal('era-bell');h.render();assertUi(h.game.ui.pressUi('journal-track'));function assertUi(value){if(!value)throw Error('Portable Track action missing');}h.game.journal.closeJournal();h.render();});
    assert.equal(await t.eval(()=>window.__voxelHeroes.game.objective.trackedQuestId()),'era-bell');
    const save=await t.save();await t.load(save);assert.equal(await t.eval(()=>window.__voxelHeroes.game.objective.trackedQuestId()),'era-bell');
    await t.eval(()=>{const h=window.__voxelHeroes;h.render();h.game.ui.pressUi('objective-open');h.render();});
    assert.equal(await t.eval(()=>window.__voxelHeroes.game.journal.journalView().selectedId),'era-bell');
    await t.shot('03-portable-tracked-journal');
    await t.eval(()=>{const h=window.__voxelHeroes;h.game.state.setFlag('era:homecoming');h.render();});
    assert.equal(await t.eval(()=>window.__voxelHeroes.game.objective.trackedQuestId()),null);assert.deepEqual(t.errors,[]);
   }
   if(hive){
    await t.teleport('d2:3,1',2.5,6);await t.step(1.4);await t.give('bombs');
    await t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=999;for(const e of h.entities.filter(e=>e.kind==='enemy'))e.die();h.game.hero.hero.place(4.5,4.5);h.game.hero.hero.setFacing('north');h.game.inventory.selectItem('bombs');});
    assert.equal(await t.eval(()=>window.__voxelHeroes.game.combat.roomClearBlocked()),true);
    await t.tap('item');await t.step(2.3);
    assert.equal(await t.eval(()=>window.__voxelHeroes.state.flags.has('dungeon:d2:nursery-valve:0')),true);
    const save=await t.save();await t.load(save);await t.step(.3);
    assert.equal(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+4,s.z0+3);}), 'd');
    assert.equal(await t.eval(()=>window.__voxelHeroes.entities.find(e=>e.type==='hive-pressure').ai.phase!=='vented'),true);
    await t.eval(()=>{window.__voxelHeroes.player.hero.root.visible=true;});await t.shot('04-portable-hive');assert.deepEqual(t.errors,[]);
   }
   if(watch){
    await t.give('grapple');await t.teleport('d3:1,7',5.5,7.5);await t.step(1.5);
    await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();for(const e of [...h.entities])if(e.type==='skeleton')e.die();const e=h.entities.find(e=>e.type==='watch-sentinel');e.x=s.x0+5.5;e.z=s.z0+4.5;e.yaw=0;e.ai.watch.phase='hunt';e.ai.watch.t=999;e.think=()=>{};h.game.hero.hero.place(5.5,7.5);h.game.hero.hero.setFacing('north');h.game.inventory.selectItem('grapple');h.player.invT=999;});
    await t.tap('item');await t.step(.3);assert.equal(await t.eval(()=>{const e=window.__voxelHeroes.entities.find(e=>e.type==='watch-sentinel');return e.hp===18&&e.ai.watch.openT>3.5&&e.mesh.pose==='open';}),true);
    await t.give('sun-dial');await t.teleport('sunreach:2,3',8.5,5.6);await t.eval(()=>window.__voxelHeroes.game.hero.hero.setFacing('south'));await t.tap('item');await t.step(.1);assert.equal(await t.eval(()=>window.__voxelHeroes.entities.find(e=>e.type==='grapple-hook')?.range),8);await t.step(1.4);assert.ok((await t.state()).lz>12);
    const saved=await t.save();await t.load(saved);assert.equal(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('sun-dial')),true);await t.shot('05-portable-watch-upgrade');assert.deepEqual(t.errors,[]);
   }
   if(brine){
    await t.give('fire-wand');await t.teleport('d4:0,7',5.5,8.5);await t.step(1.5);
    await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),es=h.entities.filter(e=>e.type==='tideglass-skater');es[1].die();const e=es[0];e.x=s.x0+5.5;e.z=s.z0+5.5;e.hp=18;e.ai.tide.phase='hunt';e.ai.tide.t=999;e.think=()=>{};h.game.hero.hero.place(5.5,8.5);h.game.hero.hero.setFacing('north');h.game.inventory.selectItem('fire-wand');h.player.invT=999;});
    await t.tap('item');await t.step(.4);assert.equal(await t.eval(()=>{const e=window.__voxelHeroes.entities.find(e=>e.type==='tideglass-skater');return e.hp===12&&e.ai.tide.openT>4.5&&e.mesh.pose==='open';}),true);
    await t.give('ember-lens');await t.teleport('tidecoast:0,2',8.5,10.5);await t.eval(()=>window.__voxelHeroes.game.hero.hero.setFacing('north'));await t.tap('item');await t.step(.6);assert.equal(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return[7,8].every(z=>h.world.tile(s.x0+8,s.z0+z)==='.');}),true);await t.step(.5);await t.tap('item');await t.step(.6);assert.equal(await t.eval(()=>window.__voxelHeroes.state.flags.has('coast:beacon-lit')),true);
    await t.teleport('mossbrook-future:0,0',13.5,13.5);await t.step(.3);assert.equal(await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+12,s.z0+12)==='}'&&h.world.tile(s.x0+13,s.z0+12)==='C';}),true);
    const saved=await t.save();await t.load(saved);assert.equal(await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('ember-lens')&&window.__voxelHeroes.state.flags.has('coast:beacon-lit')),true);await t.shot('06-portable-brineglass');assert.deepEqual(t.errors,[]);
   }
   if(mara){
    await t.eval(()=>{const h=window.__voxelHeroes;h.game.state.setFlag('coast:beacon-lit');h.game.companions.setMiraTravelling(true);h.game.companions.setMaraTravelling(true);h.game.inventory.giveItem('fire-wand');h.game.inventory.selectItem('fire-wand');h.state.maxMagic=h.state.magic=9;h.player.lockT=h.player.knockT=h.player.stallT=0;});
    await t.teleport('d4:0,7',7.5,8.5);await t.step(1.6);await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),es=h.entities.filter(e=>e.type==='tideglass-skater');for(const[e,x]of es.map((e,i)=>[e,i?9.5:5.5])){e.x=s.x0+x;e.z=s.z0+6.5;e.hp=18;e.ai.tide.openT=0;e.think=()=>{};e.harmless=true;}h.state.magic=9;h.state.companionRuntime.steamCooldown=0;});
    await t.page.keyboard.down('Shift');await t.step(.02);await t.page.keyboard.down('k');await t.step(.02);await t.page.keyboard.up('k');await t.page.keyboard.up('Shift');await t.step(.02);
    assert.equal(await t.eval(()=>{const h=window.__voxelHeroes;return h.state.magic===6&&h.game.companions.companionView().steamCount===1&&h.entities.filter(e=>e.type==='tideglass-skater').every(e=>e.hp===10&&e.ai.tide.openT>4.9);}),true);
    await t.step(.2);await t.shot('07-portable-steamwheel');const saved=await t.save();await t.load(saved);await t.step(.3);assert.equal(await t.eval(()=>{const c=window.__voxelHeroes.game.companions.companionView();return c.maraRecruited&&c.recruited&&c.steamCount===0&&c.steamT===0;}),true);assert.deepEqual(t.errors,[]);
   }
   report.checks.push({browser:name,title:true,encounter:true,journal:true,...(mara?{mara:true,realSteamwheel:true,fireDamage:true,personalMagic:true,recruitReload:true}:{}),...(tern?{twoCompanions:true,shelter:true}:{}),...(guidance?{tracking:true,trackingReload:true,hudJournal:true,completedPinReleased:true}:{}),...(hive?{hive:true,realBomb:true,partialReload:true}:{}),...(brine?{skater:true,realFire:true,twoBlockMelt:true,beacon:true,futureMemorial:true,lensReload:true}:{}),...(watch?{sentry:true,realHook:true,eightTileCrossing:true,upgradeReload:true}:{}),noPageErrors:true});console.log('PASS '+name+' muted portable HTML starts and runs the barrow encounter'+(mara?' with Mara and actual Steamwheel':'')+(tern?' with both companions and shelter':'')+(guidance?' and saved quest tracking':'')+(hive?' and a real hive bomb with partial reload':'')+(brine?' and real skater fire, two-block melt and future beacon':'')+(watch?' and sentry armor, eight-tile traversal and upgrade reload':''));
  }finally{await t.close();}
 }
 report.ok=true;
}catch(error){report.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{await fox?.close();writeFileSync(`${out}/result.json`,JSON.stringify(report,null,2));}
