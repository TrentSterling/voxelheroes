import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {firefox} from 'playwright';
import {launch} from './playtest.mjs';
import {startRelay} from './lib/nostr-relay.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/coilmaw-coop',url=arg('url')??'http://127.0.0.1:5173/';
assert.ok(!existsSync(`${out}/result.json`),'Choose a fresh output folder');mkdirSync(out,{recursive:true});
const hash=createHash('sha256'),walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){hash.update(f.replaceAll('\\','/')+'\0');hash.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:hash.digest('hex'),checks:[],scope:'Muted Chrome/Firefox and real local Trystero RTC. Actual warning ownership transfer, committed dash/recovery, guest sword combat and one shared heart-container pickup. Room placements, starting gear, hero invulnerability and removing body parts to isolate shared head combat are disclosed fixtures. No direct head damage, health edits or forced boss flag. Fresh full victory is measured separately. Public signaling and separate-network ICE are outside scope.'};
const check=(pass,label)=>{assert.ok(pass,label);result.checks.push(label);console.log('PASS '+label);};
const pages=[];let relay,fox,view;

try {
 relay=await startRelay();fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
 const host=await launch({url,out:`${out}/host`,seed:17}),guest=await launch({url,out:`${out}/guest`,seed:17,browser:fox});pages.push(host,guest);
 for(const t of pages)await t.eval(()=>{const h=window.__voxelHeroes;h.game.settings.setSetting('muted',true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame({prologue:false});h.state.flags.add('overworld:talked:king');h.give('blade-start');h.give('shield-1');h.game.dungeons.giveBossKey('d1');h.player.invT=999;});
 const config={appId:'voxelheroes-coilmaw-test',relayUrls:[relay.url],rtcConfig:{iceServers:[]}};
 await host.eval(c=>window.__voxelHeroes.game.party.createParty('COILMAW',c),config);await guest.eval(c=>window.__voxelHeroes.game.party.joinParty('COILMAW',c),config);
 for(const t of pages)await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});
 const pump=async(n=1)=>{for(let i=0;i<n;i++){await Promise.all(pages.map(t=>t.step(1/60)));await new Promise(r=>setTimeout(r,35));}};
 const until=async(fn,label,n=180)=>{for(let i=0;i<n;i++){if(await fn())return;await pump();}throw Error(label);};
 view=t=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),b=h.entities.find(e=>!e.removed&&e.type==='boss-serpent');return{key:s.key,owner:h.game.party.roomOwner(s.key)===h.game.party.partyView().selfId,mode:h.state.mode,maxHp:h.state.maxHp,bossFlag:h.state.flags.has('boss:d1'),heads:h.entities.filter(e=>!e.removed&&e.type==='boss-serpent').length,parts:h.entities.filter(e=>!e.removed&&e.type==='serpent-segment').length,containers:h.entities.filter(e=>!e.removed&&e.type==='heart-container').length,b:b?{x:b.x,z:b.z,hp:b.hp,segments:b.segments.length,pending:b.ai.pendingLunge,tell:b.ai.tellT,heading:b.heading,dash:b.lungeUntil,rest:b.recoverT,cue:b.chargeCue.visible,marks:b.chargeCue.children.filter(m=>m.visible).length}:null};});
 check(true,'Muted Chrome and Firefox connect through real local RTC');
 await host.teleport('d1-boss',11,13.5);await guest.teleport('d1-boss',11,13.5);
 await until(async()=> (await view(host)).owner&&!(await view(guest)).owner,'Host owns the shared first-boss arena');
 await until(async()=> (await view(host)).mode==='play'&&(await view(host)).b?.pending,'The owner reaches a natural committed charge',420);
 await until(async()=> (await view(guest)).b?.pending&&(await view(guest)).b.cue,'The guest receives the committed charge');
 let a=await view(host),b=await view(guest);check(a.heads===1&&b.heads===1&&a.parts===6&&b.parts===6,'Both browsers have one shared head and six body replicas without duplicate parts');
 check(b.b.marks>0&&Math.abs(b.b.heading-a.b.heading)<.001,'The non-owner reconstructs the same visible committed coral lane');await guest.shot('01-guest-coral-warning');
 const heading=b.b.heading;
 await host.teleport('d1:3,3',4.5,8.45);await until(async()=> (await view(guest)).owner,'Guest inherits the occupied arena');b=await view(guest);
 check(b.b.pending&&Math.abs(b.b.heading-heading)<.001&&b.parts===6,'Room ownership transfer preserves the warning heading, clock and all six coils');await guest.shot('02-guest-inherits-warning');
 await until(async()=> (await view(guest)).b.rest>0,'The inherited warning completes its charge');b=await view(guest);
 check(!b.b.cue&&b.b.dash===0&&b.b.rest>.5,'The new owner reaches the same quiet recovery and hides its warning');await guest.shot('03-guest-shared-recovery');
 await guest.eval(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-serpent');for(const e of b.segments.splice(0))e.remove();});
 const fight=await guest.fight({heal:-1,seconds:60,soft:true});result.headFight=fight;
 check(fight.ok&&fight.heals===0,'The guest defeats the exposed head using actual sword input without test healing or direct head damage');
 await until(async()=> (await view(host)).bossFlag&&(await view(guest)).bossFlag,'The distant host receives the native boss defeat');b=await view(guest);
 check(b.heads===0&&b.parts===0&&b.containers===1,'Shared native head victory removes every part and creates exactly one first heart container');
 const reward=await guest.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>!e.removed&&e.type==='heart-container');return{x:e.x-s.x0,z:e.z-s.z0};});
 await guest.step(.5);await guest.walkTo(reward.x,reward.z);await guest.step(2);
 await until(async()=> (await view(host)).maxHp===8&&(await view(guest)).maxHp===8,'Both independently exploring heroes receive one shared earned heart');
 check((await view(host)).key==='d1:3,3','The exploring host receives the permanent reward outside the arena');await guest.shot('04-guest-shared-heart');
 await host.teleport('d1-boss',11,13.5);await pump(12);a=await view(host);b=await view(guest);
 check(a.heads===0&&b.heads===0&&a.containers===0&&b.containers===0&&a.maxHp===8&&b.maxHp===8,'Returning to the completed arena does not respawn its boss or duplicate the container');
 for(const t of pages)assert.deepEqual(t.errors,[]);check(true,'Both browsers report no game exceptions');result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};result.snapshots=await Promise.all(pages.map(t=>view?view(t).catch(()=>null):t.state().catch(()=>null)));for(const t of pages)await t.shot('FAILED').catch(()=>{});process.exitCode=1;console.error(error.stack);}
finally{result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));for(const t of pages)await t.close();await fox?.close();await relay?.close();}
