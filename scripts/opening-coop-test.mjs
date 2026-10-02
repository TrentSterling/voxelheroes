import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {firefox} from 'playwright';
import {launch} from './playtest.mjs';
import {startRelay} from './lib/nostr-relay.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/opening-coop',url=arg('url')??'http://127.0.0.1:5173/';mkdirSync(out,{recursive:true});
const hash=createHash('sha256'),walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){hash.update(f.replaceAll('\\','/')+'\0');hash.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:hash.digest('hex'),checks:[],scope:'Muted Chromium and Firefox over real local Trystero RTC. Actual title starts, host walking and King Aldric conversation; guest independently waits in town. Later teleport and health fixtures isolate personal spring use, while the host clears the authored approach by native sword/guard input without test healing or invulnerability. No public signaling or separate-network ICE claim.'};
const check=(pass,label)=>{assert.ok(pass,label);result.checks.push(label);console.log('PASS '+label);};
const pages=[];let relay,fox,view;
try {
  relay=await startRelay();fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
  const host=await launch({url,out:`${out}/host`,seed:17}),guest=await launch({url,out:`${out}/guest`,seed:17,browser:fox});pages.push(host,guest);
  for(const t of pages){await t.eval(()=>{const h=window.__voxelHeroes;h.game.settings.setSetting('muted',true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);});await t.press('Enter');await t.step(2);}
  const config={appId:'voxelheroes-opening-test',relayUrls:[relay.url],rtcConfig:{iceServers:[]}};
  await host.eval(c=>window.__voxelHeroes.game.party.createParty('OPENING',c),config);await guest.eval(c=>window.__voxelHeroes.game.party.joinParty('OPENING',c),config);
  for(const t of pages)await t.page.waitForFunction(()=>window.__voxelHeroes.game.party.partyView().count===2&&window.__voxelHeroes.game.party.partyConnections().some(c=>c.state==='connected'),null,{timeout:45000});
  const pump=async(n=1)=>{for(let i=0;i<n;i++){await Promise.all(pages.map(t=>t.step(.025)));await new Promise(r=>setTimeout(r,35));}};
  const until=async(fn,label,n=140)=>{for(let i=0;i<n;i++){if(await fn())return;await pump();}throw Error(label);};
  view=t=>t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();return{screen:s.key,hp:h.state.hp,maxHp:h.state.maxHp,shield:h.state.gear.shield,sword:h.state.swords.equipped,king:h.game.state.hasFlag('overworld:talked:king'),owner:h.game.party.roomOwner(s.key)===h.game.party.partyView().selfId,foes:h.entities.filter(e=>e.kind==='enemy'&&!e.removed).map(e=>({id:e.netId,type:e.type})),toast:h.game.toast.toastView().text,position:h.game.hero.hero.position(),yaw:h.player.yaw,lock:h.player.lockT,knock:h.player.knockT,attack:h.player.attackT,mode:h.state.mode,prompts:h.game.promptHud.promptView()};});
  check((await view(host)).shield===0&&(await view(guest)).shield===0,'Both friends begin the shared adventure unarmed');
  for(let n=0;n<3;n++)await host.exit('south');
  await host.walkTo(7.5,6.6);await host.stick(0,-1,1/60);await host.tap('sword');
  check(await host.eval(()=>window.__voxelHeroes.game.dialog.dialogView()?.speaker==='King Aldric'),'Native host walking and A reach the king while the guest stays in town');
  for(let n=0;n<120&&(await host.state()).mode==='dialog';n++)await host.tap('confirm');
  await until(async()=>{const v=await view(guest);return v.sword==='blade-start'&&v.shield===1&&v.king;},'The real king must share both starter sword and shield');
  check((await view(guest)).screen==='v1:1,1','The independently exploring guest receives both actual king grants without being moved');
  await guest.tap('sword');
  check(await guest.eval(()=>window.__voxelHeroes.player.attackT>0),'The shared starter blade immediately responds to actual guest sword input');
  await guest.step(.6);await guest.eval(()=>window.__voxelHeroes.input.down('guard'));await guest.step(.1);
  check(await guest.eval(()=>window.__voxelHeroes.player.guarding),'The shared starter shield immediately responds to actual guest guard input');
  await guest.shot('01-town-friend-armed');
  await guest.eval(()=>window.__voxelHeroes.input.up('guard'));await guest.step(.1);
  for(const t of pages)await t.teleport('ow-3-2:1,2',4.5,10.4);
  await until(async()=> (await view(host)).owner&&!(await view(guest)).owner,'The host owns the shared approach');await pump(35);
  await guest.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(4.5,10.4);h.game.hero.hero.setFacing('south');h.setHp(4);});await guest.step(.02);
  await guest.tap('sword');
  check((await view(guest)).hp===4&&(await view(guest)).toast==='Clear barrow guards.','A guest cannot drink while shared guards remain');
  const fight=await host.fight({guard:true,heal:-1,seconds:75,soft:true});
  check(fight.ok&&fight.heals===0,'The host clears both authored approach guards through native sword and shield input');
  await until(async()=> (await view(guest)).foes.length===0,'Shared guard defeat reaches the guest');
  for(const[t,hp,z,face]of[[host,2,12.6,'north'],[guest,4,10.4,'south']])await t.eval(({hp,z,face})=>{const h=window.__voxelHeroes;h.game.hero.hero.place(4.5,z);h.game.hero.hero.setFacing(face);h.player.lockT=h.player.knockT=h.player.attackT=0;h.setHp(hp);},{hp,z,face});
  await pump(2);await guest.tap('sword');await pump(4);
  check((await view(guest)).hp===(await view(guest)).maxHp&&(await view(host)).hp===2,'Actual guest A restores only the guest hearts, including without room ownership');
  await guest.shot('02-guest-drinks-the-spring');
  await host.tap('sword');await pump(4);
  check((await view(host)).hp===(await view(host)).maxHp,'The host can drink from the same reusable spring');
  await guest.tap('sword');await pump(3);
  check((await view(guest)).hp===(await view(guest)).maxHp,'Repeated native A cannot exceed maximum health');
  await host.eval(()=>window.__voxelHeroes.game.party.leaveParty());
  await until(async()=> (await view(guest)).owner,'Departure transfers ownership');
  check((await view(guest)).foes.length===0,'The cleared authored encounter remains cleared after host departure');
  for(const t of pages)assert.deepEqual(t.errors,[]);check(true,'Both muted browsers report no game exceptions');result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};result.snapshots=await Promise.all(pages.map(t=>view?view(t).catch(()=>null):t.state().catch(()=>null)));for(const t of pages)await t.shot('FAILED').catch(()=>{});process.exitCode=1;console.error(error.stack);}
finally{result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));for(const t of pages)await t.close();await fox?.close();await relay?.close();}
