import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { firefox } from 'playwright';
import { launch,startServer } from './playtest.mjs';
import { startRelay } from './lib/nostr-relay.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/era-coop';
const providedUrl=process.argv.find(a=>a.startsWith('--url='))?.slice(6);
const guidance=process.argv.includes('--guidance');
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const fingerprint=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fingerprint.update(f.replaceAll('\\','/')+'\0');fingerprint.update(readFileSync(f));}
const sourceSha256=fingerprint.digest('hex');
const server=providedUrl?{url:providedUrl,close:async()=>{}}:await startServer(),relay=await startRelay(),fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
const pages=[],checks=[];
try{
 for(const [name,browser] of [['host',null],['guest',fox]]){
  const t=await launch({url:server.url,browser,out:`${out}/${name}`});pages.push(t);
  await t.page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame();h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;});
  if(guidance)await t.eval(id=>window.__voxelHeroes.game.objective.trackQuest(id),name==='host'?'era-bell':'era-archive');
 }
 const [host,guest]=pages,options={relayUrls:[relay.url],rtcConfig:{iceServers:[]}};
 await host.eval(o=>window.__voxelHeroes.game.party.createParty('ERATEST1',o),options);
 await guest.eval(o=>window.__voxelHeroes.game.party.joinParty('ERATEST1',o),options);
 for(const t of pages)await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});
 const pump=async(n=30)=>{for(let i=0;i<n;i++){await Promise.all(pages.map(t=>t.step(.04)));await new Promise(ok=>setTimeout(ok,30));}};
 await pump();
 checks.push('Chromium and Firefox connected through local Trystero signaling with public ICE disabled');
 if(guidance){assert.equal(await host.eval(()=>window.__voxelHeroes.game.objective.trackedQuestId()),'era-bell');assert.equal(await guest.eval(()=>window.__voxelHeroes.game.objective.trackedQuestId()),'era-archive');checks.push('Joining keeps each player\'s own quest pin instead of copying the host\'s');}
 await host.teleport('mossbrook-past:0,0',7.5,6);
 await guest.teleport('mossbrook-future:0,0',7.5,11);
 await pump();
 const bridge=()=>guest.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+7,s.z0+7);});
 assert.equal(await bridge(),'~');await guest.eval(()=>{const h=window.__voxelHeroes;h.player.invT=0;h.player.hero.root.visible=true;});await guest.shot('01-future-before');
 // Solo scenario validates real combat and input. This fixture isolates
 // cross-era replication by clearing the host's patrol through its damage API.
 await host.eval(()=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.kind==='enemy')e.die();});
 await pump(5);
 await host.eval(()=>{const h=window.__voxelHeroes,s=h.screen();h.world.trigger(s.x0+7,s.z0+4,'onInteract',{player:h.player});});
 await pump(45);
 assert.equal(await bridge(),'=');
 assert.equal(await guest.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+4,s.z0+3);}), 'b');
 assert.equal((await guest.state()).key,'mossbrook-future:0,0');
 checks.push('A guest already in the future sees the bridge and garden grow when the host repairs the past');
 if(guidance){assert.equal(await guest.eval(()=>window.__voxelHeroes.game.objective.currentStep().questId),'era-archive');assert.match(await guest.eval(()=>window.__voxelHeroes.game.objective.objectiveText()),/First Bloom/);checks.push('Shared engine repair advances the guest\'s chosen archive task while the host follows the garden');}
 await guest.eval(()=>{window.__voxelHeroes.player.hero.root.visible=true;});await guest.shot('02-future-changed-by-friend');
 await host.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<700&&h.state.mode==='dialog';i++){if(i%15===0)h.input.tap('confirm');await h.tick();}});
 const before=await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.state.maxHp)));
 await guest.walkTo(7.5,4.5);await guest.hold('ArrowUp',.5);await pump();
 for(let i=0;i<pages.length;i++)assert.equal(await pages[i].eval(()=>window.__voxelHeroes.state.maxHp),before[i]+2);
 checks.push('Opening the future seed chest shares exactly one permanent heart with the friend in the past');
 await guest.hold('ArrowUp',.5);await pump();
 for(let i=0;i<pages.length;i++)assert.equal(await pages[i].eval(()=>window.__voxelHeroes.state.maxHp),before[i]+2);
 checks.push('Repeated chest contact cannot duplicate the shared reward');
 await host.eval(()=>window.__voxelHeroes.setMode('play'));
 await guest.eval(()=>window.__voxelHeroes.setMode('play'));
 await host.teleport('mossbrook-future:2,0',7.5,10);
 await guest.teleport('mossbrook-future:2,0',7.5,10);
 await pump(15);
 await host.eval(()=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.kind==='enemy')e.die();});
 await pump(15);
 await host.teleport('mossbrook-past:2,0',7.5,10);await pump(15);
 await host.eval(()=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.kind==='enemy')e.die();});await pump(10);
 assert.equal(await guest.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+7,s.z0+7);}), 'n');
 await guest.shot('03-archive-before-friend-tunes-past');
 await host.eval(()=>{const h=window.__voxelHeroes,s=h.screen();h.world.trigger(s.x0+7,s.z0+3,'onInteract',{player:h.player});});await pump(35);
 assert.equal(await guest.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+7,s.z0+7);}), 'a');
 assert.equal((await guest.state()).key,'mossbrook-future:2,0');
 checks.push('A guest already in the archive sees its floor light when the friend tunes the past workshop');
 if(guidance){assert.match(await guest.eval(()=>window.__voxelHeroes.game.objective.objectiveText()),/sentries.*memory chest/);checks.push('Actual remote valve tuning advances a pinned archive objective to its memory chest');}
 await guest.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);await guest.shot('04-archive-powered-from-past');
 const magicBefore=await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.state.maxMagic)));
 await guest.walkTo(7.5,4.5);await guest.hold('ArrowUp',.5);await pump(30);
 for(let i=0;i<pages.length;i++)assert.equal(await pages[i].eval(()=>window.__voxelHeroes.state.maxMagic),magicBefore[i]+2);
 checks.push('Actual archive chest shares exactly two permanent magic gems across separate eras');
 if(guidance){assert.match(await guest.eval(()=>window.__voxelHeroes.game.objective.objectiveText()),/west.*Tern/);assert.equal(await host.eval(()=>window.__voxelHeroes.game.objective.trackedQuestId()),'era-bell');checks.push('Shared archive reward advances the guest to Tern without changing the host\'s chosen adventure');}
 await guest.hold('ArrowUp',.5);await pump(15);
 for(let i=0;i<pages.length;i++)assert.equal(await pages[i].eval(()=>window.__voxelHeroes.state.maxMagic),magicBefore[i]+2);
 checks.push('Repeated archive chest contact cannot duplicate either player\'s magic reward');
 await guest.eval(()=>window.__voxelHeroes.setMode('play'));
 await guest.teleport('mossbrook-future:0,0',9.5,11.5);await pump(10);
 await guest.eval(()=>{const h=window.__voxelHeroes;h.entities.find(e=>e.name==='Tern').onInteract(h.player);});await pump(15);
 for(const t of pages)assert.equal(await t.eval(()=>window.__voxelHeroes.state.flags.has('era:voices-returned')),true);
 checks.push('The lost choir homecoming flag reaches the friend still in the past');
 if(guidance){
  assert.equal(await guest.eval(()=>window.__voxelHeroes.game.objective.trackedQuestId()),null);assert.equal(await host.eval(()=>window.__voxelHeroes.game.objective.trackedQuestId()),'era-bell');checks.push('The real choir turn-in releases only the completed archive pin');
  await host.teleport('v1:1,1',8,10);await pump(5);
  await host.eval(()=>{const h=window.__voxelHeroes;h.entities.find(e=>e.name==='Mira').onInteract(h.player);});await pump(20);
  for(const t of pages)assert.equal(await t.eval(()=>window.__voxelHeroes.game.objective.trackedQuestId()),null);
  assert.equal(await guest.eval(()=>window.__voxelHeroes.game.objective.currentStep().questId),'era-return');checks.push('The real Mira homecoming clears the other pin and tells the guest still in the future to return home');
  await guest.shot('05-completed-future-guidance');
  const saved=await guest.save();assert.equal(saved.fields.trackedQuest,null);checks.push('A guest save normalizes completed pins to automatic guidance');
  await host.eval(()=>{const h=window.__voxelHeroes;h.game.party.leaveParty();h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);});await pump(10);
  await host.eval(o=>window.__voxelHeroes.game.party.createParty('ERAFRESH1',o),options);await guest.eval(o=>window.__voxelHeroes.game.party.joinParty('ERAFRESH1',o),options);
  for(const t of pages)await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});await pump(15);
  assert.equal(await guest.eval(()=>window.__voxelHeroes.game.objective.trackedQuestId()),null);assert.equal(await guest.eval(()=>window.__voxelHeroes.state.flags.has('era:voices-returned')),false);checks.push('Joining a fresh adventure keeps a released completed pin in automatic mode');
 }
 for(const t of pages)assert.deepEqual(t.errors,[]);
 writeFileSync(`${out}/result.json`,JSON.stringify({utc:new Date().toISOString(),ok:true,sourceSha256,guidance,checks,passed:checks.length,fixtures:'Muted Chromium/Firefox; host patrol damage API; local signaling and ICE. Optional guidance uses personal quest-pin fixtures, actual engine/valve/chest/turn-in actions. Separate-network connectivity not tested.'},null,2));
 console.log(checks.map(c=>'PASS '+c).join('\n'));
}finally{for(const t of pages)await t.close();await fox.close();await relay.close();await server.close();}
