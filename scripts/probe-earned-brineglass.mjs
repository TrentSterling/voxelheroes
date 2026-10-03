import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { firefox } from 'playwright';
import { launch } from './playtest.mjs';
import { afterFireWand } from './scenarios/brineglass-crown-journey.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const from=arg('from'),out=arg('out');
if(!from||!out||existsSync(join(out,'result.json')))throw Error('Supply an earned --from checkpoint and fresh --out folder.');
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const fingerprint=()=>{const h=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){h.update(f.replaceAll('\\','/')+'\0');h.update(readFileSync(f));}return h.digest('hex');};
mkdirSync(out,{recursive:true});
const result={startedUtc:new Date().toISOString(),sourceSha256:fingerprint(),from,checkpointSha256:createHash('sha256').update(readFileSync(from)).digest('hex'),scope:'Diagnostic continuation of an earned fire-wand save. Ordinary route inputs; no gear grants, health edits, immunity, teleport, direct damage or AI fixtures. This is not a fresh-title acceptance case. Output disconnected before navigation.'};
let browser,t;
try{
  browser=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
  t=await launch({url:arg('url')??'http://127.0.0.1:5173/',browser,out,seed:17});
  const checkpoint=JSON.parse(readFileSync(from));await t.load(checkpoint.data);await t.eval(()=>{const h=window.__voxelHeroes;h.game.settings.setSetting('muted',true);h.game.settings.setSetting('npcVoices',false);});
  result.start=await t.state();await afterFireWand(t);result.end=await t.state();result.ok=true;
}catch(e){result.ok=false;result.error={message:e.message,stack:e.stack,snapshot:await t?.state().catch(()=>null)};await t?.shot('FAILED').catch(()=>{});process.exitCode=1;}
finally{
  result.sourceUnchanged=result.sourceSha256===fingerprint();if(!result.sourceUnchanged){result.ok=false;process.exitCode=1;}
  result.completedUtc=new Date().toISOString();result.log=t?.log??[];result.assertions=result.log.filter(l=>l.startsWith('ok   ')).length;result.errors=t?.errors??[];result.shots=t?.shots??[];
  writeFileSync(join(out,'result.json'),JSON.stringify(result,null,2));await t?.close();await browser?.close();
  console.log(JSON.stringify({ok:result.ok,assertions:result.assertions,shots:result.shots.length,end:result.end?.key,error:result.error?.message}));
}
