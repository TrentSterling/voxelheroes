import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {firefox} from 'playwright';
import {launch,startServer} from './playtest.mjs';
import {startRelay} from './lib/nostr-relay.mjs';

const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/stone-eye-coop',url=arg('url');mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of[...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],fixtures:'Muted Chromium/Firefox with real local Trystero RTC, local Nostr and empty ICE servers. Starter equipment, placements, one isolated uncrowned eye, selected attack cooldown and a one-second handoff warning are fixtures. Actual guest movement and boomerang input, committed shots, physical owner exit, reunion and host departure are exercised. Heroes are vulnerable for the sidestep; later transfer fixtures use invulnerability.'};
const pages=[];let server,relay,fox;
const check=(pass,label)=>{assert.ok(pass,label);result.checks.push(label);console.log('PASS '+label);};
try{
 server=url?{url,close:async()=>{}}:await startServer();relay=await startRelay();
 fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
 const host=await launch({url:server.url,out:`${out}/host`}),guest=await launch({url:server.url,out:`${out}/guest`,browser:fox});pages.push(host,guest);
 for(const t of pages)await t.eval(()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame({prologue:false});h.game.swords.giveSword('blade-start');h.game.swords.equipSword('blade-start');h.game.inventory.giveItem('boomerang');h.game.inventory.selectItem('boomerang');});
 const config={appId:'voxelheroes-stone-eye-test',relayUrls:[relay.url],rtcConfig:{iceServers:[]}};
 await host.eval(c=>window.__voxelHeroes.game.party.createParty('STONEEYE',c),config);
 await guest.eval(c=>window.__voxelHeroes.game.party.joinParty('STONEEYE',c),config);
 for(const t of pages)await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});
 const pump=async(n=1)=>{for(let i=0;i<n;i++){await Promise.all(pages.map(t=>t.step(.02)));await new Promise(done=>setTimeout(done,35));}};
 const view=t=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen(),eyes=h.entities.filter(e=>!e.removed&&e.type==='gazer');return {screen:s.key,hp:h.state.hp,held:h.game.hero.hero.hasStatus('paralyzed'),owner:h.game.party.roomOwner(s.key)===h.game.party.partyView().selfId,count:h.game.party.partyView().count,eyes:eyes.map(e=>({id:e.netId,ai:{...e.ai.eye},cue:e.sightCue.visible,pose:e.mesh.pose,hp:e.hp,stun:e.stunT})),shots:h.entities.filter(e=>!e.removed&&e.type==='gazer-shot').map(e=>({id:e.netId,vx:e.vx,vz:e.vz})),hero:{x:h.player.x-s.x0,z:h.player.z-s.z0}};});
 const until=async(pred,max=120)=>{for(let i=0;i<max;i++){const v=await Promise.all(pages.map(view));if(pred(v))return v;await pump();}throw Error('RTC state did not converge: '+JSON.stringify(await Promise.all(pages.map(view))));};
 check(true,'Muted Chromium and Firefox connect over real local RTC');
 await host.teleport('d1:4,7',1.2,8.5);await guest.teleport('d1:4,7',8.5,5.5);await pump(100);
 await host.eval(()=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.kind==='enemy'||e.kind==='projectile')e.remove();h.game.hero.hero.place(1.5,9.5);const e=h.spawn('gazer',4.5,5.5,{crowned:false});e.spawned=true;e.growT=1;e.holder.scale.setScalar(1);e.yaw=Math.PI/2;e.ai.wander={dir:{x:0,z:0},t:10,pause:true};e.ai.eye.cool=1;});
 let views=await until(v=>v.every(x=>x.eyes.length===1));
 check(views[0].eyes[0].id===views[1].eyes[0].id,'Both heroes see one shared Stone Eye identity');
 for(const t of pages)await t.eval(()=>{const h=window.__voxelHeroes;h.player.invT=0;h.setHp(h.state.maxHp);});const hp=views.map(v=>v.hp);
 views=await until(v=>v.every(x=>x.eyes[0]?.ai.phase==='aim'&&x.eyes[0].cue));
 check(views.every(v=>!v.held&&v.eyes[0].ai.dx===1&&v.eyes[0].ai.dz===0),'A guest-targeted warning reaches both browsers without paralyzing either hero');
 await guest.shot('01-guest-reads-the-line');await guest.stick(0,1,.2);await pump(5);views=await Promise.all(pages.map(view));
 check(views[1].hero.z>6.1&&!views[1].held,'Actual guest movement leaves the committed sight line');
 views=await until(v=>v.every(x=>x.shots.length===1));
 check(views[0].shots[0].id===views[1].shots[0].id&&views.every(v=>v.shots[0].vx>6.9&&Math.abs(v.shots[0].vz)<.01),'One shared magic shot follows the original row in both browsers');
 await pump(65);views=await Promise.all(pages.map(view));
 check(views.every((v,i)=>v.hp===hp[i]),'The vulnerable remote hero evades the real shot while the owner remains unharmed');
 for(const t of pages)await t.eval(()=>{window.__voxelHeroes.player.invT=999;});
 await guest.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(8.5,5.5);h.game.hero.hero.setFacing('west');});
 await host.eval(()=>{const h=window.__voxelHeroes,e=h.entities.find(e=>e.type==='gazer');for(const shot of [...h.entities])if(shot.kind==='projectile')shot.remove();e.x=h.screen().x0+4.5;e.z=h.screen().z0+5.5;e.yaw=Math.PI/2;e.ai.wander={dir:{x:0,z:0},t:10,pause:true};Object.assign(e.ai.eye,{phase:'roam',cool:.3});});
 views=await until(v=>v.every(x=>x.eyes[0]?.ai.phase==='aim'&&x.eyes[0].cue));
 await guest.tap('item');views=await until(v=>v.every(x=>x.eyes[0]?.ai.phase==='recover'&&x.eyes[0].stun>1));
 check(views.every(v=>!v.eyes[0].cue&&v.eyes[0].hp===6),'Actual guest boomerang input interrupts the owner-approved eye without adding damage');
 await guest.shot('02-shared-boomerang-opening');await pump(35);views=await Promise.all(pages.map(view));
 check(views.every(v=>v.shots.length===0),'Neither replica revives the interrupted projectile during the shared stun');
 // A controlled normal-length warning isolates the transfer boundary. Solo tests
 // independently exercise the complete natural attack clock in four directions.
 await host.eval(()=>{const h=window.__voxelHeroes,e=h.entities.find(e=>e.type==='gazer');h.game.hero.hero.place(1,5.5);Object.assign(e,{stunT:0,knockT:0});Object.assign(e.ai.eye,{phase:'aim',t:1,cool:2,dx:1,dz:0,reach:7});});
 await guest.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(8.5,6.5);});
 views=await until(v=>v.every(x=>x.eyes[0]?.ai.phase==='aim'&&x.eyes[0].cue));const identity=views[0].eyes[0].id;
 await host.stick(-1,0,.35);
 views=await until(v=>v[1].owner&&v[1].eyes[0]?.ai.phase==='aim',30);
 check(views[1].eyes[0].id===identity&&views[1].eyes[0].ai.t>0&&views[1].eyes[0].cue,'Physical owner retreat transfers the same live warning and its remaining time');
 views=await until(v=>v[1].shots.length===1);
 check(views[1].shots[0].vx>6.9&&Math.abs(views[1].shots[0].vz)<.01,'The new owner releases one shot along the preserved aim');
 await pump(60);views=await Promise.all(pages.map(view));
 check(views[0].screen==='d1:3,7'&&views[1].screen==='d1:4,7','The friends can explore Pit Walk and Gazer Walk independently');
 await guest.shot('03-guest-keeps-the-encounter');
 await host.teleport('d1:4,7',1.2,8.5);views=await until(v=>v[0].owner&&v.every(x=>x.eyes.length===1&&x.eyes[0].id===identity));
 check(views.every(v=>v.eyes.length===1)&&views[0].owner,'Reunion restores one Stone Eye and returns simulation ownership');
 await host.eval(()=>window.__voxelHeroes.game.party.leaveParty());await pump(20);views=await until(v=>v[1].count===1&&v[1].owner);
 check(views[1].eyes.length===1&&views[1].eyes[0].id===identity,'Host departure retains the same encounter for the remaining hero');
 for(const t of pages)assert.deepEqual(t.errors,[]);check(true,'Both browsers finish without game exceptions');result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};result.snapshots=await Promise.all(pages.map(t=>t.state().catch(()=>null)));process.exitCode=1;console.error(error.stack);}
finally{result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));for(const t of pages)await t.close();await fox?.close();await relay?.close();await server?.close();}
