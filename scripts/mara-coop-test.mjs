import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { firefox } from 'playwright';
import { launch, startServer } from './playtest.mjs';
import { startRelay } from './lib/nostr-relay.mjs';
import { measurePartyFrame, resized } from './lib/party-frame.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/mara-coop';
const url=process.argv.find(a=>a.startsWith('--url='))?.slice(6);
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const fp=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],fixtures:'Muted Chromium/Firefox with real local Trystero RTC and empty ICE servers. Recruitment flags, magic capacity, initial enemy positions/HP and stationary AI are fixtures. Guest Guard+Item, friendly swords, room/leader migration, dismissal, reunion and save/load use actual gameplay. No public signaling or audio playback.'};
let server,relay,fox;const pages=[];
try {
 server=url?{url,close:async()=>{}}:await startServer();relay=await startRelay();fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
 for(const [name,browser]of[['host',null],['guest',fox]]){
  const t=await launch({url:server.url,browser,out:`${out}/${name}`});pages.push(t);await t.page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;window.__maraTechs=[];window.__maraBonks=[];h.events.on('companion-tech',e=>window.__maraTechs.push(e));h.events.on('party-bonk',e=>window.__maraBonks.push(e));});
 }
 const [host,guest]=pages,config={relayUrls:[relay.url],rtcConfig:{iceServers:[]}};
 await host.eval(c=>window.__voxelHeroes.game.party.createParty('MARACOOP',c),config);await guest.eval(c=>window.__voxelHeroes.game.party.joinParty('MARACOOP',c),config);
 for(const t of pages)await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});
 const pump=async(n=20)=>{for(let i=0;i<n;i++){await Promise.all(pages.map(t=>t.step(.04)));await new Promise(r=>setTimeout(r,30));}};
 const view=t=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return{...h.game.companions.companionView(),screen:s.key,hp:h.state.hp,magic:h.state.magic,self:h.game.party.partyView().selfId,owner:h.game.party.roomOwner(s.key),foes:h.entities.filter(e=>e.type==='tideglass-skater'&&!e.removed).map(e=>({id:e.netId,hp:e.hp,open:e.ai.tide.openT,pose:e.mesh.pose,flash:e.flashT,rgb:e.mat.emissive.toArray()})),error:h.game.party.partyView().error};});
 const check=(pass,label)=>{assert.ok(pass,label);result.checks.push(label);console.log('PASS '+label);};
 const wait=async(pred,label)=>{for(let i=0;i<150;i++){const v=await Promise.all(pages.map(view));if(pred(v))return v;await pump(1);}throw Error(label+': '+JSON.stringify(await Promise.all(pages.map(view))));};
 result.cameraFrames=[];
 const frameCheck=async(t,label,count)=>{const frame=await t.eval(measurePartyFrame);result.cameraFrames.push({label,frame});check(frame.actors.length===count&&frame.actors.every(e=>!e.out&&!e.techOverlap),label+' keeps nearby native figures in frame and clear of technique help');check(frame.camera.frame?.targets.length===count,label+' includes the nearby shared heroes and companions');};
 const shot=async(t,n)=>{await t.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);await t.shot(n);};
 const cast=async t=>{await t.page.keyboard.down('Shift');await t.step(1/60);await t.page.keyboard.down('k');await t.step(1/60);await t.page.keyboard.up('k');await t.page.keyboard.up('Shift');await t.step(1/60);};
 check(true,'Muted Chromium and Firefox connect over local Trystero RTC');
 await host.teleport('d4:0,7',7.5,8.5);await guest.teleport('d4:0,7',8.7,7.7);await pump(30);
 await host.eval(()=>{const h=window.__voxelHeroes,s=h.screen();h.game.state.setFlag('coast:beacon-lit');h.game.state.setFlag('era:voices-returned');h.game.grants.grant('copper-memory',1,{fanfare:false});h.game.companions.setMiraTravelling(true);h.game.companions.setTernTravelling(true);h.game.companions.setMaraTravelling(true);h.game.grants.grant('fire-wand',1,{fanfare:false});for(const[e,x]of h.entities.filter(e=>e.type==='tideglass-skater').map((e,i)=>[e,i?9.5:6.5])){e.x=s.x0+x;e.z=s.z0+5.5;e.hp=18;e.think=()=>{};e.harmless=true;}});await pump(30);
 for(const t of pages)await t.eval(()=>{const h=window.__voxelHeroes;h.state.maxMagic=h.state.magic=9;h.game.inventory.selectItem('fire-wand');});await pump(8);
 let v=await wait(v=>v.every(r=>r.maraRecruited&&r.mara?.visible&&r.tern?.visible&&r.mira?.visible),'shared three companions');
 check(v[0].mara.localLeader&&!v[1].mara.localLeader&&Math.hypot(v[0].mara.x-v[1].mara.x,v[0].mara.z-v[1].mara.z)<.05,'The leader publishes one identical Mara pose to the other browser');
 check((await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.kind==='companion'&&!e.removed).length)))).every(n=>n===3),'Both browsers contain exactly three distinct followers');
 await resized(guest,{width:390,height:844});await pump(5);await frameCheck(host,'Desktop host',5);await frameCheck(guest,'Portrait guest',5);
 await guest.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),c=h.game.companions.companionView();h.game.hero.hero.place((c.mira.x+c.mara.x)/2-s.x0,(c.mira.z+c.mara.z)/2-s.z0+.7);});
 v=await wait(v=>v[1].steamReady,'guest near the shared pair');
 check(v[1].owner===v[0].self&&v[1].steamReady,'A guest near Mira and Mara can cast inside the other hero room');await shot(guest,'01-three-shared-companions');
 const caster=await guest.eval(()=>{const p=window.__voxelHeroes.player;return{x:p.x,z:p.z};});
 // The new third-follower gap moves the guest's midpoint. Place stationary
 // targets relative to the actual caster, rather than beyond the pulse radius.
 await host.eval(caster=>{const h=window.__voxelHeroes,es=h.entities.filter(e=>e.type==='tideglass-skater');for(const[e,dx]of es.map((e,i)=>[e,i?1.4:-1.4])){e.x=caster.x+dx;e.z=caster.z;}},caster);await pump(8);
 const hp=v.map(r=>r.hp);await cast(guest);v=await wait(v=>v.every(r=>r.foes.length===2&&r.foes.every(e=>e.hp===10&&e.open>3)),'guest shared fire pulse');
 check(v[0].magic===9&&v[1].magic===6&&v[1].steamCount===1&&v[0].steamCount===0,'Only the casting guest spends three personal magic');
 check(v.every(r=>r.foes.every(e=>e.pose==='open')),'The owner applies one eight-damage pulse to both shells and replicates their fire openings');
 check(v.every(r=>r.foes.every(e=>e.rgb[0]<.35&&e.rgb[0]>=e.rgb[2])),'Shared hit feedback preserves limited warm emission on both peers');
 check(await host.eval(()=>window.__maraTechs.filter(e=>e.name==='steamwheel'&&e.remote).length)===1&&await guest.eval(()=>window.__maraTechs.filter(e=>e.name==='steamwheel').length)===1,'RTC shows one Steamwheel cue on each peer without duplicating the cast');
 check(v.every((r,i)=>r.hp===hp[i]),'Steamwheel never damages either friendly hero');await shot(host,'02-host-sees-guest-steamwheel');await shot(guest,'03-guest-opens-shared-shells');
 await cast(guest);await pump(6);check((await view(guest)).steamCount===1&&(await view(guest)).magic===6,'A guest cannot repeat the combination during personal cooldown');
 await host.teleport('mossbrook-past:1,0',8.5,10.5);await pump(10);v=await Promise.all(pages.map(view));
 check(v[1].owner===v[1].self&&v[1].foes.every(e=>e.hp===10&&e.open>0),'Leaving the room transfers both living fire-opened skaters to the guest');
 check(!v[1].mara.visible&&!v[1].mira.visible&&!v[1].tern.visible&&v[0].mara.visible,'The three companions stay with their leader across an era split');await shot(host,'04-leader-in-the-first-bloom');
 check(await guest.eval(()=>!window.__voxelHeroes.gfx.camera.userData.partyFrame),'The separate-era guest releases distant party framing');
 await frameCheck(host,'Independent First Bloom leader',4);
 await guest.step(6.2);const before=(await view(guest)).magic;await cast(guest);check((await view(guest)).steamCount===1&&(await view(guest)).magic===before,'A hero in another era cannot borrow distant companions');
 await guest.teleport('mossbrook-past:1,0',9.7,10);await pump(20);v=await wait(v=>v[1].mara.visible&&v[1].steamReady,'reunion readiness');
 check(v[1].mara.visible&&v[1].steamReady,'Reuniting with the leader restores the guest combination');
 await host.eval(()=>window.__voxelHeroes.game.companions.setMaraTravelling(false));await pump(12);v=await Promise.all(pages.map(view));
 check(v.every(r=>!r.maraRecruited&&!r.mara.visible&&r.mira.visible&&r.tern.visible&&!r.steamReady),'Dismissing Mara synchronizes across the party and preserves Mira and Tern');
 await host.eval(()=>window.__voxelHeroes.game.companions.setMaraTravelling(true));await pump(15);check((await view(guest)).maraRecruited&&(await view(guest)).steamReady,'The shared beacon permits Mara to rejoin once');
 await host.give('blade-start');await host.eval(()=>window.__voxelHeroes.game.swords.equipSword('blade-start'));
 await guest.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),f=h.game.party.partyFriends()[0];h.game.hero.hero.place(f.x-s.x0+1.2,f.z-s.z0);});await pump(8);await host.eval(()=>{const h=window.__voxelHeroes,f=h.game.party.partyFriends()[0];h.game.hero.hero.faceToward(f.x,f.z);});await host.tap('sword');await pump(10);
 check(await guest.eval(()=>window.__maraBonks.length)>0,'Real friendly sword input still knocks the other hero back with the full party');v=await Promise.all(pages.map(view));check(v.every((r,i)=>r.hp===hp[i]),'The friendly sword interaction leaves both health rows unchanged');
 await guest.teleport('mossbrook-future:1,0',8.5,10.5);await pump(10);await host.eval(()=>window.__voxelHeroes.game.party.leaveParty());await pump(30);v=await Promise.all(pages.map(view));
 check(v[1].mara.localLeader&&v[1].mara.visible&&v[1].mira.visible&&v[1].tern.visible&&!v[1].mara.blocked,'All three companions transfer safely to the surviving hero when the host leaves');
 await frameCheck(guest,'Portrait surviving leader',4);
 check(await guest.eval(()=>window.__voxelHeroes.entities.filter(e=>e.kind==='companion'&&!e.removed).length)===3,'Leader migration creates no duplicate followers');
 await guest.eval(()=>{const h=window.__voxelHeroes;h.state.magic=9;h.state.companionRuntime.steamCooldown=0;h.player.lockT=h.player.knockT=h.player.stallT=0;});await cast(guest);check((await view(guest)).steamCount===2&&(await view(guest)).magic===6,'The new leader can cast with inherited Mira and Mara');await guest.step(.15);await shot(guest,'05-surviving-keeper-party');
 const saved=await guest.save();await guest.load(saved);await guest.step(.4);v=await view(guest);check(v.maraRecruited&&v.recruited&&v.ternRecruited&&v.steamCount===0&&v.steamT===0,'The guest save keeps all shared recruitments and clears temporary Steamwheel state');
 check(pages.every(t=>t.errors.length===0)&&!v.error,'Both browsers finish without game or party errors');result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};result.snapshots=await Promise.all(pages.map(t=>t.state().catch(()=>null)));result.companions=await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.game.companions.companionView()).catch(()=>null)));process.exitCode=1;console.error(error.stack);}
finally{result.completedUtc=new Date().toISOString();result.passed=result.checks.length;writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));for(const t of pages)await t.close();await fox?.close();await relay?.close();await server?.close();}
