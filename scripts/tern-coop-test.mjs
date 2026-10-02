import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { firefox } from 'playwright';
import { launch, startServer } from './playtest.mjs';
import { startRelay } from './lib/nostr-relay.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/tern-coop';
const url=process.argv.find(a=>a.startsWith('--url='))?.slice(6);
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const fingerprint=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fingerprint.update(f.replaceAll('\\','/')+'\0');fingerprint.update(readFileSync(f));}
mkdirSync(out,{recursive:true});const result={startedUtc:new Date().toISOString(),sourceSha256:fingerprint.digest('hex'),checks:[],fixtures:'Muted Chromium/Firefox, real local Trystero RTC, no external ICE. Recruitments and archive reward use game APIs, room enemies removed, hero positions arranged. Actual guard/sword input activates shelter; damage API contact checks isolate protection. No voice playback or decoding.'};
let server,relay,fox;const pages=[];
try{
 server=url?{url,close:async()=>{}}:await startServer();relay=await startRelay();
 fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
 for(const [name,browser]of[['host',null],['guest',fox]]){
  const t=await launch({url:server.url,browser,out:`${out}/${name}`});pages.push(t);
  await t.page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);window.__ternTechs=[];window.__ternBonks=[];h.events.on('companion-tech',e=>window.__ternTechs.push(e));h.events.on('party-bonk',e=>window.__ternBonks.push(e));});
 }
 const [host,guest]=pages,config={relayUrls:[relay.url],rtcConfig:{iceServers:[]}};
 await host.eval(c=>window.__voxelHeroes.game.party.createParty('TERNCOOP',c),config);await guest.eval(c=>window.__voxelHeroes.game.party.joinParty('TERNCOOP',c),config);
 for(const t of pages)await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});
 const pump=async(n=20)=>{for(let i=0;i<n;i++){await Promise.all(pages.map(t=>t.step(.04)));await new Promise(r=>setTimeout(r,30));}};
 const view=t=>t.eval(()=>window.__voxelHeroes.game.companions.companionView());
 const check=(pass,text)=>{assert.ok(pass,text);result.checks.push(text);console.log('PASS '+text);};
 const shot=async(t,name)=>{await t.eval(()=>{window.__voxelHeroes.player.hero.root.visible=true;});await t.shot(name);};
 const cast=async t=>{await t.page.keyboard.down('Shift');await t.step(1/60);await t.page.keyboard.down('j');await t.step(1/60);await t.page.keyboard.up('j');await t.page.keyboard.up('Shift');await t.step(1/60);};
 const hit=t=>t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=0;h.player.knockT=0;h.player.lockT=0;return h.game.hero.hero.receiveHit({damage:1,kind:'contact',source:'coop-tern-probe',knockback:false,lock:0});});
 check(true,'Chromium and Firefox connect through muted local RTC');
 for(const t of pages)await t.teleport('Crossroads',8,5.5);
 await host.eval(()=>{const h=window.__voxelHeroes;for(const e of h.entities)if(e.kind==='enemy')e.remove();h.game.grants.grant('copper-memory',1,{fanfare:false});h.game.state.setFlag('era:voices-returned');h.game.companions.setMiraTravelling(true);h.game.companions.setTernTravelling(true);});await pump(40);
 let v=await Promise.all(pages.map(view));
 check(v.every(c=>c.recruited&&c.ternRecruited&&c.mira.visible&&c.tern.visible),'Both friends receive Mira and Tern recruitments');
 check(v[0].tern.localLeader&&!v[1].tern.localLeader&&Math.hypot(v[0].tern.x-v[1].tern.x,v[0].tern.z-v[1].tern.z)<.05,'One leader drives the same Tern pose in both browsers');
 check((await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.kind==='companion'&&!e.removed).length)))).every(n=>n===2),'There is exactly one presentation of each companion in each browser');
 await guest.eval(()=>{const h=window.__voxelHeroes,c=h.game.companions.companionView().tern,s=h.screen();h.game.hero.hero.place(c.x-s.x0+.9,c.z-s.z0);h.game.hero.hero.setFacing('east');});await pump(10);
 check((await view(guest)).shelterReady,'A nearby guest can use Tern without owning the room');
 const magic=await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.state.magic))),hp=await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.state.hp)));
 await cast(guest);await pump(10);v=await Promise.all(pages.map(view));
 check(v[1].shelterCount===1&&await guest.eval(()=>window.__voxelHeroes.state.magic)===magic[1]-2&&await host.eval(()=>window.__voxelHeroes.state.magic)===magic[0],'Only the casting guest spends two personal magic');
 check(v.every(c=>c.wardT>2),'The same shelter protects the nearby host and guest');
 check(await host.eval(()=>window.__ternTechs.filter(e=>e.name==='bell-shelter'&&e.remote).length)===1&&await guest.eval(()=>window.__ternTechs.filter(e=>e.name==='bell-shelter').length)===1,'RTC delivers one shelter cue without replaying the casting cost');
 check((await Promise.all(pages.map(hit))).every(r=>r==='blocked'),'Both peers block an actual hit through their ordinary receiveHit pipeline');
 check((await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.state.hp)))).every((n,i)=>n===hp[i]),'Neither protected player loses life');
 await shot(host,'01-host-sheltered');await shot(guest,'02-guest-sheltered');
 await guest.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),f=h.game.party.partyFriends()[0];h.game.hero.hero.place(f.x-s.x0+1.2,f.z-s.z0);});await pump(6);
 await host.eval(()=>{const h=window.__voxelHeroes,f=h.game.party.partyFriends()[0];h.game.hero.hero.faceToward(f.x,f.z);});await host.tap('sword');await pump(8);
 check(await guest.eval(()=>window.__ternBonks.length)>0,'A real friendly sword hit still bonks the sheltered guest');
 check((await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.state.hp)))).every((n,i)=>n===hp[i]),'The friendly bonk still leaves both heroes unharmed');
 await guest.teleport('mossbrook-future:1,0',8,10);await host.teleport('mossbrook-past:1,0',8,10);await pump(25);v=await Promise.all(pages.map(view));
 check(v[0].mira.visible&&v[0].tern.visible&&!v[1].mira.visible&&!v[1].tern.visible,'Both companions stay with the leader when friends explore different eras');
 check(v[1].wardT===0&&!v[1].shelterReady,'Leaving the room clears protection and a distant friend cannot summon Tern');
 await guest.eval(()=>window.__voxelHeroes.game.vitals.restoreMagic(2));const distantMagic=await guest.eval(()=>window.__voxelHeroes.state.magic);await cast(guest);
 check((await view(guest)).shelterCount===1&&await guest.eval(()=>window.__voxelHeroes.state.magic)===distantMagic,'A distant guard/sword press spends no magic and creates no shelter');
 await shot(host,'03-party-explores-past');await shot(guest,'04-friend-explores-future');
 await host.eval(()=>window.__voxelHeroes.game.party.leaveParty());await pump(40);v=await Promise.all(pages.map(view));
 check(v[1].mira.localLeader&&v[1].tern.localLeader&&v[1].mira.visible&&v[1].tern.visible&&!v[1].tern.blocked,'Mira and Tern safely transfer to the surviving hero after host departure');
 check(await guest.eval(()=>window.__voxelHeroes.entities.filter(e=>e.kind==='companion'&&!e.removed).length)===2,'Host migration creates no extra companions');
 await shot(guest,'05-surviving-party');
 await guest.eval(()=>window.__voxelHeroes.game.companions.setTernTravelling(false));await pump(3);
 check(!(await view(guest)).ternRecruited&&!(await view(guest)).tern.visible&&(await view(guest)).mira.visible,'Dismissing Tern leaves Mira travelling');
 for(const t of pages)assert.deepEqual(t.errors,[]);result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{result.completedUtc=new Date().toISOString();result.passed=result.checks.length;writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));for(const t of pages)await t.close();await fox?.close();await relay?.close();await server?.close();}
