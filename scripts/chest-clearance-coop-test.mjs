import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {firefox} from 'playwright';
import {launch,startServer} from './playtest.mjs';
import {startRelay} from './lib/nostr-relay.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/chest-clearance-coop';mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const fingerprint=()=>{const hash=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){hash.update(f.replaceAll('\\','/')+'\0');hash.update(readFileSync(f));}return hash.digest('hex');};
const result={startedUtc:new Date().toISOString(),sourceSha256:fingerprint(),testSha256:createHash('sha256').update(readFileSync('scripts/chest-clearance-coop-test.mjs')).digest('hex'),checks:[],fixtures:'Audio-disconnected Chromium host and Firefox guest over real local Trystero RTC. Hero placements, removed unrelated enemies and stationary one-HP last guards are isolation fixtures. The host kills with native sword input; actual shared reveals, guest movement, guest A, once-only shared rewards and host departure are tested. No public signaling or separate-network claim.'};
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};
const pages=[];let relay,fox,server;
try {
 if(!arg('url'))server=await startServer();const url=arg('url')??server.url;
 relay=await startRelay();fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
 const host=await launch({url,out:`${out}/host`}),guest=await launch({url,out:`${out}/guest`,browser:fox});pages.push(host,guest);
 for(const t of pages)await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.settings.setSetting('npcVoices',false);});
 const config={appId:'voxelheroes-chest-clearance-test',relayUrls:[relay.url],rtcConfig:{iceServers:[]}};
 check(await host.eval(c=>window.__voxelHeroes.game.party.createParty('CLEAR1',c),config),'The host accepts the valid six-character party code');
 check(await guest.eval(c=>window.__voxelHeroes.game.party.joinParty('CLEAR1',c),config),'The guest accepts the same party code');
 for(const t of pages)await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});
 const pump=async(n=1)=>{for(let i=0;i<n;i++){await Promise.all(pages.map(t=>t.step(.02)));await new Promise(r=>setTimeout(r,35));}};
 const until=async(fn,n=100)=>{for(let i=0;i<n;i++){if(await fn())return;await pump();}throw Error('Party state did not converge');};
 const view=(t,room)=>t.eval(room=>{const h=window.__voxelHeroes,s=h.screen(),p=h.player;return{screen:s.key,x:p.x-s.x0,z:p.z-s.z0,blocked:h.world.blocked(p.x,p.z,p.r,p),tile:h.world.tile(s.x0+room.x,s.z0+room.z),owner:h.game.party.roomOwner(s.key)===h.game.party.partyView().selfId,owned:h.state.inventory.owned.filter(id=>id===room.reward).length,hp:h.state.hp,count:h.game.party.partyView().count};},room);
 check(true,'Muted Chromium and Firefox connect through real local RTC');
 for(const room of [{key:'d1:4,6',x:7,z:5,reward:'boomerang'},{key:'d3:3,2',x:8,z:4,reward:'grapple'}]) {
   for(const t of pages)await t.teleport(room.key,8.5,9.5);
   await until(async()=>{const a=await view(host,room),b=await view(guest,room);return a.owner&&!b.owner&&a.screen===room.key&&b.screen===room.key;});await pump(20);
   await host.eval(()=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.kind==='enemy')e.remove();h.give('blade-start');h.game.swords.equipSword('blade-start');const e=h.spawn('slime',8.5,8.2);e.hp=1;e.spawned=true;e.update=()=>{};window.__clearanceGuard=e;h.game.hero.hero.place(8.5,9.5);h.game.hero.hero.setFacing('north');});
   await guest.eval(room=>window.__voxelHeroes.game.hero.hero.place(room.x+.5,room.z+.5),room);await pump(10);
   const before=await view(guest,room);check(before.tile==='h'&&!before.blocked,`${room.key}: guest stands on the unrevealed reward floor`);
   await guest.shot(`${room.reward}-01-guest-on-reward-floor`);
   await host.tap('sword');await until(async()=> (await view(guest,room)).tile==='c');await pump(10);
   check(await host.eval(()=>window.__clearanceGuard.removed),`${room.key}: native host sword kills the final guard`);
   const after=await view(guest,room);
   check(!after.blocked&&Math.hypot(after.x-before.x,after.z-before.z)>.1&&after.hp===before.hp,`${room.key}: shared chest clears the guest safely without damage`);
   await guest.shot(`${room.reward}-02-guest-cleared`);await guest.hold('ArrowLeft',.3);await pump(5);
   const moved=await view(guest,room);check(Math.hypot(moved.x-after.x,moved.z-after.z)>.1,`${room.key}: the guest can immediately walk normally`);await guest.shot(`${room.reward}-03-guest-walks-away`);
   await guest.eval(room=>{const h=window.__voxelHeroes;h.game.hero.hero.place(room.x+.5,room.z+1.5);h.game.hero.hero.setFacing('north');},room);
   await guest.tap('sword');await until(async()=> (await Promise.all(pages.map(t=>view(t,room)))).every(s=>s.owned===1));
   check(true,`${room.key}: actual guest A grants one reward to each peer`);
   for(const t of pages)await t.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<900&&h.state.mode!=='play';i++){if(i%15===0)h.input.tap('confirm');await h.tick();}});
   await guest.tap('sword');await pump(10);
   check((await Promise.all(pages.map(t=>view(t,room)))).every(s=>s.owned===1),`${room.key}: repeated guest A cannot duplicate the reward`);
 }
 const room={key:'d3:3,2',x:8,z:4,reward:'grapple'};
 await host.eval(()=>window.__voxelHeroes.game.party.leaveParty());await until(async()=> (await view(guest,room)).count===1);
 check((await view(guest,room)).owner&&!(await view(guest,room)).blocked,'The guest remains mobile after room ownership transfers');
 for(const t of pages)assert.deepEqual(t.errors,[]);check(true,'Both browsers report no game exceptions');result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{result.sourceUnchanged=fingerprint()===result.sourceSha256;result.testsUnchanged=createHash('sha256').update(readFileSync('scripts/chest-clearance-coop-test.mjs')).digest('hex')===result.testSha256;if(!result.sourceUnchanged||!result.testsUnchanged){result.ok=false;process.exitCode=1;}result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));for(const t of pages)await t.close();await fox?.close();await relay?.close();await server?.close();}
