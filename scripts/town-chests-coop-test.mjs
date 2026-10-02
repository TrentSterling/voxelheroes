import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {firefox} from 'playwright';
import {launch} from './playtest.mjs';
import {startRelay} from './lib/nostr-relay.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/town-chests-coop',url=arg('url')??'http://127.0.0.1:5173/';mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],fixtures:'Muted Chromium host and Firefox guest over real local Trystero RTC. Prerequisite flags, hero placements, invulnerability and damage-API sentry removal isolate chest interactions. Guest locked feedback, actual guest A, simultaneous A, repeated claims, saved rewards and host departure are exercised. Native story repair and combat have separate scenarios. No public signaling or separate-network claim.'};
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};
const pages=[];let relay,fox;
try {
 relay=await startRelay();fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
 const host=await launch({url,out:`${out}/host`}),guest=await launch({url,out:`${out}/guest`,browser:fox});pages.push(host,guest);
 for(const t of pages)await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;});
 const config={appId:'voxelheroes-town-chests-test',relayUrls:[relay.url],rtcConfig:{iceServers:[]}};
 await host.eval(c=>window.__voxelHeroes.game.party.createParty('CHESTS',c),config);await guest.eval(c=>window.__voxelHeroes.game.party.joinParty('CHESTS',c),config);
 for(const t of pages)await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});
 const pump=async(n=1)=>{for(let i=0;i<n;i++){await Promise.all(pages.map(t=>t.step(.02)));await new Promise(r=>setTimeout(r,35));}};
 const until=async(fn,n=100)=>{for(let i=0;i<n;i++){if(await fn())return;await pump();}throw Error('Party chest state did not converge');};
 check(true,'Muted Chromium and Firefox connect through real local RTC');
 const vaults=[
  {id:'seed',screen:'mossbrook-future:0,0',x:7,z:3,ready:'era:water-restored',reward:'era:dawn-seed',hint:'engine',kind:'hp',amount:2},
  {id:'archive',screen:'mossbrook-future:2,0',x:7,z:3,ready:'era:archive-powered',reward:'era:copper-memory',hint:'valves',guard:'sentries',kind:'mp',amount:2},
  {id:'departure',screen:'mossbrook-future:1,1',x:11,z:12,ready:'era:departure-powered',reward:'era:departure-tag',hint:'fix signal',guard:'Courier',kind:'tag',amount:1},
  {id:'keeper',screen:'mossbrook-future:0,0',x:13,z:12,ready:'coast:beacon-lit',reward:'coast:beacon-memory',hint:'beacon',kind:'mp',amount:1},
 ];
 const view=(t,v)=>t.eval(v=>{const h=window.__voxelHeroes,s=h.screen();return{screen:s.key,owner:h.game.party.roomOwner(s.key)===h.game.party.partyView().selfId,count:h.game.party.partyView().count,opened:h.state.flags.has(`chest:${s.x0+v.x},${s.z0+v.z}`),reward:h.state.flags.has(v.reward),toast:h.game.toast.toastView().text,ready:h.state.flags.has(v.ready),hp:h.state.maxHp,mp:h.state.maxMagic,tag:Number(h.state.flags.has('era:departure-tag')),enemies:h.entities.filter(e=>e.kind==='enemy'&&!e.removed).length};},v);
 for(const v of vaults) {
  for(const t of pages){await t.teleport(v.screen,v.x+.5,v.z+1.5);await t.eval(v=>{const h=window.__voxelHeroes;h.game.hero.hero.place(v.x+.5,v.z+1.5);h.game.hero.hero.setFacing('north');h.player.invT=999;},v);}
  await until(async()=>{const a=await view(host,v),b=await view(guest,v);return a.owner&&!b.owner&&a.screen===b.screen;});await pump(20);
  await guest.tap('sword');await pump(5);
  let state=await Promise.all(pages.map(t=>view(t,v)));
  check(state.every(s=>!s.opened&&!s.reward),`${v.id}: guest A cannot bypass the story lock`);
  check(state[1].toast.includes(v.hint),`${v.id}: the guest receives its locked explanation locally`);
  await guest.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);await guest.shot(`${v.id}-guest-locked`);
  await host.eval(id=>window.__voxelHeroes.game.state.setFlag(id),v.ready);await until(async()=> (await view(guest,v)).ready);await pump(5);
  if(v.guard){await guest.tap('sword');await pump(5);check(!(await view(guest,v)).opened&&(await view(guest,v)).toast.includes(v.guard),`${v.id}: the guest still sees the live sentry gate`);await host.eval(()=>{const h=window.__voxelHeroes;for(const e of h.entities)if(e.kind==='enemy'&&!e.removed)e.hurt({damage:999,knockback:0,source:'reported-chest-fixture'});});await until(async()=> (await view(guest,v)).enemies===0);}
  const before=await Promise.all(pages.map(t=>view(t,v)));
  // The archive uses guest-only A, proving its derived hook reaches the
  // owner. Other vaults also exercise simultaneous local and remote A.
  if(v.id==='archive')await guest.tap('sword');else await Promise.all(pages.map(t=>t.tap('sword')));
  await until(async()=> (await Promise.all(pages.map(t=>view(t,v)))).every(s=>s.opened&&s.reward));
  state=await Promise.all(pages.map(t=>view(t,v)));
  check(state.every((s,i)=>s[v.kind]===before[i][v.kind]+v.amount),`${v.id}: A grants exactly the intended reward to both friends`);
  for(const t of pages)await t.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<900&&h.state.mode!=='play';i++){if(i%15===0)h.input.tap('confirm');await h.tick();}});
  await Promise.all(pages.map(t=>t.tap('sword')));await pump(10);state=await Promise.all(pages.map(t=>view(t,v)));
  check(state.every((s,i)=>s[v.kind]===before[i][v.kind]+v.amount),`${v.id}: repeated party A cannot duplicate either reward`);
 }
 const final=vaults.at(-1),before=await view(guest,final);
 await host.eval(()=>window.__voxelHeroes.game.party.leaveParty());await until(async()=> (await view(guest,final)).count===1);
 check((await view(guest,final)).owner,'Host departure transfers the chest room to the remaining friend');
 const saved=await guest.save();await guest.load(saved);await guest.step(.2);const loaded=await view(guest,final);
 check(loaded.mp===before.mp&&loaded.hp===before.hp&&loaded.opened,'The remaining guest saves and reloads all permanent gains');
 for(const t of pages)assert.deepEqual(t.errors,[]);check(true,'Both browsers report no game exceptions');result.ok=true;
} catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};result.snapshots=await Promise.all(pages.map(t=>t.state().catch(()=>null)));process.exitCode=1;console.error(error.stack);}
finally{result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));for(const t of pages)await t.close();await fox?.close();await relay?.close();}
