import { mkdirSync,writeFileSync,readFileSync,readdirSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium,firefox } from 'playwright';
import { launch,CHROMIUM_ARGS } from './playtest.mjs';
import { measurePartyFrame,recruitParty,resized } from './lib/party-frame.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=resolve(arg('out')??'playtest-out/party-camera-audit'),url=arg('url')??'http://127.0.0.1:5173/';
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const report={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),muted:true,views:[],limitations:['Recruitment, invulnerability and arrival facing are fixtures. Terrain and figures are native. Workshop travel uses actual ArrowRight input. Bounds measure every active native figure vertex, excluding separate weapons and effects.','A geometric bound overlapping an opaque HUD panel is measured; terrain visibility requires inspection of the retained native screenshots.']};
mkdirSync(out,{recursive:true});
for(const engine of (arg('engines')??'chromium,firefox').split(',')){
 const browser=engine==='firefox'?await firefox.launch({headless:true,firefoxUserPrefs:{'media.volume_scale':'0.0'}}):await chromium.launch({headless:true,args:CHROMIUM_ARGS});
 const t=await launch({browser,url,out:join(out,engine),seed:17});
 try{
  await t.eval(()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);});
  await t.press('Enter');await t.step(1.1);await recruitParty(t);
  for(const [label,viewport]of[['desktop',{width:1280,height:720}],['phone',{width:390,height:844}],['landscape',{width:844,height:390}]]){
   await resized(t,viewport);
   for(const [name,key,x,z,yaw]of[['rear-kiln','d4:0,7',7.5,8.5,Math.PI],['side-kiln','d4:0,7',7.5,8.5,Math.PI/2]]){
    await t.teleport(key,x,z);await t.eval(yaw=>{const h=window.__voxelHeroes;h.player.yaw=yaw;h.player.invT=999;for(const e of h.entities)if(e.kind==='enemy')e.think=()=>{};},yaw);await t.step(1);
    const frame=await t.eval(measurePartyFrame),file=await t.shot(`${label}-${name}`);report.views.push({engine,label,name,file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),frame});
   }
   await t.teleport('mossbrook-past:1,0',13.5,9.5);await t.step(.2);await t.hold('ArrowRight',.9);await t.step(1.3);
   const frame=await t.eval(measurePartyFrame),file=await t.shot(`${label}-workshop-edge`);report.views.push({engine,label,name:'workshop-edge',file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),frame});
  }
  console.log(JSON.stringify({engine,views:report.views.filter(r=>r.engine===engine).map(r=>({name:`${r.label}-${r.name}`,actors:r.frame.actors.map(a=>({name:a.name,out:a.out,techOverlap:a.techOverlap,bounds:[a.left,a.top,a.right,a.bottom]}))})),errors:t.errors}));
  if(t.errors.length)throw Error(t.errors.join('\n'));
 }finally{await t.close();await browser.close();writeFileSync(join(out,'result.json'),JSON.stringify(report,null,2));}
}
report.completedUtc=new Date().toISOString();report.ok=true;writeFileSync(join(out,'result.json'),JSON.stringify(report,null,2));
