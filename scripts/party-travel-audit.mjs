// Silent before/after measurements. Terrain and recruitment are disclosed fixtures;
// the hero follows the course with actual stick input and every tick is measured.
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, firefox } from 'playwright';
import { launch, CHROMIUM_ARGS } from './playtest.mjs';
import assert from 'node:assert/strict';
const value=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=resolve(value('out')??'playtest-out/party-travel-audit'),url=value('url')??'http://127.0.0.1:5173/';
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const files=[...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort(),fp=createHash('sha256');
for(const file of files){fp.update(file.replaceAll('\\','/')+'\0');fp.update(readFileSync(file));}
const report={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),muted:true,engines:[],checks:[],limitations:['Recruitment, empty terrain, one wall and stationary combat AI are fixtures. All travel uses virtual stick input; attacks use actual controls. No audible quality or enjoyment measurement.','Moving followers may pass one another; final spacing and continuous safe travel are measured separately.']};
mkdirSync(out,{recursive:true});
for(const engine of (value('engines')??'chromium,firefox').split(',')) {
 const browser=engine==='firefox'?await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}}):await chromium.launch({headless:true,args:CHROMIUM_ARGS});
 const t=await launch({browser,url,out:join(out,engine),seed:17});
 try {
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);});
  await t.press('Enter');await t.step(1.1);await t.teleport('Crossroads',6.5,5.5);
  const before=await t.eval(()=>{
   const h=window.__voxelHeroes,s=h.screen();for(const e of h.entities)if(e.kind!=='companion'&&e.kind!=='player')e.remove();
   for(let z=1;z<s.h-1;z++)for(let x=1;x<s.w-1;x++)h.world.setTile(s.x0+x,s.z0+z,'.');
   for(let z=2;z<=7;z++)h.world.setTile(s.x0+7,s.z0+z,'#');h.world.rebuild?.();
   for(const flag of['era:mira-travels','era:tern-travels','coast:mara-travels','era:copper-memory','era:voices-returned','coast:beacon-lit'])h.game.state.setFlag(flag);
   h.player.yaw=0;h.player.invT=999;return {screen:s.key,wall:'x=7,z=2..7',course:[[6.5,8.5],[8.5,8.5],[8.5,5.5]]};
  });
  await t.step(.2);await t.shot('01-before-corner');
  const travel=await t.eval(async course=>{
   const h=window.__voxelHeroes,s=h.screen(),samples=[];
   const sample=()=>{const actors=h.entities.filter(e=>e.kind==='companion'&&!e.removed&&e.object.visible);samples.push({time:h.state.time,player:[h.player.x-s.x0,h.player.z-s.z0],actors:actors.map(e=>({name:e.name,x:e.x-s.x0,z:e.z-s.z0,blocked:h.world.blocked(e.x,e.z,e.r,e),pose:e.rig.pose()}))});};
   for(const [x,z]of course){let arrived=false;for(let i=0;i<900;i++){const dx=s.x0+x-h.player.x,dz=s.z0+z-h.player.z,d=Math.hypot(dx,dz);if(d<.09){arrived=true;break;}h.input.setStick(dx/d,dz/d);await h.tick();sample();}if(!arrived)throw Error('Stick course stuck');h.input.setStick(0,0);}
   for(let i=0;i<180;i++){await h.tick();sample();}
   return {samples,view:h.game.companions.companionView()};
  },before.course);
  await t.shot('02-after-corner');
  // A long straight trail exposes companions walking through one another.
  await t.teleport('Crossroads',3.5,9.5);await t.step(.2);
  const straight=await t.eval(async()=>{const h=window.__voxelHeroes,s=h.screen();let minimum=Infinity,overlapTicks=0;h.input.setStick(1,0);for(let i=0;i<100;i++){await h.tick();const es=h.entities.filter(e=>e.kind==='companion'&&!e.removed&&e.object.visible);let close=false;for(let a=0;a<es.length;a++)for(let b=a+1;b<es.length;b++){const d=Math.hypot(es[a].x-es[b].x,es[a].z-es[b].z);minimum=Math.min(minimum,d);if(d<.72)close=true;}if(close)overlapTicks++;}h.input.setStick(0,0);await h.step(1);return{minimum,overlapTicks,view:h.game.companions.companionView()};});
  await t.shot('03-straight-formation');
  await t.teleport('d4:0,7',7.5,8.5);await t.step(1.6);
  await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();h.give('fire-wand');h.game.inventory.selectItem('fire-wand');h.state.maxMagic=9;h.state.magic=9;h.state.companionRuntime.steamCooldown=0;for(const[e,i]of h.entities.filter(e=>e.type==='tideglass-skater').map((e,i)=>[e,i])){e.x=s.x0+(i?9.5:5.5);e.z=s.z0+6.5;e.hp=18;e.think=()=>{};e.harmless=true;}h.player.invT=999;});
  await t.page.keyboard.down('Shift');await t.step(1/60);await t.page.keyboard.down('k');await t.step(1/60);await t.page.keyboard.up('k');await t.page.keyboard.up('Shift');
  const flashes=[];let elapsed=0;
  for(const time of[0,.05,.15,.25,.35,.6]){if(time>elapsed)await t.step(time-elapsed);elapsed=time;flashes.push(await t.eval(time=>{const h=window.__voxelHeroes;return{time,magic:h.state.magic,steamCount:h.state.companionRuntime.steamCount,enemies:h.entities.filter(e=>e.type==='tideglass-skater').map(e=>({hp:e.hp,flashT:e.flashT,stunT:e.stunT,knockT:e.knockT,emissive:e.mat.emissive.toArray(),pose:e.mesh.pose}))};},time));if([.05,.15,.35].includes(time))await t.shot(`04-flash-${time}`);}
  report.engines.push({engine,fixture:before,travel,straight,flashes,errors:t.errors??[],shots:t.shots});
  console.log(JSON.stringify({engine,corner:travel.view,straight,flashes}));
 }finally{await t.close();await browser.close();writeFileSync(join(out,'result.json'),JSON.stringify(report,null,2));}
}
if(process.argv.includes('--verify')) {
 const check=(pass,label)=>{assert.ok(pass,label);report.checks.push(label);console.log('PASS '+label);};
 for(const r of report.engines){
  const c=r.travel.view,s=r.straight.view;
  check(c.nearby&&c.ternNearby&&c.maraNearby,`${r.engine}: the entire party reconnects around the wall`);
  check([c.mira,c.tern,c.mara].every(e=>e.pose==='stand'&&!e.blocked),`${r.engine}: the corner party settles on free ground`);
  check(s.nearby&&s.ternNearby&&s.maraNearby,`${r.engine}: teleport replaces the stale trail`);
  const actors=[s.mira,s.tern,s.mara];let separation=Infinity;
  for(let a=0;a<actors.length;a++)for(let b=a+1;b<actors.length;b++)separation=Math.min(separation,Math.hypot(actors[a].x-actors[b].x,actors[a].z-actors[b].z));
  check(separation>.85,`${r.engine}: the straight party keeps distinct settled silhouettes`);
  check(r.flashes.every(f=>f.magic===6&&f.steamCount===1&&f.enemies.every(e=>e.hp===10&&e.pose==='open')),`${r.engine}: real Steamwheel pays three and opens both eight-damage shells`);
  check(r.flashes[0].enemies.every(e=>e.emissive[0]>0&&e.emissive[0]<.35),`${r.engine}: limited emission keeps the impact readable`);
  check(r.flashes[2].enemies.every(e=>e.emissive[0]<.1&&e.stunT>0),`${r.engine}: the flash fades before the stun ends`);
  check(r.flashes.at(-1).enemies.every(e=>e.flashT===0&&e.emissive.every(n=>n===0)),`${r.engine}: every flash ends cleanly`);
  check(r.errors.length===0,`${r.engine}: no browser errors`);
 }
 report.ok=true;
}
report.images=report.engines.flatMap(r=>r.shots.map(file=>({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')})));
report.completedUtc=new Date().toISOString();writeFileSync(join(out,'result.json'),JSON.stringify(report,null,2));
