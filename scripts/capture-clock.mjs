import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './playtest.mjs';
import { unwindClock } from './lib/tower-clock.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/clock-retakes',url=arg('url')??pathToFileURL(resolve('dist-artifact/voxel-heroes.html')).href;
const hash=b=>createHash('sha256').update(b).digest('hex'),walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),artifactSha256:hash(readFileSync('dist-artifact/voxel-heroes.html')),checks:[],fixtures:'Muted portable Chromium, voices disabled. Earlier campaign, gear, health, camera arrival and invulnerability are fixtures. Anchor Read, the four native tool actions and northern stair use gameplay. No playback.'};
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};
let t;
try{
 t=await launch({url,out,seed:17});
 const photograph=t.shot;t.shot=async name=>{await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);await t.eval(()=>window.__voxelHeroes.player.hero.root.visible=true);return photograph(name);};
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.state.settings.muted=true;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);for(let n=1;n<=4;n++){h.game.state.setFlag('orb:'+n);h.game.state.setFlag('boss:d'+n);h.game.state.setFlag('dungeon:d'+n+':complete');h.game.state.setFlag('dungeon:d'+n+':entered');h.game.dungeons.giveBossKey('d'+n);}h.game.state.setFlag('overworld:talked:king');for(const id of['boomerang','bombs','grapple','fire-wand'])h.game.inventory.giveItem(id);h.give('blade-start');h.game.swords.equipSword('blade-start');h.player.invT=999;});
 await t.teleport('tower-trial:0,0',11,13.5);await t.step(4);
 check(await t.eval(()=>window.__voxelHeroes.entities.some(e=>e.type==='boss-bishop'&&e.trial)),'Portable clock opens with the native protected keeper');await t.shot('01-portable-four-hours');
 await t.walkTo(4.5,8.6);await t.eval(()=>{const h=window.__voxelHeroes;h.game.hero.hero.setFacing('north');h.player.lockT=h.player.knockT=h.player.stallT=0;});await t.tap('sword');await t.tap('confirm');
 check(await t.eval(()=>{const d=window.__voxelHeroes.game.dialog.dialogView();return d?.speaker==='Sage Iona'&&d.shown.includes('hour of return');}),'Portable actual Read opens the barrow story');await t.shot('02-portable-borrowed-return');
 await t.eval(async()=>{const h=window.__voxelHeroes;for(let i=0;i<30&&h.state.mode==='dialog';i++){h.input.tap('confirm');await h.tick();}});
 check(await t.eval(()=>window.__voxelHeroes.state.mode==='play'),'Portable ordinary dialogue paging returns to play');
 await unwindClock(t);
 check(await t.eval(()=>window.__voxelHeroes.game.state.hasFlag('tower:trial')&&!window.__voxelHeroes.entities.some(e=>e.type==='boss-bishop')),'Portable real four-tool route frees the clock');await t.shot('03-portable-the-hands-move');
 await t.walkTo(10.5,.5,{allowHooks:true,soft:true});await t.step(1.6);
 check((await t.state()).key==='tower-hive:1,2','Portable actual movement climbs the unlocked memory stair');
 assert.deepEqual(t.errors,[]);check(true,'Portable clock finishes without runtime errors');result.ok=true;result.images=t.shots.map(file=>({file,sha256:hash(readFileSync(file))}));
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{await t?.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));}
