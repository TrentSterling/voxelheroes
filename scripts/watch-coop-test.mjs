import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { firefox } from 'playwright';
import { launch, startServer } from './playtest.mjs';
import { startRelay } from './lib/nostr-relay.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/watch-coop';
const url=process.argv.find(a=>a.startsWith('--url='))?.slice(6);
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const fp=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],fixtures:'Muted Chromium/Firefox real local Trystero RTC. Hero/enemy positions and stationary initial AI are fixtures; initial skeleton uses damage API. Guest hook, swords, owner transfer during exposed armor, physical cache, remote extender, long traversal, reward pickup and saved inventory are actual gameplay. No public signaling or audio playback.'};
let server,relay,fox;const pages=[];
try {
  server=url?{url,close:async()=>{}}:await startServer();relay=await startRelay();fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
  for(const [name,browser]of[['host',null],['guest',fox]]){
    const t=await launch({url:server.url,browser,out:`${out}/${name}`});pages.push(t);
    await t.page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
    await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;});await t.give('grapple');
  }
  const [host,guest]=pages,config={relayUrls:[relay.url],rtcConfig:{iceServers:[]}};
  await host.eval(c=>window.__voxelHeroes.game.party.createParty('WATCHCOOP',c),config);await guest.eval(c=>window.__voxelHeroes.game.party.joinParty('WATCHCOOP',c),config);
  for(const t of pages)await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});
  const pump=async(n=20)=>{for(let i=0;i<n;i++){await Promise.all(pages.map(t=>t.step(.04)));await new Promise(r=>setTimeout(r,30));}};
  const view=t=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),es=h.entities.filter(e=>e.type==='watch-sentinel'&&!e.removed);return{screen:s.key,self:h.game.party.partyView().selfId,owner:h.game.party.roomOwner(s.key),enemies:es.map(e=>({id:e.netId,hp:e.hp,...e.ai.watch,pose:e.mesh.pose,cue:e.cue.visible,proxy:e._partyProxy})),hp:h.state.hp,dial:h.game.inventory.hasItem('sun-dial'),piece:h.state.heartPieces,error:h.game.party.partyView().error};});
  const check=(pass,label)=>{assert.ok(pass,label);result.checks.push(label);console.log('PASS '+label);};
  const wait=async(pred,label,max=150)=>{for(let i=0;i<max;i++){const v=await Promise.all(pages.map(view));if(pred(v))return v;await pump(1);}throw Error(label+': '+JSON.stringify(await Promise.all(pages.map(view))));};
  const place=(t,x,z,f='north')=>t.eval(([x,z,f])=>{const h=window.__voxelHeroes;h.game.hero.hero.place(x,z);h.game.hero.hero.setFacing(f);},[x,z,f]);
  const shot=async(t,name)=>{await t.eval(()=>{window.__voxelHeroes.player.hero.root.visible=true;});await t.shot(name);};
  check(true,'Muted Chromium and Firefox connect over local RTC');
  await host.teleport('d3:1,7',2.5,8.5);await guest.teleport('d3:1,7',5.5,7.5);await pump(40);
  await host.eval(()=>{const h=window.__voxelHeroes,s=h.screen();for(const e of [...h.entities])if(e.type==='skeleton')h.game.damage.dealDamage(e,{amount:999,source:'bomb',from:h.player});const e=h.entities.find(e=>e.type==='watch-sentinel');window.__watchThink=e.think;e.x=s.x0+5.5;e.z=s.z0+4.5;e.hp=18;e.yaw=0;e.ai.watch={phase:'hunt',t:999,dx:0,dz:1,openT:0,volleys:0};e.stunT=e.knockT=0;e.think=()=>{};e.harmless=true;});await pump(10);
  let v=await Promise.all(pages.map(view));check(v.every(r=>r.enemies.length===1&&r.enemies[0].hp===18)&&v[0].enemies[0].id===v[1].enemies[0].id,'Both friends see one shared armored sentry');
  const hp=v.map(r=>r.hp);await host.eval(()=>{const e=window.__voxelHeroes.entities.find(e=>e.type==='watch-sentinel');e.think=window.__watchThink;e.ai.watch.t=0;});
  await wait(v=>v.every(r=>r.enemies[0]?.phase==='tell'&&r.enemies[0]?.cue),'shared natural tell');check(true,'Both browsers show the same natural three-lane warning');await shot(guest,'00-replicated-volley-warning');
  await guest.eval(()=>{window.__voxelHeroes.player.invT=0;});await wait(v=>v[1].hp<hp[1],'replica projectile contact');v=await Promise.all(pages.map(view));
  check(v[1].hp===hp[1]-1&&v[0].hp===hp[0],'An owner-fired bolt damages the guest replica locally while the other friend stays safe');
  await host.eval(()=>{const h=window.__voxelHeroes,e=h.entities.find(e=>e.type==='watch-sentinel');for(const p of [...h.entities])if(p.kind==='projectile'||p.kind==='pickup')p.remove();e.ai.watch={phase:'hunt',t:999,dx:0,dz:1,openT:0,volleys:0};e.think=()=>{};});await guest.eval(()=>{const h=window.__voxelHeroes;h.player.invT=999;h.setHp(h.state.maxHp);});await place(guest,5.5,7.5);await pump(8);
  await guest.eval(()=>window.__voxelHeroes.game.inventory.selectItem('grapple'));await place(guest,5.5,7.5);await pump(5);await guest.tap('item');await pump(10);
  v=await wait(v=>v.every(r=>r.enemies[0]?.openT>2&&r.enemies[0]?.pose==='open'),'guest armor hook');check(v.every(r=>r.enemies[0].hp===18&&!r.enemies[0].cue),'The guest hook opens armor on both browsers without dealing damage');await shot(guest,'01-guest-opens-shared-armor');
  await host.teleport('d3:2,7',8,9);await pump(8);v=await Promise.all(pages.map(view));
  check(v[1].owner===v[1].self&&v[1].enemies.length===1&&v[1].enemies[0].openT>0&&v[1].enemies[0].hp===18,'The guest inherits an exposed living sentry when the owner leaves the room');await shot(guest,'02-owner-transfer-keeps-opening');
  await host.teleport('mossbrook-future:0,0',6,13);await place(guest,5.5,6);await pump(4);
  for(let i=0;i<8&&(await view(guest)).enemies.length;i++){await guest.tap('sword');await pump(12);}
  check((await view(guest)).enemies.length===0,'The new owner finishes the sentry through actual sword input');
  await place(guest,8.5,4.5);await guest.stick(0,-1,.4);await pump(8);v=await wait(v=>v.every(r=>r.dial),'shared extender');
  check(v.every(r=>r.dial)&&v[0].screen==='mossbrook-future:0,0','The physical guest cache shares its chain extender with a friend exploring another era');await shot(guest,'03-shared-sun-dial');
  for(const t of pages)await t.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<500&&h.state.mode!=='play';i++){h.input.tap('confirm');await h.tick();}});
  await host.teleport('sunreach:2,3',8.5,5.6);await host.eval(()=>window.__voxelHeroes.game.inventory.selectItem('grapple'));await place(host,8.5,5.6,'south');await host.tap('item');await host.step(.1);
  check(await host.eval(()=>window.__voxelHeroes.entities.find(e=>e.type==='grapple-hook')?.range===8),'The remote reward changes the friend\'s newly fired hook to eight tiles');await pump(35);
  check((await host.state()).lz>12,'The friend uses the shared extender for a real long cast');await shot(host,'04-friend-crosses-sunken-meridian');
  const pieces=(await view(guest)).piece;await host.walkTo(11.5,14.5);await host.stick(0,-1,.4);await pump(8);await wait(v=>v.every(r=>r.piece===pieces+1),'shared platform fragment');
  check((await Promise.all(pages.map(view))).every(r=>r.piece===pieces+1),'The optional platform fragment is shared with the friend still in the Watch');
  for(const t of pages)await t.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<500&&h.state.mode!=='play';i++){h.input.tap('confirm');await h.tick();}});
  await guest.teleport('d3:2,7',8,9);await host.teleport('d3:1,7',8.5,8.5);await guest.teleport('d3:1,7',8.5,7.5);await pump(20);v=await Promise.all(pages.map(view));
  check(v.every(r=>r.enemies.length===0&&r.dial&&r.piece===pieces+1),'Reuniting preserves the cleared cache and shared rewards without spawning duplicate guards');
  check(v.every(r=>!r.error)&&pages.every(t=>t.errors.length===0),'Both browsers remain free of game and party errors');
  const saved=await guest.save();await guest.load(saved);await guest.step(.4);v=await view(guest);check(v.dial&&v.piece===pieces+1&&v.enemies.length===0,'The guest reloads the shared upgrade, platform reward and cleared encounter alone');
  result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};result.snapshots=await Promise.all(pages.map(t=>t.state().catch(()=>null)));process.exitCode=1;console.error(error.stack);}
finally{result.completedUtc=new Date().toISOString();result.passed=result.checks.length;writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));for(const t of pages)await t.close();await fox?.close();await relay?.close();await server?.close();}
