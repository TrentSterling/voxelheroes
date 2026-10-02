// Repeatable acceptance run. Every case gets a fresh context and its own receipts.
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync,statSync,cpSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn,execFileSync } from 'node:child_process';
import { chromium, firefox } from 'playwright';
import { buildGame, startServer, listScenarios, runScenario, CHROMIUM_ARGS } from './playtest.mjs';

const args=process.argv.slice(2), value=name=>args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const quick=args.includes('--quick'), stamp=new Date().toISOString().replace(/[:.]/g,'-');
const out=resolve(value('out')??`playtest-out/gauntlet-${stamp}`);
if(existsSync(join(out,'result.json')))throw Error('This folder already contains a run. Choose a fresh --out to preserve receipts.');
mkdirSync(out,{recursive:true});
const report={startedUtc:new Date().toISOString(),quick,scenariosOnly:args.includes('--scenarios-only'),status:'running',url:null,cases:[],stages:[],receipts:[],limitations:['Local WebRTC only; public signaling and separate-network ICE are not tested.','Recorded media playback and decode checks do not measure audible voice quality.','Stress positioning and equipment fixtures are disclosed in the scenarios.']};
const sourceFiles=[];
const sourceWalk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const file=join(dir,entry.name);if(entry.isDirectory())sourceWalk(file);else sourceFiles.push(file);}};
sourceWalk('src');if(existsSync('public/voices'))sourceWalk('public/voices');sourceFiles.push('index.html','package.json','package-lock.json');sourceFiles.sort();
const sourceHash=createHash('sha256');for(const file of sourceFiles){sourceHash.update(file.replaceAll('\\','/')+'\0');sourceHash.update(readFileSync(file));}
report.source={gitHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),sha256:sourceHash.digest('hex'),files:sourceFiles.length};
const portableFile=value('url')?.startsWith('file:')?fileURLToPath(value('url')):null;
if(portableFile)report.artifact={file:portableFile,sha256:createHash('sha256').update(readFileSync(portableFile)).digest('hex')};
const testFiles=listScenarios().map(name=>`scripts/scenarios/${name}.mjs`);
const testWalk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const file=join(dir,entry.name);if(entry.isDirectory())testWalk(file);else testFiles.push(file);}};
testWalk('scripts/lib');testFiles.push('scripts/playtest.mjs','scripts/test-audio-policy.mjs','scripts/browser-smoke.mjs','scripts/npc-voice-smoke.mjs','scripts/voice-bank-audit.mjs','scripts/voice-inventory.mjs','scripts/era-coop-test.mjs','scripts/companion-coop-test.mjs','scripts/barrow-coop-test.mjs','scripts/hive-coop-test.mjs','scripts/watch-coop-test.mjs','scripts/watch-layout-test.mjs','scripts/brineglass-coop-test.mjs','scripts/brineglass-layout-test.mjs','scripts/mara-coop-test.mjs','scripts/mara-layout-test.mjs','scripts/departure-coop-test.mjs','scripts/departure-layout-test.mjs','scripts/clock-coop-test.mjs','scripts/clock-layout-test.mjs','scripts/fair-coop-test.mjs','scripts/fair-layout-test.mjs','scripts/stone-eye-coop-test.mjs','scripts/stone-eye-touch-test.mjs','scripts/pollinator-coop-test.mjs','scripts/pollinator-touch-test.mjs','scripts/town-chests-coop-test.mjs','scripts/town-chests-touch-test.mjs','scripts/multiplayer-test.mjs');
testFiles.push('scripts/barrow-path-coop-test.mjs','scripts/barrow-path-touch-test.mjs');
testFiles.push('scripts/coilmaw-coop-test.mjs','scripts/coilmaw-touch-test.mjs','scripts/coilmaw-native-phone-test.mjs');
testFiles.push('scripts/gauntlet.mjs','scripts/reward-shield-coop-test.mjs','scripts/reward-shield-touch-test.mjs','scripts/opening-coop-test.mjs','scripts/opening-touch-test.mjs');
testFiles.push('scripts/forest-hud-layout-test.mjs','scripts/test-silent-output.mjs','scripts/verify-silent-browser.mjs');
testFiles.push('scripts/rootglass-hud-layout-test.mjs');
report.testSources=Object.fromEntries(testFiles.map(file=>[file.replaceAll('\\','/'),createHash('sha256').update(readFileSync(file)).digest('hex')]));
const resumeFile=value('resume')?resolve(value('resume'),'result.json'):null;
const previous=resumeFile?JSON.parse(readFileSync(resumeFile)):null;
if(previous){
 if(!previous.completedUtc)throw Error('The previous run must finish before it can be resumed.');
 if(previous.source?.sha256!==report.source.sha256)throw Error('Game source changed; run a fresh gauntlet instead of reusing results.');
 // Scenario-only runs never execute the RTC, layout or voice stage drivers.
 // Their edits do not invalidate gameplay measured through unchanged helpers.
 const scenarioOnly=report.scenariosOnly&&previous.stages.every(s=>['test-audio-policy','test-silent-output'].includes(s.name));
 const helpers=testFiles.filter(f=>!f.replaceAll('\\','/').startsWith('scripts/scenarios/')
   && (scenarioOnly ? f.replaceAll('\\','/').startsWith('scripts/lib/')||['scripts/playtest.mjs','scripts/test-audio-policy.mjs'].includes(f)
     : !['scripts/browser-smoke.mjs','scripts/npc-voice-smoke.mjs','scripts/era-coop-test.mjs','scripts/multiplayer-test.mjs'].includes(f)));
 if(helpers.some(f=>previous.testSources?previous.testSources[f.replaceAll('\\','/')]!==report.testSources[f.replaceAll('\\','/')]:statSync(f).mtimeMs>Date.parse(previous.startedUtc)))throw Error('The shared test harness changed; run a fresh gauntlet instead of reusing results.');
 report.resumedFrom={file:resumeFile,sha256:createHash('sha256').update(readFileSync(resumeFile)).digest('hex'),checkedHelpers:helpers,rule:'Only passing cases on identical game source, unchanged scenario scripts and unchanged executed helpers are reused. Unused stage drivers do not invalidate scenario-only runs. Failed or changed tests run again.'};
}
const save=()=>writeFileSync(join(out,'result.json'),JSON.stringify(report,null,2));
save();
let server, browser, fox;
const serializable=r=>({...r,error:r.error?{message:r.error.message,stack:r.error.stack,snapshot:r.error.snapshot}:null,assertions:r.log.filter(l=>l.startsWith('ok   ')).length});
const unchanged=file=>previous?.testSources?previous.testSources[file]===report.testSources[file]:statSync(file).mtimeMs<=Date.parse(previous.startedUtc);
async function run(name,seed,engine='chromium'){
  const id=`${engine}-${seed}-${name}`, dir=join(out,id);let timer;
  const prior=previous?.cases.find(c=>c.id===id&&c.ok);
  const dependencies={
    'nursery-victory':['nursery-crown-journey','nursery-journey','barrow-victory','barrow-journey','first-road','opening'],
    'nursery-crown-journey':['nursery-journey','barrow-victory','barrow-journey','first-road','opening'],
    'nursery-journey':['barrow-victory','barrow-journey','first-road','opening'],
    'barrow-victory':['barrow-journey','first-road','opening'],
    'barrow-journey':['first-road','opening'],
    'first-road':['opening'],
  }[name]??[];
  if(prior&&unchanged(`scripts/scenarios/${name}.mjs`)&&dependencies.every(dep=>unchanged(`scripts/scenarios/${dep}.mjs`))){
    cpSync(join(resolve(value('resume')),id),dir,{recursive:true});report.cases.push({...prior,reusedFrom:resumeFile});save();console.log(`REUSE ${id}: identical game source and unchanged passing test`);return;
  }
  const active=engine==='firefox'?fox:browser;
  console.log(`RUN ${id}`);
  try{
    const r=await Promise.race([runScenario(name,{out:dir,url:report.url,seed,browser:active}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Case exceeded 10 minutes')),600000);})]);
    const item={id,seed,engine,...serializable(r)};report.cases.push(item);
    writeFileSync(join(dir,'result.json'),JSON.stringify(item,null,2));
    console.log(`${r.ok?'PASS':'FAIL'} ${id}: ${item.assertions} assertions, ${r.seconds.toFixed(1)} s${r.error?` | ${r.error.message}`:''}`);
  }catch(error){
    report.cases.push({id,seed,engine,name,ok:false,error:{message:error.message},assertions:0});
    console.log(`FAIL ${id}: ${error.message}`);
    await active.close().catch(()=>{});
    if(engine==='firefox')fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
    else browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
  }finally{clearTimeout(timer);save();}
}
async function stage(name,file,extra=[]){
  const dir=join(out,name);mkdirSync(dir,{recursive:true});console.log(`RUN ${name}`);
  const prior=previous?.stages.find(s=>s.name===name&&s.ok);
  if(name!=='test-audio-policy'&&prior&&unchanged(`scripts/${file}`)){
    cpSync(join(resolve(value('resume')),name),dir,{recursive:true});report.stages.push({...prior,reusedFrom:resumeFile});save();console.log(`REUSE ${name}: identical game source and unchanged passing test`);return;
  }
  const started=Date.now(),log=[];
  const result=await new Promise(resolveStage=>{
    const child=spawn(process.execPath,[`scripts/${file}`,`--url=${report.url}`,`--out=${dir}`,...extra],{cwd:process.cwd(),windowsHide:true});
    const timer=setTimeout(()=>child.kill(),1200000);
    child.stdout.on('data',data=>{const s=String(data);log.push(s);process.stdout.write(s);});
    child.stderr.on('data',data=>{const s=String(data);log.push(s);process.stderr.write(s);});
    child.on('error',error=>{log.push(error.stack);});
    child.on('close',code=>{clearTimeout(timer);resolveStage({name,ok:code===0,exitCode:code,seconds:(Date.now()-started)/1000,assertions:log.join('').split('\n').filter(l=>l.startsWith('PASS ')).length});});
  });
  if(file==='voice-bank-audit.mjs'&&existsSync(join(dir,'result.json'))){const audit=JSON.parse(readFileSync(join(dir,'result.json')));result.assertions=audit.staticChecks+audit.browsers.reduce((n,b)=>n+b.assertions,0);}
  writeFileSync(join(dir,'output.log'),log.join(''));report.stages.push(result);save();
}
try{
  await stage('test-audio-policy','test-audio-policy.mjs');
  if(!report.stages.at(-1).ok)throw Error('Test browser output must be muted before starting the gauntlet.');
  await stage('test-silent-output','test-silent-output.mjs');
  if(!report.stages.at(-1).ok)throw Error('Test output isolation contracts must pass before starting the gauntlet.');
  if(!value('url')){await buildGame();server=await startServer();}
  report.url=value('url')??server.url;save();
  browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
  const critical=['barrow-victory','coilmaw','barrow-journey','barrow-path','opening','first-road','road-bow','clockfair','campaign-story','tower-clock','hero','reward-shield','stone-eye','pollinator','town-chests','pots','eras','era-workshop','departure','companion','tern','mara','party-travel','party-camera','hit-feedback','barrow-echo','hive-pressure','hive-retry','watch-combat','watch-route','brineglass-combat','brineglass-route','world-audit','soak','voices'];
  const names=value('cases')?.split(',')??(quick?[...critical,'guidance'].filter(n=>listScenarios().includes(n)):listScenarios());
  const unknown=names.filter(name=>!listScenarios().includes(name));
  if(unknown.length)throw Error(`Unknown scenarios: ${unknown.join(', ')}. Use scripts/playtest.mjs --list.`);
  const engines=value('engines')?.split(',')??['chromium'], seeds=value('seeds')?.split(',').map(Number)??[1];
  if(engines.some(e=>!['chromium','firefox'].includes(e))||seeds.some(s=>!Number.isInteger(s)||s<0||s>0xffffffff))throw Error('Use chromium/firefox engines and unsigned integer seeds.');
  if(engines.includes('firefox'))fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
  for(const engine of engines)for(const seed of seeds)for(const name of names)await run(name,seed,engine);
  if(!quick&&!value('cases')){
    for(const seed of[17,982451653])for(const name of critical)await run(name,seed);
    fox=await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}});
    for(const name of['hero','pots','eras','era-workshop','companion','tern','guidance','barrow-echo','hive-pressure','hive-retry','voices'])await run(name,17,'firefox');
  }
  if(!args.includes('--scenarios-only')){
    await stage('browser-startup','browser-smoke.mjs',['--local-signaling']);
    await stage('opening-coop','opening-coop-test.mjs');
    await stage('opening-touch','opening-touch-test.mjs');
    await stage('reward-shield-coop','reward-shield-coop-test.mjs');
    await stage('reward-shield-touch','reward-shield-touch-test.mjs');
    await stage('recorded-voices','npc-voice-smoke.mjs');
    if(existsSync('src/game/voice-bank.json'))await stage('recorded-voice-bank','voice-bank-audit.mjs',['--no-build']);
    await stage('era-coop','era-coop-test.mjs');
    await stage('fair-coop','fair-coop-test.mjs');
    await stage('fair-layout','fair-layout-test.mjs');
    await stage('clock-coop','clock-coop-test.mjs');
    await stage('clock-layout','clock-layout-test.mjs');
    await stage('departure-coop','departure-coop-test.mjs');
    await stage('departure-layout','departure-layout-test.mjs');
    await stage('companion-coop','companion-coop-test.mjs');
    await stage('mara-coop','mara-coop-test.mjs');
    await stage('mara-layout','mara-layout-test.mjs');
    await stage('barrow-path-coop','barrow-path-coop-test.mjs');
    await stage('barrow-path-touch','barrow-path-touch-test.mjs');
    await stage('coilmaw-coop','coilmaw-coop-test.mjs');
    await stage('coilmaw-touch','coilmaw-touch-test.mjs');
    await stage('barrow-coop','barrow-coop-test.mjs');
    await stage('stone-eye-coop','stone-eye-coop-test.mjs');
    await stage('stone-eye-touch','stone-eye-touch-test.mjs');
    await stage('pollinator-coop','pollinator-coop-test.mjs');
    await stage('pollinator-touch','pollinator-touch-test.mjs');
    await stage('town-chests-coop','town-chests-coop-test.mjs');
    await stage('town-chests-touch','town-chests-touch-test.mjs');
    await stage('hive-coop','hive-coop-test.mjs');
    await stage('hive-layout','hive-layout-test.mjs');
    await stage('forest-hud-layout','forest-hud-layout-test.mjs');
    await stage('rootglass-hud-layout','rootglass-hud-layout-test.mjs');
    await stage('watch-coop','watch-coop-test.mjs');
    await stage('watch-layout','watch-layout-test.mjs');
    if(!quick)await stage('multiplayer','multiplayer-test.mjs',['--no-build','--local-ice']);
  }
}catch(error){report.fatal={message:error.message,stack:error.stack};}
finally{
  await browser?.close();await fox?.close();await server?.close();
  // A long run is acceptance only for the exact source captured at its start.
  sourceFiles.length=0;sourceWalk('src');if(existsSync('public/voices'))sourceWalk('public/voices');sourceFiles.push('index.html','package.json','package-lock.json');sourceFiles.sort();
  const finalSourceHash=createHash('sha256');for(const file of sourceFiles){finalSourceHash.update(file.replaceAll('\\','/')+'\0');finalSourceHash.update(readFileSync(file));}
  const changedTests=Object.entries(report.testSources).filter(([file,hash])=>!existsSync(file)||createHash('sha256').update(readFileSync(file)).digest('hex')!==hash).map(([file])=>file);
  report.integrity={endSourceSha256:finalSourceHash.digest('hex'),changedTests};
  report.integrity.sourceUnchanged=report.integrity.endSourceSha256===report.source.sha256;
  if(portableFile){report.integrity.artifactUnchanged=createHash('sha256').update(readFileSync(portableFile)).digest('hex')===report.artifact.sha256;if(!report.integrity.artifactUnchanged)report.fatal={message:'Portable HTML changed during this run; rerun from an unchanged artifact.'};}
  if(!report.integrity.sourceUnchanged||changedTests.length)report.fatal={message:'Game or captured test source changed during this run; rerun from an unchanged checkpoint.'};
  const walk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const file=join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.(png|jpg)$/i.test(file))report.receipts.push({file:relative(out,file).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});}};
  walk(out);report.completedUtc=new Date().toISOString();
  report.passed=report.cases.filter(c=>c.ok).length+report.stages.filter(c=>c.ok).length;
  report.failed=report.cases.filter(c=>!c.ok).length+report.stages.filter(c=>!c.ok).length+(report.fatal?1:0);
  report.assertions=[...report.cases,...report.stages].reduce((n,c)=>n+c.assertions,0);
  report.status=report.failed?'failed':'passed';save();
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rows=[...report.cases,...report.stages].map(c=>`<tr><td>${c.ok?'PASS':'FAIL'}</td><td>${esc(c.id??c.name)}</td><td>${c.assertions}</td><td>${esc(c.error?.message??'')}</td></tr>`).join('');
  const pictures=report.receipts.map(r=>`<figure><a href="${esc(r.file)}"><img loading="lazy" src="${esc(r.file)}" alt="${esc(r.file)}"></a><figcaption>${esc(r.file)}</figcaption></figure>`).join('');
  writeFileSync(join(out,'index.html'),`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voxel Heroes gauntlet</title><style>body{background:#182334;color:#e9dbbf;font:16px system-ui;margin:24px}h1{font-size:28px}table{border-collapse:collapse;width:100%}td{padding:8px;border-bottom:1px solid #45546c;overflow-wrap:anywhere}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:20px}figure{margin:0}img{width:100%}figcaption{font-size:12px;overflow-wrap:anywhere}p{max-width:900px}a{color:#a0dfd0}</style><h1>Voxel Heroes: ${report.status}</h1><p>${report.passed} passed / ${report.failed} failed; ${report.assertions} assertions; ${report.receipts.length} screenshot receipts.</p><p>${esc(report.limitations.join(' '))}</p><p><a href="result.json">Full results and SHA-256 receipt manifest</a></p><table>${rows}</table><h2>Visual receipts</h2><main>${pictures}</main>`);
  console.log(`GAUNTLET ${report.status}: ${report.passed} passed, ${report.failed} failed, ${report.assertions} assertions, ${report.receipts.length} receipts -> ${out}`);
  process.exitCode=report.failed?1:0;
}
