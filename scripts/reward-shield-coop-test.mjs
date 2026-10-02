import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {firefox} from 'playwright';
import {launch} from './playtest.mjs';
import {startRelay} from './lib/nostr-relay.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3),out=arg('out')??'playtest-out/reward-shield-coop',url=arg('url')??'http://127.0.0.1:5173/';mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],fixtures:'Muted Chromium host and Firefox guest, real local Trystero RTC. Safe placements and isolated equipment grants. Real guard input replicates one lowered/raised shield and shield tiers; shared grants remain quiet for the other friend. Public signaling is not measured.'};
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};
const pages=[];let relay,fox;
try {
 relay=await startRelay();fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
 const host=await launch({url,out:`${out}/host`}),guest=await launch({url,out:`${out}/guest`,browser:fox});pages.push(host,guest);
 for(const t of pages){await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.state.gear.shield=0;h.player.invT=0;});await t.teleport('v1:1,1',8.5,9.5);await t.step(2);}
 await guest.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(10,9.5);});
 const config={appId:'voxelheroes-reward-shield-test',relayUrls:[relay.url],rtcConfig:{iceServers:[]}};
 await host.eval(c=>window.__voxelHeroes.game.party.createParty('REWARDS',c),config);await guest.eval(c=>window.__voxelHeroes.game.party.joinParty('REWARDS',c),config);
 for(const t of pages)await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});
 const pump=async(n=1)=>{for(let i=0;i<n;i++){await Promise.all(pages.map(t=>t.step(.04)));await new Promise(r=>setTimeout(r,35));}};
 const until=async(fn)=>{for(let i=0;i<100;i++){if(await fn())return;await pump();}throw Error('Friend presentation failed to converge');};
 const remote=t=>t.eval(()=>{const h=window.__voxelHeroes,e=h.entities.find(e=>e.kind==='friend');if(!e?.info)return null;const g=e.hero.figure.model.grid;let baked=0;for(let z=0;z<g.sz;z++)for(let y=0;y<g.sy;y++)for(let x=0;x<g.sx;x++)if(g.has(x,y,z)&&[0xe9b832,0xb0743c,0xf4f4f4].includes(g.color(x,y,z)))baked++;return{visible:e.object.visible,baked,shield:!!e.guardShield.parent,tier:e.guardShield.userData.tier,x:e.guardShield.position.x,uuid:e.guardShield.uuid,guarding:e.info.guarding,gear:e.info.shield,pose:e.info.pose,prize:!!h.gfx.scene.getObjectByName('item-prize')};});
 await until(async()=>!!(await remote(guest))?.visible);check((await remote(guest)).baked===0&&!(await remote(guest)).shield,'A friend without gear has no baked or decorative shield');
 await host.eval(()=>window.__voxelHeroes.game.grants.grant('shield-1',1,{source:'coop-reward-fixture'}));
 await until(async()=> (await remote(guest))?.gear===1);
 check(await host.eval(()=>window.__voxelHeroes.gfx.scene.getObjectByName('item-prize')?.userData.grant==='shield-1'),'The collecting hero holds the actual shield reward');
 check(!(await remote(guest)).prize,'Shared gear does not interrupt the guest with another reward cutscene');
 await pump(50);await until(async()=>!!(await remote(guest))?.shield);let v=await remote(guest);const id=v.uuid;
 check(v.baked===0&&v.x>.2,'The guest sees one lowered shield on the collecting friend');
 await host.eval(()=>{const h=window.__voxelHeroes;h.player.setFacing('south');h.input.down('guard');});await until(async()=>{const v=await remote(guest);return v?.guarding&&v.x<0;});v=await remote(guest);
 check(v.baked===0&&v.uuid===id&&v.shield,'A native held guard moves the same single remote shield');await guest.shot('01-friend-one-raised-shield');
 await host.eval(()=>window.__voxelHeroes.state.gear.shield=6);await until(async()=> (await remote(guest))?.tier===6);v=await remote(guest);check(v.baked===0&&v.uuid===id,'The friend shield tier changes without adding another mesh');await guest.shot('02-friend-bastion-shield');
 await host.eval(()=>window.__voxelHeroes.input.up('guard'));await until(async()=>{const v=await remote(guest);return v&&!v.guarding&&v.x>.2;});check((await remote(guest)).uuid===id,'Releasing guard lowers the same remote shield');
 await host.eval(()=>window.__voxelHeroes.game.grants.grant('boots-dash',1,{source:'coop-reward-fixture'}));await until(async()=> {const v=await remote(guest);return v?.pose==='cheer'&&!v.shield;});
 check(!(await remote(guest)).shield&&!(await remote(guest)).prize,'The friend cheer pose puts its shield away without interrupting the local hero');
 await pump(50);await until(async()=>!!(await remote(guest))?.shield);check((await remote(guest)).baked===0,'The remote reward ends with one restored shield');
 for(const t of pages)assert.deepEqual(t.errors,[]);check(true,'Both muted browsers have no game exceptions');result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));for(const t of pages)await t.close();await fox?.close();await relay?.close();}
