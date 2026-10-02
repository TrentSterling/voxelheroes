import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/rootglass-woods-retakes';assert.ok(!existsSync(`${out}/result.json`));
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
const fingerprint=()=>{const h=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){h.update(f.replaceAll('\\','/')+'\0');h.update(readFileSync(f));}return h.digest('hex');};
const result={startedUtc:new Date().toISOString(),sourceSha256:fingerprint(),captures:[],scope:'Arranged forest overview photographs. First-orb story flags, starter gear, placement and unrelated enemy removal are fixtures. Native arrival and asynchronous terrain construction settle before photography. No visibility, health or immunity edits. Output disconnected.'};
const t=await launch({url:arg('url')??'http://127.0.0.1:5173/',out,seed:17});
try {
  await t.eval(()=>{
    const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.settings.setSetting('muted',true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);
    h.state.flags.add('overworld:talked:king');h.state.flags.add('dungeon:d1:entered');h.game.dungeons.giveBossKey('d1');h.game.dungeons.defeatBoss('d1');h.game.dungeons.completeDungeon('d1');h.state.gear.sword=1;h.state.gear.shield=1;
  });
  // Let the backdrop and neighbouring terrain jobs finish in real time.
  await t.page.waitForTimeout(5000);
  for(const [name,key,x,z] of [['northwood','forest:1,2',8.5,11.5],['mothwater','forest:1,1',8.5,10.5],['carved-stone','forest:1,0',8.5,12.5],['split-root','lost-woods:2,0',8.5,11.5],['golden-leaves','lost-woods:3,0',8.5,11.5]]) {
    await t.teleport(key,x,z);await t.step(2);
    await t.eval(()=>{for(const e of [...window.__voxelHeroes.entities])if(e.kind==='enemy')e.remove();});
    await t.page.waitForTimeout(2500);await t.step(4);
    const state=await t.eval(()=>({visible:window.__voxelHeroes.player.hero.root.visible,invT:window.__voxelHeroes.player.invT,guard:window.__testAudioOutputGuard?.version,muted:window.__voxelHeroes.state.settings.muted}));
    assert.ok(state.visible&&state.invT<=0&&state.muted&&state.guard===1);
    const file=await t.shot(name);result.captures.push({file,key,...state,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});
  }
  assert.deepEqual(t.errors,[]);result.sourceUnchanged=result.sourceSha256===fingerprint();assert.ok(result.sourceUnchanged);result.ok=true;
  console.log(`PASS ${result.captures.length} settled woodland photographs; no hero visibility or health edits.`);
}catch(e){result.ok=false;result.error={message:e.message,stack:e.stack};console.error(e.stack);process.exitCode=1;}
finally{await t.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));}
