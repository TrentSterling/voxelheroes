import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { firefox } from 'playwright';
import { launch, startServer } from './playtest.mjs';
import { startRelay } from './lib/nostr-relay.mjs';

const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'playtest-out/barrow-coop';
const url = process.argv.find(a => a.startsWith('--url='))?.slice(6);
mkdirSync(out, {recursive:true});
const result = {startedUtc:new Date().toISOString(), checks:[], fixtures:'Muted Chromium/Firefox, local signaling and empty ICE servers. Position fixtures, invulnerable heroes, stationary first-wave guards, damage-API kills. Actual guest sword/pot input, chest push, room ownership transfer and shared rewards over real Trystero RTC.'};
const pages = [];
let server, relay, fox;
try {
  server = url ? {url, close:async()=>{}} : await startServer();
  relay = await startRelay();
  fox = await firefox.launch({headless:true, firefoxUserPrefs:{'media.volume_scale':'0.0'}});
  for (const [name,browser] of [['host',null],['guest',fox]]) {
    const t = await launch({url:server.url,browser,out:`${out}/${name}`}); pages.push(t);
    await t.page.route('**/*', route => ['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await t.eval(()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame({prologue:false});h.player.invT=999;});
  }
  const [host,guest]=pages, config={relayUrls:[relay.url],rtcConfig:{iceServers:[]}};
  await host.eval(c=>window.__voxelHeroes.game.party.createParty('BARROWCOOP',c),config);
  await guest.eval(c=>window.__voxelHeroes.game.party.joinParty('BARROWCOOP',c),config);
  for(const t of pages) await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});
  for(const t of pages) await t.eval(()=>{window.__voxelHeroes.player.invT=999;});
  const pump=async(n=30)=>{for(let i=0;i<n;i++){await Promise.all(pages.map(t=>t.step(.04)));await new Promise(done=>setTimeout(done,30));}};
  const view=t=>t.eval(()=>{const h=window.__voxelHeroes,b=h.entities.filter(e=>!e.removed&&e.type==='barrow-bell'),s=h.screen();return {screen:s.key,bells:b.map(e=>({id:e.netId,ring:e.ring.visible,...e.ai})),foes:h.entities.filter(e=>!e.removed&&e.kind==='enemy').map(e=>({id:e.netId,type:e.type})),blocked:h.game.combat.roomClearBlocked(),key:h.state.flags.has('dungeon:d1:key:E-3'),muted:h.state.flags.has('dungeon:d1:echo-muted'),cleared:h.state.flags.has('dungeon:d1:echo-cleared'),memory:h.state.flags.has('dungeon:d1:echo-memory'),chest:h.world.tile(s.x0+12,s.z0+8),pot:h.world.tile(s.x0+2,s.z0+9),carrying:!!h.player.carrying,maxMagic:h.state.maxMagic};});
  const check=(pass,label)=>{assert.ok(pass,label);result.checks.push(label);console.log('PASS '+label);};
  const shot=async(t,name)=>{await t.eval(()=>{window.__voxelHeroes.player.hero.root.visible=true;});await t.shot(name);};
  const kill=t=>t.eval(()=>{const h=window.__voxelHeroes;for(const e of h.entities.filter(e=>!e.removed&&e.kind==='enemy'))h.game.damage.dealDamage(e,{amount:999,source:'bomb',from:{x:e.x,z:e.z-2}});});
  check(true,'Muted Chromium and Firefox connect through real local RTC');
  await host.teleport('d1:2,4',6.5,9.5); await guest.teleport('d1:2,4',8.5,7.5); await pump(40);
  await host.eval(()=>{for(const e of window.__voxelHeroes.entities)if(e.kind==='enemy')e.think=()=>{};});
  let views=await Promise.all(pages.map(view));
  check(views.every(v=>v.bells.length===1&&v.foes.length===3&&v.blocked&&!v.key&&v.chest==='h'),'Both heroes see one bell, three first-wave guards and held rewards');
  check(views[0].bells[0].id===views[1].bells[0].id,'The two browsers share the same encounter identity');
  await guest.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(3.5,9.5);h.game.hero.hero.setFacing('west');});
  await pump(6); await guest.tap('sword'); await pump(12); views=await Promise.all(pages.map(view));
  check(views[1].carrying&&!views[0].carrying&&views.every(v=>v.pot==='.'),'Actual guest sword input claims one physical pot and clears its tile for both heroes');
  await guest.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(8.5,4.5);h.game.hero.hero.setFacing('north');});
  await pump(5);
  for(let i=0;i<240;i++){if((await view(host)).bells[0].tell>1)break;await pump(1);}
  await pump(4); views=await Promise.all(pages.map(view));
  check(views.every(v=>v.bells[0].tell>0&&v.bells[0].ring),'The room owner replicates the real warning ring before the volley');
  await shot(guest,'00-guest-sees-warning');
  await guest.tap('sword'); await pump(12); views=await Promise.all(pages.map(view));
  check(views.every(v=>v.muted&&v.bells[0].muted>0&&v.bells[0].tell===0),'The guest pot reaches the room owner and replicates the quiet bell');
  await shot(guest,'01-guest-quiets-shared-bell');
  await kill(host); await pump(5); views=await Promise.all(pages.map(view));
  check(views.every(v=>v.foes.length===0&&v.blocked&&!v.key&&v.bells[0].phase==='reinforcements'),'Neither browser clears the room in the interval between waves');
  await host.teleport('Barrow Mouth',8,7); await pump(42);
  // Pose delivery determines when the guest becomes eligible; keep the authored
  // 1.5-second interval, then wait for actual ownership under slower RTC frames.
  for(let i=0;i<150;i++){
    const pending=await view(guest);
    if(pending.bells[0]?.phase==='fight'&&pending.bells[0]?.wave===1)break;
    await pump(1);
  }
  let v=await view(guest);
  check(v.bells.length===1&&v.bells[0].wave===1&&v.bells[0].phase==='fight','The remaining hero takes over the encounter during its quiet interval');
  check(v.foes.length===2&&new Set(v.foes.map(e=>e.id)).size===2&&v.foes.some(e=>e.type==='barrow-warden')&&v.foes.some(e=>e.type==='gazer'),'Ownership transfer produces exactly one warden/gazer wave');
  await pump(25); // Reinforcements keep their normal appear-in protection.
  await shot(guest,'02-guest-owns-second-wave'); await shot(host,'03-host-explores-separately');
  const capacities=await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.state.maxMagic)));
  await kill(guest); await pump(10); v=await view(guest);
  check(v.cleared&&!v.blocked&&v.key&&v.chest==='c'&&v.bells[0].phase==='done','The guest finishes the second wave and opens the key, shutters and memory chest: '+JSON.stringify(v));
  check((await view(host)).cleared&&(await view(host)).muted,'The distant host receives the saved encounter flags');
  await guest.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(12.5,9.5);h.game.hero.hero.setFacing('north');});
  await guest.stick(0,-1,.4); await pump(15); views=await Promise.all(pages.map(view));
  check(views.every((v,i)=>v.memory&&v.maxMagic===capacities[i]+1),'A physical chest push grants both heroes exactly one permanent magic gem');
  await shot(guest,'04-shared-memory-reward');
  for(const t of pages) await t.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<400&&h.state.mode!=='play';i++){h.input.tap('confirm');await h.tick();}});
  await host.teleport('d1:2,4',6.5,9.5); await pump(35); views=await Promise.all(pages.map(view));
  check(views.every(v=>v.bells.length===1&&v.bells[0].phase==='done'&&v.foes.length===0&&!v.blocked),'Rejoining the finished room restores one inert bell with no restarted guards');
  await guest.eval(()=>window.__voxelHeroes.game.grants.grant('barrow-memory',1,{fanfare:false}));await pump(8);views=await Promise.all(pages.map(view));
  check(views.every((v,i)=>v.maxMagic===capacities[i]+1),'A repeated memory grant does not duplicate either permanent reward');
  check((await Promise.all(pages.map(t=>t.eval(()=>window.__voxelHeroes.game.journal.journalView().entries.find(e=>e.title==='The Note Beneath').status)))).every(s=>s==='done'),'Both adventure journals record the recovered memory');
  await shot(host,'05-friends-reunited-after-the-bell');
  for(const t of pages)assert.deepEqual(t.errors,[]);
  result.ok=true;
} catch(error) {result.ok=false;result.error={message:error.message,stack:error.stack};result.snapshots=await Promise.all(pages.map(t=>t.state().catch(()=>null)));process.exitCode=1;console.error(error.stack);}
finally {
  result.completedUtc=new Date().toISOString();result.passed=result.checks.length;
  writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));
  for(const t of pages)await t.close();await fox?.close();await relay?.close();await server?.close();
}
