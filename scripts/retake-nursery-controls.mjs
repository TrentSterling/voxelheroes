import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {firefox} from 'playwright';
import {launch} from './playtest.mjs';
import controls from './scenarios/combat-talk.mjs';
const out='playtest-out/nursery-dialogue-retakes-20261002';mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],scope:'Muted Firefox. Reuses the isolated native guarded-sword/NPC contract. Its placement, equipment, stationary hostile and removed unrelated foes are disclosed fixtures. A native confirm reveals the actual first paragraph before its screenshot. No actor visibility, camera or health edits.'};
let t,browser;
try {
 browser=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});t=await launch({url:'http://127.0.0.1:5173/',out,seed:17,browser});
 const shot=t.shot.bind(t);
 t.shot=async name=>{if(name==='02-deliberate-forester-talk'){await t.tap('confirm');assert.ok(await t.eval(()=>window.__voxelHeroes.game.dialog.dialogView()?.text.includes('golden wings')));result.checks.push('Native confirm reveals the complete first paragraph before the photograph');}return shot(name);};
 await controls(t);assert.deepEqual(t.errors,[]);result.checks.push('The guarded sword and deliberate conversation contract passes without browser errors');result.assertions=t.log.filter(x=>x.startsWith('ok   ')).length;result.shots=t.shots;result.ok=true;
} catch(e) {result.ok=false;result.error={message:e.message,stack:e.stack};process.exitCode=1;console.error(e.stack);}
finally {await t?.close();await browser?.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));console.log(`${result.ok?'PASS':'FAIL'} ${result.assertions??0} native input assertions; ${result.checks.length} dialogue retake checks.`);}
