import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/departure-retakes',url=arg('url')??pathToFileURL(resolve('dist-artifact/voxel-heroes.html')).href;
const hash=b=>createHash('sha256').update(b).digest('hex'),walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),artifactSha256:hash(readFileSync('dist-artifact/voxel-heroes.html')),checks:[],fixtures:'Muted portable Chromium. Milestone flags, equipment, camera arrival, invulnerability and zeroing the initial courier wait timer are fixtures. Warning, actual grapple, pottery lift/throw and ordinary native first-day Talk run through game controls. Fresh first attack has no leftover combat particles. No playback.'};
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};
let t;
try{
 t=await launch({url,out,seed:17});
 const photograph=t.shot;t.shot=async name=>{await t.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);return photograph(name);};
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);for(const id of['era:water-restored','era:archive-powered','era:departure-powered'])h.game.state.setFlag(id);h.give('blade-start');h.give('grapple');h.game.swords.equipSword('blade-start');h.game.inventory.selectItem('grapple');h.state.maxMagic=h.state.magic=5;h.player.invT=999;});
 await t.teleport('mossbrook-future:1,1',8.5,7.3);await t.step(.9);await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
 await t.eval(()=>window.__voxelHeroes.entities.find(e=>e.type==='bell-courier').ai.departure.t=0);await t.step(.03);
 check(await t.eval(()=>{const e=window.__voxelHeroes.entities.find(e=>e.type==='bell-courier');return e.ai.departure.phase==='call'&&e.cue.visible&&e.ai.departure.shots===0;}),'Portable native courier warns all three lanes before its first note');await t.shot('01-portable-three-notes');
 await t.tap('item');await t.step(.3);
 check(await t.eval(()=>{const e=window.__voxelHeroes.entities.find(e=>e.type==='bell-courier');return e.hp===24&&e.ai.departure.openT>2.5&&e.mesh.pose==='open'&&e.ai.departure.phase==='recover';}),'Portable real grapple interrupts and opens the core without damage');await t.shot('02-portable-open-shutters');
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(11.5,7.6);h.game.hero.hero.setFacing('north');h.player.lockT=h.player.knockT=h.player.stallT=0;});await t.tap('sword');
 check(await t.eval(()=>!!window.__voxelHeroes.player.carrying),'Portable actual A input lifts native station pottery');await t.shot('03-portable-pottery');
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(8.5,6.5);h.game.hero.hero.setFacing('north');h.player.lockT=h.player.knockT=h.player.stallT=0;});await t.tap('sword');await t.step(.3);
 check(await t.eval(()=>{const h=window.__voxelHeroes,e=h.entities.find(e=>e.type==='bell-courier');return !h.player.carrying&&e.hp<24&&e.ai.departure.openT>2;}),'Portable thrown pot damages and opens the same courier');
 await t.teleport('mossbrook-past:1,1',4.5,5.6);await t.step(.3);await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.setFacing('north');h.player.lockT=h.player.knockT=h.player.stallT=0;});await t.tap('sword');await t.tap('confirm');
 check(await t.eval(()=>{const d=window.__voxelHeroes.game.dialog.dialogView();return d?.speaker==='Tern'&&d.shown.includes('lamp is still lit');}),'Portable native young Tern remembers the repaired signal');await t.shot('04-portable-a-first-spring');
 assert.deepEqual(t.errors,[]);check(true,'Portable chapter finishes without page errors');result.ok=true;result.images=t.shots.map(file=>({file,sha256:hash(readFileSync(file))}));
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{await t?.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));}
