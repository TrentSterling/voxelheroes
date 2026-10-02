import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {firefox} from 'playwright';
import {launch} from './playtest.mjs';
import journey from './scenarios/barrow-journey.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/barrow-retakes',artifact=resolve('dist-artifact/voxel-heroes.html'),url=arg('url')??pathToFileURL(artifact).href;
assert.ok(!existsSync(`${out}/result.json`),'Choose a fresh receipt folder');mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'),walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),artifactSha256:hash(readFileSync(artifact)),checks:[],scope:'Muted offline Firefox, native title-to-boss-key route with earned equipment and actual movement/combat/puzzles. No actor, health, gear or invulnerability fixtures. The step wrapper only captures the actual boomerang prize before its normal two-second reward wait; later idle photos wait for arrival text to fade.'};
let t,browser;
try {
  browser=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});t=await launch({url,out,seed:17,browser});
  let prize=false;const step=t.step.bind(t);
  t.step=async seconds=>{if(!prize&&seconds>=1&&await t.eval(()=>window.__voxelHeroes.game.inventory.hasItem('boomerang'))){prize=true;await t.shot('00-native-boomerang-prize');}return step(seconds);};
  await journey(t);assert.ok(prize,'Native earned boomerang prize captured');result.checks.push('Native earned boomerang prize captured before the cheer finishes');
  await t.page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible&&!window.__voxelHeroes.game.toast.toastView().visible);
  await t.shot('20-idle-last-rest');result.checks.push('Native antechamber photographed after arrival feedback finishes');
  assert.deepEqual(t.errors,[]);assert.equal(hash(readFileSync(artifact)),result.artifactSha256);result.checks.push('Offline Firefox reports no game exceptions and the portable HTML remains unchanged');
  result.assertions=t.log.filter(x=>x.startsWith('ok   ')).length;result.log=t.log;result.shots=t.shots;result.ok=true;
}catch(e){result.ok=false;result.error={message:e.message,stack:e.stack};result.snapshot=await t?.state().catch(()=>null);await t?.shot('FAILED').catch(()=>{});process.exitCode=1;console.error(e.stack);}
finally{await t?.close();await browser?.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));console.log(`${result.ok?'PASS':'FAIL'} ${result.assertions??0} native assertions and ${result.checks.length} offline retake checks.`);}
