import assert from 'node:assert/strict';
import { readFileSync,readdirSync,mkdirSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { firefox } from 'playwright';
import { launch } from './playtest.mjs';
import { startRelay } from './lib/nostr-relay.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/clock-coop',url=arg('url')??'http://127.0.0.1:5173/';
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],fixtures:'Muted Chromium/Firefox, real local Trystero RTC with empty ICE servers. Earlier campaign, tools, invulnerability, initial placements and one controlled native attack clock are fixtures. Anchor tool actions, guest pull, physical retreat/reunion and northern exit use gameplay. No public connectivity or audio playback.'};
let relay,fox;const pages=[];
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};
try{
 relay=await startRelay();fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
 for(const[name,browser]of[['host',null],['guest',fox]]){
  const t=await launch({url,browser,out:`${out}/${name}`,seed:17});pages.push(t);
  await t.page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.state.settings.muted=true;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);for(let n=1;n<=4;n++){h.game.state.setFlag('orb:'+n);h.game.state.setFlag('boss:d'+n);h.game.state.setFlag('dungeon:d'+n+':complete');h.game.state.setFlag('dungeon:d'+n+':entered');h.game.dungeons.giveBossKey('d'+n);}h.game.state.setFlag('overworld:talked:king');for(const id of['boomerang','bombs','grapple','fire-wand'])h.game.inventory.giveItem(id);h.give('blade-start');h.game.swords.equipSword('blade-start');h.player.invT=999;});
 }
 const[host,guest]=pages,options={relayUrls:[relay.url],rtcConfig:{iceServers:[]}};
 await host.eval(o=>window.__voxelHeroes.game.party.createParty('CLOCKHRS',o),options);await guest.eval(o=>window.__voxelHeroes.game.party.joinParty('CLOCKHRS',o),options);
 for(const t of pages)await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});
 const pump=async(n=12)=>{for(let i=0;i<n;i++){await Promise.all(pages.map(t=>t.step(.04)));await new Promise(r=>setTimeout(r,30));}};
 const wait=async(fn,label)=>{for(let i=0;i<130;i++){if(await fn())return;await pump(1);}throw Error(label);};
 const has=(t,id)=>t.eval(id=>window.__voxelHeroes.game.state.hasFlag(id),id);
 const count=t=>t.eval(()=>['return','break','draw','kindle'].filter(id=>window.__voxelHeroes.game.state.hasFlag('tower:clock:'+id)).length);
 const place=(t,x,z,f='north')=>t.eval(([x,z,f])=>{const h=window.__voxelHeroes;h.game.hero.hero.place(x,z);h.game.hero.hero.setFacing(f);h.player.lockT=h.player.knockT=h.player.stallT=0;},[x,z,f]);
 const item=async(t,id,x,z)=>{await place(t,x,z);await t.eval(id=>window.__voxelHeroes.game.inventory.selectItem(id),id);await pump(5);await t.tap('item');};
 const shot=async(t,name)=>{await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);await t.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);await t.shot(name);};
 check(true,'Muted Chromium and Firefox connect through real local Trystero RTC');
 await host.teleport('tower-trial:0,0',11,13.5);await guest.teleport('tower-trial:0,0',13,13.5);await host.step(4);await guest.step(4);await pump(45);
 check((await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.type==='boss-bishop'&&!e.removed).length)))).every(n=>n===1),'Reunion produces exactly one native trial keeper on each peer');
 check((await Promise.all(pages.map(count))).every(n=>n===0),'Both peers begin with the same four winding tasks');await shot(guest,'01-four-hours-together');
 await host.eval(()=>window.__voxelHeroes.game.objective.trackQuest('fourfold-clock'));await guest.eval(()=>window.__voxelHeroes.game.objective.trackQuest('era-archive'));
 await item(host,'boomerang',4.5,9.5);await wait(()=>has(guest,'tower:clock:return'),'shared returning throw');
 check(await count(host)===1&&await count(guest)===1,'Host returning throw turns one shared western winding');
 await item(guest,'bombs',17.5,9.15);await guest.stick(0,1,.5);await pump(80);
 check(await has(host,'tower:clock:break')&&await count(guest)===2,'A guest native bomb turns the owner-authoritative eastern winding');
 check((await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.entities.find(e=>e.type==='boss-bishop').segments.length)))).every(n=>n===1),'The reduced two-body encounter replicates to both peers');await shot(guest,'02-a-friend-breaks-the-hour');
 await place(host,10.5,13.5,'south');await pump(4);await host.stick(0,1,.7);await host.step(1.6);await pump(20);
 check((await host.state()).key==='tidecoast:2,2'&&(await guest.state()).key==='tower-trial:0,0','The host physically retreats south while the guest keeps working in the clock room');
 await wait(()=>guest.eval(()=>window.__voxelHeroes.game.party.roomOwner('tower-trial:0,0')===window.__voxelHeroes.game.party.partyView().selfId),'guest clock ownership');
 check(await count(guest)===2,'Owner transfer preserves both earned windings');
 await guest.eval(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-bishop');for(const e of [...h.entities])if(e.kind==='projectile')e.remove();b.ai.phase='appear';b.ai.t=0;});await guest.step(.02);await pump(4);
 check(await guest.eval(()=>window.__voxelHeroes.entities.some(e=>e.type==='crown-shot'&&e.tier===2)),'The transferred native keeper still fires ordinary trial shots');
 await item(guest,'grapple',7.5,13.5);await pump(25);
 check(await has(host,'tower:clock:draw')&&await count(guest)===3,'The independently working guest hook shares the third earned winding');
 check(await guest.eval(()=>{const h=window.__voxelHeroes;return h.player.z-h.screen().z0<13;}),'The guest real hook pulls its own hero toward the same anchor');await shot(guest,'03-one-friend-stays-to-reach');
 await place(host,8.5,4.5);await host.eval(()=>window.__voxelHeroes.game.inventory.selectItem('fire-wand'));await host.tap('item');await host.step(.6);await host.walkTo(8.5,2.5,{allowHooks:true,soft:true});await host.step(1.8);await pump(35);
 check((await host.state()).key==='tower-trial:0,0','The host physically returns through the four-light doorway');
 check((await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.entities.filter(e=>e.type==='boss-bishop'&&!e.removed).length)))).every(n=>n===1),'Reunion transfers one remaining keeper without duplicate bodies');
 await host.eval(()=>{window.__clockDefeats=0;window.__voxelHeroes.game.events.on('boss-defeated',e=>{if(e.dungeon==='tower-trial')window.__clockDefeats++;});});
 await item(guest,'fire-wand',14.5,13.5);await wait(()=>has(host,'tower:trial'),'clock completion');await pump(12);
 check((await Promise.all(pages.map(count))).every(n=>n===4)&&(await Promise.all(pages.map(t=>has(t,'tower:trial')))).every(Boolean),'Guest fire resolves one shared four-anchor completion after reunion');
 check((await Promise.all(pages.map(t=>t.eval(()=>!window.__voxelHeroes.entities.some(e=>['boss-bishop','bishop-copy','crown-wisp','crown-shot'].includes(e.type)))))).every(Boolean),'The shared completed encounter clears all hostile trial actors');
 check(await host.eval(()=>window.__clockDefeats)===1,'The authoritative trial defeat emits once');
 check(await host.eval(()=>window.__voxelHeroes.game.objective.trackedQuestId())===null&&await guest.eval(()=>window.__voxelHeroes.game.objective.trackedQuestId())==='era-archive','Completion releases the clock pin and keeps a friend different personal quest');await shot(guest,'04-four-hands-moving');
 await place(guest,10.5,2);await pump(3);await guest.stick(0,-1,.8);await guest.step(1.6);await pump(12);
 check((await guest.state()).key==='tower-hive:1,2'&&(await host.state()).key==='tower-trial:0,0','The guest physically climbs the northern stair independently');
 await host.eval(()=>window.__voxelHeroes.game.party.leaveParty());await wait(()=>guest.eval(()=>window.__voxelHeroes.game.party.partyView().count===1),'host departure');
 const saved=await guest.save();await guest.load(saved);await guest.step(.5);
 check(await has(guest,'tower:trial')&&await count(guest)===4,'The remaining guest saves and reloads the completed clock');
 await guest.teleport('tower-trial:0,0',11,13.5);await guest.step(.5);
 check(await guest.eval(()=>!window.__voxelHeroes.entities.some(e=>e.type==='boss-bishop')),'The earned keeper does not respawn after host departure and reload');
 check(pages.every(t=>t.errors.length===0),'Both browsers finish without runtime errors');result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));for(const t of pages)await t.close();await fox?.close();await relay?.close();}
