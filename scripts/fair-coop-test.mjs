import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {firefox} from 'playwright';
import {launch} from './playtest.mjs';
import {startRelay} from './lib/nostr-relay.mjs';
import {fairState,fairRead,FAIR_BELLS} from './lib/clockfair.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/fair-coop',url=arg('url')??'http://127.0.0.1:5173/';
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],fixtures:'Muted Chromium/Firefox, real local Trystero RTC with empty ICE servers; no public connectivity or playback. Initial gear, invulnerability, positions, a lit target and elapsed reset isolate transport. Actual board choices, lifts, pot collisions, exit/reunion and saves exercise gameplay. Solo fair scenario separately covers the unmodified timer and full walking route.'};
let relay,fox;const pages=[];
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};
try{
 relay=await startRelay();fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
 for(const[name,browser]of[['host',null],['guest',fox]]){
  const t=await launch({url,browser,out:`${out}/${name}`,seed:17});pages.push(t);
  await t.page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.state.settings.muted=true;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;h.state.swords.owned=[];h.state.swords.equipped=null;h.state.coins=0;});
 }
 const[host,guest]=pages,options={relayUrls:[relay.url],rtcConfig:{iceServers:[]}};
 await host.eval(o=>window.__voxelHeroes.game.party.createParty('CLOCKFAIR',o),options);await guest.eval(o=>window.__voxelHeroes.game.party.joinParty('CLOCKFAIR',o),options);
 for(const t of pages)await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});
 const pump=async(n=12)=>{for(let i=0;i<n;i++){await Promise.all(pages.map(t=>t.step(.04)));await new Promise(r=>setTimeout(r,30));}};
 const wait=async(fn,label)=>{for(let i=0;i<150;i++){if(await fn())return;await pump(1);}throw Error(label);};
 const place=(t,x,z,f='north')=>t.eval(([x,z,f])=>{const h=window.__voxelHeroes;h.game.hero.hero.place(x,z);h.game.hero.hero.setFacing(f);h.player.lockT=h.player.knockT=h.player.stallT=0;},[x,z,f]);
 const owner=async()=>{for(const t of pages)if(await t.eval(()=>window.__voxelHeroes.game.party.roomOwner('mossbrook-fair:0,0')===window.__voxelHeroes.game.party.partyView().selfId))return t;throw Error('No fair owner');};
 const shot=async(t,name)=>{await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);await t.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);await t.shot(name);};
 const lift=async(t,x=2)=>{await place(t,x+.5,13.6);await pump(5);await t.tap('sword');await wait(async()=>(await fairState(t)).carrying,'native guest lift approval');check((await fairState(t)).loot===false,'Owner-approved practice clay keeps loot disabled');};
 const ring=async(t,index)=>{
  if(!(await fairState(t)).carrying)await lift(t,index===0||index===3?2:11);
  const o=await owner();await o.eval(index=>{const a=window.__voxelHeroes.entities.find(e=>e.type==='fair-clock').ai;a.target=index;a.lit=true;a.beat=5;a.elapsed=0;},index);
  const[x,z]=FAIR_BELLS[index];await place(t,x+.5,z+1.6);await pump(5);await t.tap('sword');await wait(async()=>((await fairState(o)).ai.mask&(1<<index))!==0,'shared native clay hit '+index);
  await wait(async()=>(await Promise.all(pages.map(fairState))).filter(v=>v.ai).every(v=>v.ai.mask&(1<<index)),'clay collision propagation '+index);
  check((await Promise.all(pages.map(fairState))).filter(v=>v.ai).every(v=>v.ai.mask&(1<<index)),`Native clay collision ${index+1} reaches every present peer`);
 };
 check(true,'Muted Chromium and Firefox connect through real local Trystero RTC');
 await host.teleport('mossbrook-fair:0,0',7.05,14.6);await guest.teleport('mossbrook-fair:0,0',7.95,14.6);await pump(35);
 check((await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.type==='fair-clock'&&!e.removed).length)))).every(n=>n===1),'Both peers share exactly one idle fair machine');
 await Promise.all(pages.map((t,i)=>fairRead(t,0,i?7.95:7.05)));await wait(async()=>(await fairState(host)).ai.phase==='running'&&(await fairState(guest)).ai.phase==='running','shared board attempt');
 check((await Promise.all(pages.map(fairState))).every(v=>v.requests.length===1&&v.ai.serial===1),'Simultaneous actual board choices create one shared attempt');await shot(guest,'01-one-shared-round');
 await host.eval(()=>window.__voxelHeroes.game.objective.trackQuest('clockfair'));await guest.eval(()=>window.__voxelHeroes.game.objective.trackQuest('era-archive'));
 await lift(guest);await place(guest,2.5,12.5);await pump(20);
 check(await host.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+2,s.z0+12)==='o';}),'A remote friend on an empty stand prevents owner-side pot regrowth');
 await place(guest,3.5,4.6);await pump(15);
 check((await Promise.all(pages.map(t=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return h.world.tile(s.x0+2,s.z0+12)==='v';})))).every(Boolean),'Vacant practice clay refills and replicates to both browsers');
 await ring(guest,0);await ring(host,1);await shot(guest,'02-a-friend-rings-the-light');
 await place(host,8.5,14.3,'south');await pump(3);await host.stick(0,1,.7);await host.step(1.6);await pump(20);
 check((await host.state()).key==='v1:1,1'&&(await guest.state()).key==='mossbrook-fair:0,0','The host physically leaves through the fair arch while the friend stays');
 await wait(()=>guest.eval(()=>window.__voxelHeroes.game.party.roomOwner('mossbrook-fair:0,0')===window.__voxelHeroes.game.party.partyView().selfId),'fair ownership transfer');
 check((await fairState(guest)).ai.mask===3&&(await fairState(guest)).ai.phase==='running','Ownership transfer preserves the live round and its two bells');
 await guest.eval(()=>{const a=window.__voxelHeroes.entities.find(e=>e.type==='fair-clock').ai;a.shotT=0;a.warning=false;});await guest.step(.03);await pump(2);
 check((await fairState(guest)).ai.warning,'The transferred machine still warns before firing');await pump(24);
 check(await guest.eval(()=>window.__voxelHeroes.entities.some(e=>e.type==='fair-note')),'The transferred owner emits real practice notes');
 await ring(guest,2);await shot(guest,'03-one-friend-keeps-the-fair');
 await place(host,11.7,10.5,'east');await host.stick(1,0,.5);await host.step(1.6);await pump(30);
 check((await host.state()).key==='mossbrook-fair:0,0','The host physically returns through the town arch');
 check((await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.type==='fair-clock'&&!e.removed).length)))).every(n=>n===1)&&(await fairState(host)).ai.mask===7,'Reunion restores one machine with the same three bells');
 for(let i=3;i<5;i++)await ring(guest,i);
 await place(host,8.5,14.3,'south');await host.stick(0,1,.7);await host.step(1.6);await pump(15);await ring(guest,5);await pump(25);
 check((await host.state()).key==='v1:1,1'&&(await Promise.all(pages.map(fairState))).every(v=>v.medal&&v.coins===60&&v.times.length===1)&&(await fairState(guest)).ai.phase==='won','A guest final throw shares the medal, one record and sixty coins with a friend exploring town');
 await place(host,11.7,10.5,'east');await host.stick(1,0,.5);await host.step(1.6);await pump(25);
 check((await Promise.all(pages.map(fairState))).every(v=>v.ai.phase==='won'&&v.ai.mask===63),'Reunion after the shared reward restores all six earned bells');
 check(await host.eval(()=>window.__voxelHeroes.game.objective.trackedQuestId())===null&&await guest.eval(()=>window.__voxelHeroes.game.objective.trackedQuestId())==='era-archive','Fair completion releases its pin while preserving a friend different personal quest');await shot(guest,'04-six-bells-for-both-friends');
 await fairRead(host);await wait(async()=>(await fairState(guest)).ai.phase==='running','shared repeat');
 for(let i=0;i<6;i++)await ring(i%2?host:guest,i);await pump(20);
 check((await Promise.all(pages.map(fairState))).every(v=>v.medal&&v.coins===60&&v.ai.phase==='won'),'A full shared repeat cannot pay duplicate coins');
 await host.teleport('ow-4-3:1,1',7.5,10.5);await guest.teleport('ow-4-3:1,1',12.5,9.6);await pump(30);await place(guest,12.5,9.6);await guest.tap('sword');await wait(async()=>(await fairState(guest)).carrying,'ordinary guest pot approval');
 check((await fairState(guest)).loot===true,'An owner-approved ordinary overworld pot still carries its normal loot permission');
 await guest.teleport('mossbrook-fair:0,0',8.5,14);await guest.eval(()=>window.__voxelHeroes.game.pots.releasePot());await pump(15);
 await host.eval(()=>window.__voxelHeroes.game.party.leaveParty());await wait(()=>guest.eval(()=>window.__voxelHeroes.game.party.partyView().count===1),'host session departure');
 const saved=await guest.save();await guest.load(saved);await guest.step(.3);
 check((await fairState(guest)).medal&&(await fairState(guest)).coins===60&&(await fairState(guest)).ai.phase==='idle','The remaining friend saves the earned medal and reward without restarting an old attempt');
 check(pages.every(t=>t.errors.length===0),'Both browsers finish without runtime errors');result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};result.states=await Promise.all(pages.map(async t=>({fair:await fairState(t),snapshot:await t.state(),roomOwner:await t.eval(()=>window.__voxelHeroes.game.party.roomOwner('mossbrook-fair:0,0'))}))).catch(e=>e.message);process.exitCode=1;console.error(error.stack);}
finally{result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));for(const t of pages)await t.close();await fox?.close();await relay?.close();}
