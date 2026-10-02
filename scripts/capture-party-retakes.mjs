// Fresh portable captures with the party facing the camera. No audio playback.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { launch } from './playtest.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/party-retakes';
const url=process.argv.find(a=>a.startsWith('--url='))?.slice(6)??'http://127.0.0.1:5173/dist-artifact/voxel-heroes.html';
const hash=b=>createHash('sha256').update(b).digest('hex'),walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});const r={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),artifactSha256:hash(readFileSync('dist-artifact/voxel-heroes.html')),muted:true,fixtures:'Portable Chromium, recruitment and progress flags, facing/arrival, full magic and stationary foe AI. Actual Guard+Item casts; no audio, new model or image-generation assets.'};
const t=await launch({url,out,seed:17});
try {
 await t.eval(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.give('fire-wand');h.game.inventory.selectItem('fire-wand');for(const flag of['era:mira-travels','era:tern-travels','coast:mara-travels','era:voices-returned','era:copper-memory','coast:beacon-lit'])h.game.state.setFlag(flag);h.state.maxMagic=h.state.magic=9;h.player.invT=999;h.game.hero.hero.setFacing('south');});
 await t.teleport('d4:0,7',7.5,8.5);await t.step(1.6);await t.eval(()=>{const h=window.__voxelHeroes,s=h.screen();for(const[e,i]of h.entities.filter(e=>e.type==='tideglass-skater').map((e,i)=>[e,i])){e.x=s.x0+(i?9.5:5.5);e.z=s.z0+6.5;e.hp=18;e.think=()=>{};e.harmless=true;}h.player.invT=999;h.state.magic=9;h.state.companionRuntime.steamCooldown=0;h.player.hero.root.visible=true;});await t.step(.2);
 r.party=await t.eval(()=>window.__voxelHeroes.game.companions.companionView());assert.equal(r.party.steamReady,true);await t.shot('01-portable-party-ready');
 await t.page.keyboard.down('Shift');await t.step(1/60);await t.page.keyboard.down('k');await t.step(1/60);await t.page.keyboard.up('k');await t.page.keyboard.up('Shift');await t.step(.15);
 r.cast=await t.eval(()=>{const h=window.__voxelHeroes;return{magic:h.state.magic,count:h.state.companionRuntime.steamCount,enemies:h.entities.filter(e=>e.type==='tideglass-skater').map(e=>({hp:e.hp,pose:e.mesh.pose,flash:e.flashT,rgb:e.mat.emissive.toArray()}))};});assert.equal(r.cast.magic,6);assert.equal(r.cast.count,1);assert.ok(r.cast.enemies.every(e=>e.hp===10&&e.pose==='open'&&e.rgb[0]<.1));await t.shot('02-portable-readable-steamwheel');
 await t.step(1);await t.shot('03-portable-open-shells');
 assert.deepEqual(t.errors,[]);r.ok=true;r.images=t.shots.map(file=>({file,sha256:hash(readFileSync(file))}));console.log('PASS fresh muted portable party, three-magic Steamwheel, two readable eight-damage openings and image hashes.');
}catch(error){r.ok=false;r.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{r.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(r,null,2));await t.close();}
