import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium,firefox} from 'playwright';
import {CHROMIUM_ARGS} from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3),out=arg('out')??'playtest-out/portable-encoding';
const artifact=readFileSync('dist-artifact/voxel-heroes.html'),old=arg('before')?readFileSync(arg('before')):null,prefix=Buffer.from('<meta charset="UTF-8">\n');
const hash=b=>createHash('sha256').update(b).digest('hex');
mkdirSync(out,{recursive:true});const result={startedUtc:new Date().toISOString(),artifactSha256:hash(artifact),beforeArtifactSha256:old?hash(old):null,checks:[],scope:'Muted local-file Chromium and Firefox. Deliberate simple dialogue/choice fixtures isolate native Unicode marks. No recordings, external network, listening or PCM audit.'};
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};
try{
 check(artifact.subarray(0,prefix.length).equals(prefix),'Portable declares UTF-8 before any content');
 if(old)check(artifact.subarray(prefix.length).equals(old),'Corrected portable differs from the prior tested artifact only by an initial UTF-8 declaration');
 for(const[name,engine]of Object.entries({chromium,firefox})){
  const b=await engine.launch({headless:true,...(name==='chromium'?{args:CHROMIUM_ARGS}:{firefoxUserPrefs:{'media.volume_scale':'0.0'}})});
  try{
   const p=await b.newPage({reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
   const url=pathToFileURL(resolve('dist-artifact/voxel-heroes.html'));url.searchParams.set('manual','1');await p.goto(url.href);await p.waitForFunction(()=>window.__voxelHeroes?.game?.dialog);
   check(await p.evaluate(()=>document.characterSet)==='UTF-8',name+': offline document uses UTF-8');
   await p.evaluate(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.state.settings.muted=true;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);window.__encodingRuns=[];const g=h.game.ui.g,text=g.text;g.text=function(value,...args){window.__encodingRuns.push(String(value));return text.call(this,value,...args);};});
   await p.evaluate(async()=>{const h=window.__voxelHeroes;h.game.dialog.showDialog('Portable paragraph fixture.');h.input.tap('confirm');await h.tick();window.__encodingRuns=[];h.game.ui.requestUi();h.render();});
   check(await p.evaluate(()=>window.__encodingRuns.includes('\u25bc'.replace(/\\u([0-9a-f]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16))))),name+': native next-page mark is the single down-arrow glyph');
   await p.screenshot({path:`${out}/${name}-paragraph.png`});
   await p.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('confirm');await h.tick();h.game.dialog.showDialog('Portable choice fixture.',{choices:['Continue','Wait']});h.input.tap('confirm');await h.tick();window.__encodingRuns=[];h.game.ui.requestUi();h.render();});
   check(await p.evaluate(()=>window.__encodingRuns.includes('\u25b6'.replace(/\\u([0-9a-f]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16))))),name+': native selected-choice mark is the single right-arrow glyph');
   check(!await p.evaluate(()=>window.__encodingRuns.some(s=>s.includes('\u00e2'.replace(/\\u([0-9a-f]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16)))))),name+': dialogue marks contain no garbled prefix');
   await p.screenshot({path:`${out}/${name}-choice.png`});check(errors.length===0,name+': no runtime errors');
  }finally{await b.close();}
 }
 result.ok=true;
}catch(e){result.ok=false;result.error={message:e.message,stack:e.stack};process.exitCode=1;console.error(e.stack);}
finally{result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));}
