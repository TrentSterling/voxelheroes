import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { firefox } from 'playwright';
import { launch, startServer } from './playtest.mjs';
import { startRelay } from './lib/nostr-relay.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/brineglass-coop';
const url=process.argv.find(a=>a.startsWith('--url='))?.slice(6);
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const fp=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],fixtures:'Muted Chromium/Firefox real local Trystero RTC. Hero/enemy positions and stationary initial AI are fixtures; initial skeleton uses damage API. Guest fire, swords, owner transfer during an open shell, physical lens cache, guest two-block melting, remote future memorial and shared reward are actual gameplay. No public signaling or audio playback.'};
let server,relay,fox;const pages=[];
try {
  server=url?{url,close:async()=>{}}:await startServer();relay=await startRelay();fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
  for(const [name,browser]of[['host',null],['guest',fox]]){
    const t=await launch({url:server.url,browser,out:`${out}/${name}`});pages.push(t);
    await t.page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
    await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;});await t.give('fire-wand');await t.give('grapple');
  }
  const [host,guest]=pages,config={relayUrls:[relay.url],rtcConfig:{iceServers:[]}};
  await host.eval(c=>window.__voxelHeroes.game.party.createParty('BRINECOOP',c),config);await guest.eval(c=>window.__voxelHeroes.game.party.joinParty('BRINECOOP',c),config);
  for(const t of pages)await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});
  const pump=async(n=20)=>{for(let i=0;i<n;i++){await Promise.all(pages.map(t=>t.step(.04)));await new Promise(r=>setTimeout(r,30));}};

  const view=t=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return{screen:s.key,self:h.game.party.partyView().selfId,owner:h.game.party.roomOwner(s.key),enemies:h.entities.filter(e=>e.type==='tideglass-skater'&&!e.removed).map(e=>({id:e.netId,hp:e.hp,x:e.x-s.x0,z:e.z-s.z0,...e.ai.tide,pose:e.mesh.pose,cue:e.cue.visible})),hp:h.state.hp,lens:h.game.inventory.hasItem('ember-lens'),lit:h.state.flags.has('coast:beacon-lit'),memory:h.state.flags.has('coast:beacon-memory'),maxMagic:h.state.maxMagic,memorial:s.key==='mossbrook-future:0,0'?h.world.tile(s.x0+12,s.z0+12):null,error:h.game.party.partyView().error};});
  const check=(pass,label)=>{assert.ok(pass,label);result.checks.push(label);console.log('PASS '+label);};
  const wait=async(pred,label,max=150)=>{for(let i=0;i<max;i++){const v=await Promise.all(pages.map(view));if(pred(v))return v;await pump(1);}throw Error(label+': '+JSON.stringify(await Promise.all(pages.map(view))));};
  const place=(t,x,z,f='north')=>t.eval(([x,z,f])=>{const h=window.__voxelHeroes;h.game.hero.hero.place(x,z);h.game.hero.hero.setFacing(f);},[x,z,f]);
  const shot=async(t,n)=>{await t.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);await t.shot(n);};
  const settle=async()=>{for(const t of pages)await t.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<500&&h.state.mode!=='play';i++){h.input.tap('confirm');await h.tick();}});};
  check(true,'Muted Chromium and Firefox connect through local Trystero RTC');
  await host.teleport('d4:0,7',2.5,9.5);await guest.teleport('d4:0,7',5.5,9.5);await pump(40);
  await host.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),es=h.entities.filter(e=>e.type==='tideglass-skater');es[1].die();const e=es[0];window.__tideThink=e.think;e.x=s.x0+5.5;e.z=s.z0+5.5;e.hp=18;e.ai.tide={phase:'hunt',t:0,dx:0,dz:1,openT:0,charges:0};e.stunT=-.01;e.knockT=0;});
  let v=await wait(v=>v.every(r=>r.enemies.length===1&&r.enemies[0].phase==='tell'&&r.enemies[0].cue),'shared tell');
  check(v[0].enemies[0].id===v[1].enemies[0].id,'Both browsers display the same marked natural charge');await shot(guest,'01-shared-charge-warning');const hp=v.map(r=>r.hp);
  await guest.eval(()=>window.__voxelHeroes.player.invT=0);await wait(v=>v[1].hp<hp[1],'guest contact');v=await Promise.all(pages.map(view));
  check(v[1].hp===hp[1]-1&&v[0].hp===hp[0],'The owner-driven skater damages the guest after an expired stun while the other friend stays safe');
  await host.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),e=h.entities.find(e=>e.type==='tideglass-skater');for(const p of [...h.entities])if(p.kind==='pickup'||p.kind==='projectile')p.remove();e.x=s.x0+5.5;e.z=s.z0+5.5;e.hp=18;e.ai.tide={phase:'hunt',t:999,dx:0,dz:1,openT:0,charges:0};e.stunT=e.knockT=0;e.think=()=>{};e.harmless=true;});await guest.eval(()=>window.__voxelHeroes.player.invT=999);await pump(10);
  await place(guest,5.5,8.5);await guest.eval(()=>window.__voxelHeroes.game.inventory.selectItem('fire-wand'));await guest.tap('item');
  v=await wait(v=>v.every(r=>r.enemies[0]?.hp===12&&r.enemies[0].openT>3.5&&r.enemies[0].pose==='open'),'guest fire shell');check(true,'The guest real fire bolt melts the shared shell and deals six damage on both browsers');await shot(guest,'02-guest-fire-opens-shell');
  await host.teleport('mossbrook-future:0,0',13.5,13.5);await pump(8);v=await Promise.all(pages.map(view));check(v[1].owner===v[1].self&&v[1].enemies[0].hp===12&&v[1].enemies[0].openT>0,'The guest inherits the living skater and remaining fire opening after its owner changes era');await shot(guest,'03-open-shell-owner-transfer');
  await place(guest,5.5,7);for(let i=0;i<8&&(await view(guest)).enemies.length;i++){const e=(await view(guest)).enemies[0];await place(guest,e.x,e.z+1.3);await guest.tap('sword');await pump(12);}check((await view(guest)).enemies.length===0,'The new room owner finishes the skater through real sword input');
  await place(guest,8.5,4.5);await guest.stick(0,-1,.4);await pump(8);v=await wait(v=>v.every(r=>r.lens),'shared lens');check(v[0].screen==='mossbrook-future:0,0','The physical kiln cache shares its Ember Lens with a friend already in tomorrow');await shot(guest,'04-shared-ember-lens');await settle();
  await host.teleport('tidecoast:0,2',3.5,11.5);await guest.teleport('tidecoast:0,2',8.5,10.5);await pump(20);check((await view(guest)).owner===(await view(host)).self,'The guest fire-melt check runs in a room owned by the other browser');
  await place(guest,8.5,10.5);await guest.eval(()=>window.__voxelHeroes.game.inventory.selectItem('fire-wand'));await guest.tap('item');await pump(20);
  const ice=await Promise.all(pages.map(t=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return[8,7].map(z=>h.world.tile(s.x0+8,s.z0+z));})));check(ice.every(r=>r.every(c=>c==='.')),'One real guest bolt melts both ice blocks through the room owner');await shot(guest,'05-guest-two-block-melt');
  await host.teleport('mossbrook-future:0,0',13.5,13.5);await pump(8);const base=(await view(host)).maxMagic;
  await guest.tap('item');v=await wait(v=>v.every(r=>r.lit)&&v[0].memorial==='}','remote future light');check(v[0].screen==='mossbrook-future:0,0','Lighting the shore warms the future memorial while the friend remains there');await shot(host,'06-friend-sees-future-light');
  await place(host,13.5,13.5);await host.stick(0,-1,.4);await pump(8);v=await wait(v=>v.every(r=>r.memory&&r.maxMagic===base+1),'shared memory');check(true,'The physical future vault shares exactly one permanent magic gem across the two eras');await shot(host,'07-future-memory-prize');await settle();
  await guest.teleport('mossbrook-future:0,0',13.5,13.5);await pump(15);await place(guest,13.5,13.5);await guest.stick(0,-1,.4);await pump(8);v=await Promise.all(pages.map(view));check(v.every(r=>r.maxMagic===base+1&&r.memory&&r.lens),'Reuniting and reopening cannot duplicate the keeper memory');
  check(v.every(r=>!r.error)&&pages.every(t=>t.errors.length===0),'Both browsers remain free of game and party errors');
  const save=await guest.save();await guest.load(save);await guest.step(.4);v=await view(guest);check(v.lens&&v.lit&&v.memory&&v.maxMagic===base+1&&v.memorial==='}','The guest reloads the shared lens, future memorial and permanent reward alone');
  result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};result.snapshots=await Promise.all(pages.map(t=>t.state().catch(()=>null)));process.exitCode=1;console.error(error.stack);}
finally{result.completedUtc=new Date().toISOString();result.passed=result.checks.length;writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));for(const t of pages)await t.close();await fox?.close();await relay?.close();await server?.close();}
