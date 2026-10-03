import assert from 'node:assert/strict';
import { readFileSync,readdirSync,mkdirSync,writeFileSync,existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { firefox } from 'playwright';
import { launch } from './playtest.mjs';
import { startRelay } from './lib/nostr-relay.mjs';
import { answer } from './scenarios/tower-journey.mjs';
import { select } from './scenarios/brineglass-journey.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/crown-coop',url=arg('url')??'http://127.0.0.1:5173/';
assert.ok(!existsSync(`${out}/result.json`),'Choose a fresh receipt folder.');mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const fingerprint=()=>{const h=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){h.update(f.replaceAll('\\','/')+'\0');h.update(readFileSync(f));}return h.digest('hex');};
const result={startedUtc:new Date().toISOString(),sourceSha256:fingerprint(),checks:[],scope:'Actual local Chromium/Firefox Trystero RTC. Tower positions, campaign flags, Dawn/Bastion, immunity and controlled attack windows are fixtures. Iona talk, guest cast, personal well, guard/open-window sword strikes, physical retreat and owner-clock advance use gameplay. No full native co-op campaign, public signaling or separate-network ICE claim. Speaker output disconnected before navigation.'};
result.testSources=Object.fromEntries(['scripts/crown-coop-test.mjs','scripts/playtest.mjs','scripts/lib/silent-output.mjs','scripts/lib/nostr-relay.mjs','scripts/scenarios/tower-journey.mjs','scripts/scenarios/brineglass-journey.mjs'].map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]));
const pages=[];let fox,relay;
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};
try{
  relay=await startRelay();fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
  const host=await launch({url,out:`${out}/host`,seed:17}),guest=await launch({url,browser:fox,out:`${out}/guest`,seed:17});pages.push(host,guest);
  for(const t of pages){await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.settings.setSetting('muted',true);h.game.settings.setSetting('npcVoices',false);h.player.invT=999;});await t.teleport('tower-hive:1,2',3.5,9.5);await t.eval(()=>{for(const e of window.__voxelHeroes.entities)if(e.kind==='enemy'){e.think=()=>{};e.harmless=true;}});await t.step(1.6);}
  const config={relayUrls:[relay.url],rtcConfig:{iceServers:[]}};
  await host.eval(c=>window.__voxelHeroes.game.party.createParty('CROWNOPEN',c),config);await guest.eval(c=>window.__voxelHeroes.game.party.joinParty('CROWNOPEN',c),config);
  for(const t of pages)await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});
  const pump=async(n=8)=>{for(let i=0;i<n;i++){await Promise.all(pages.map(t=>t.step(.04)));await new Promise(r=>setTimeout(r,30));}};
  const view=t=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),b=h.entities.find(e=>!e.removed&&e.type==='boss-king');return{key:s.key,self:h.game.party.partyView().selfId,owner:h.game.party.roomOwner(s.key),hp:h.state.hp,maxHp:h.state.maxHp,magic:h.state.magic,maxMagic:h.state.maxMagic,known:h.game.spells.knowsSpell('spell-truesight'),sight:h.game.effects.effectActive('truesight'),error:h.game.party.partyView().error,body:b?{id:b.netId,hp:b.hp,phase:b.ai.phase,t:b.ai.t,openHits:b.ai.openHits,ring:b.opening.visible,guards:b.guards(),dx:b.ai.dx,dz:b.ai.dz,x:b.x,z:b.z,line:b.line.visible,marks:b.line.children.map(m=>{const p=m.getWorldPosition(m.position.clone());return{x:p.x,y:p.y,z:p.z};})}:null};});
  const wait=async(pred,label)=>{for(let i=0;i<140;i++){const v=await Promise.all(pages.map(view));if(pred(v))return v;await pump(1);}throw Error(label+': '+JSON.stringify(await Promise.all(pages.map(view))));};
  check(true,'Muted Chromium and Firefox connect through real local Trystero RTC');
  check((await Promise.all(pages.map(view))).every(v=>v.maxMagic===0&&!v.known),'Both isolated heroes begin without an earlier sage or magic reserve');
  await host.stick(0,-1,1/60);await host.tap('sword');await answer(host);let v=await wait(v=>v.every(r=>r.known&&r.maxMagic===3),'shared usable first lesson');
  check(v.every(r=>r.magic===3),'Actual host Iona talk shares a usable first spell and filled three-unit reserves');
  await select(guest,'spell-truesight');await guest.tap('item');await pump(8);v=await Promise.all(pages.map(view));
  check(!v[0].sight&&v[0].magic===3&&v[1].sight&&v[1].magic===0,'Actual guest Truesight spends only the guest reserve and keeps its shadow effect personal');await guest.shot('01-personal-first-truesight');
  for(const t of pages){await t.eval(()=>{const h=window.__voxelHeroes;h.game.state.setFlag('tower:mask-broken');h.game.state.setFlag('dungeon:tower-crown:entered');h.game.dungeons.giveBossKey('tower-crown');h.give('blade-dawn');h.game.swords.equipSword('blade-dawn');h.give('shield-6');});await t.teleport('tower-crown:1,0',4.5,8.5);}
  await pump(12);for(const t of pages)await t.eval(()=>{const h=window.__voxelHeroes;h.setHp(2);h.game.vitals.setMagic(0);});
  await guest.stick(0,-1,1/60);await guest.tap('sword');await pump(8);v=await Promise.all(pages.map(view));
  check(v[0].hp===2&&v[0].magic===0&&v[1].hp===v[1].maxHp&&v[1].magic===3,'Actual last-well interaction restores only the guest life and magic');await guest.shot('02-personal-last-well');
  for(const[t,x]of[[host,3],[guest,18]]){await t.teleport('tower-final:0,0',x,12);await t.eval(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-king');b.introDone=true;b.ai.t=20;});}
  await pump(20);v=await wait(v=>v.every(r=>r.body),'shared crown body');const oi=v[0].owner===v[0].self?0:1,owner=pages[oi],other=pages[1-oi];
  check(v[0].body.id===v[1].body.id&&v.every(r=>r.body.guards&&!r.body.ring),'One shared crown begins armored, with its opening hidden on both peers');
  const bodyId=v[0].body.id;
  await owner.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-king'),s=h.screen();h.game.hero.hero.place(b.x-s.x0,b.z-s.z0+3.7);h.game.hero.hero.setFacing('north');h.player.lockT=h.player.knockT=h.player.stallT=0;b.ai.t=20;});
  const hp=v[0].body.hp;await owner.tap('sword');await owner.step(.6);await pump(8);v=await Promise.all(pages.map(view));
  check(v.every(r=>r.body.hp===hp),'An actual sword and beam strike cannot damage the armored shared stalk');
  await owner.eval(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-king');b.setPhase('recover',8);b.present();});
  v=await wait(v=>v.every(r=>r.body.ring&&!r.body.guards),'shared recovery ring');check(true,'Both peers show the same gold recovery ring and open armor');await other.shot('03-shared-crown-opening');
  for(let i=0;i<8&&(await view(owner)).body.openHits<3;i++){await owner.tap('sword');await owner.step(.45);await pump(2);}
  v=await wait(v=>v.every(r=>r.body.openHits===3&&!r.body.ring&&r.body.guards),'shared punish budget');
  check(v[0].body.hp===v[1].body.hp&&v[0].body.hp<hp,'Three actual shared hits close the recovery ring and retain identical boss health');
  const capped=v[0].body.hp;await owner.tap('sword');await owner.step(.5);await pump(5);v=await Promise.all(pages.map(view));check(v.every(r=>r.body.hp===capped),'Further actual sword input cannot bypass the consumed opening');
  await owner.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-king');for(const e of [...h.entities])if(e.kind==='projectile')e.remove();b.ai.dx=.6;b.ai.dz=.8;b.setPhase('charge-tell',1.15);b.holder.rotation.y=-.8;b.present();});
  v=await wait(v=>v.every(r=>r.body.line),'shared committed crown line');
  check(v.every(r=>r.body.marks.every(p=>p.y-.015>.2&&Math.abs((p.x-r.body.x)*r.body.dz-(p.z-r.body.z)*r.body.dx)<.04)),'Owner and replica charge marks clear the floor and follow the committed lane despite body interpolation');await other.shot('04-shared-committed-charge');
  await owner.eval(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-king');b.setPhase('charge-tell',2);b.present();});await pump(3);
  await owner.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(10.5,14);h.game.hero.hero.setFacing('south');});await owner.stick(0,1,.4);await owner.step(1.6);await pump(8);
  v=await wait(v=>v[oi].key==='tower-crown:1,0'&&v[1-oi].owner===v[1-oi].self&&!!v[1-oi].body,'physical retreat ownership');
  check(v[oi].key==='tower-crown:1,0'&&v[1-oi].key==='tower-final:0,0','A friend physically retreats to the last well while the other stays with the shared boss');
  check(v[1-oi].body.id===bodyId,'The remaining room owner retains the existing crown actor');
  const clock=v[1-oi].body.t;await pump(3);const later=await view(other);check(later.body.t<clock||later.body.phase!=='charge-tell','The pending committed attack continues under the remaining room owner');await other.shot('05-crown-owner-transfer');
  check(pages.every(t=>!t.errors.length)&&(await Promise.all(pages.map(view))).every(r=>!r.error),'Both browsers finish without runtime or party errors');
  result.sourceUnchanged=result.sourceSha256===fingerprint();assert.ok(result.sourceUnchanged);result.testsUnchanged=Object.entries(result.testSources).every(([f,hash])=>createHash('sha256').update(readFileSync(f)).digest('hex')===hash);assert.ok(result.testsUnchanged);result.ok=true;
}catch(e){result.ok=false;result.error={message:e.message,stack:e.stack};console.error(e.stack);process.exitCode=1;}
finally{result.completedUtc=new Date().toISOString();result.passed=result.checks.length;writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));for(const t of pages)await t.close();await fox?.close();await relay?.close();}
