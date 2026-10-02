import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync,readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { CHROMIUM_ARGS } from './playtest.mjs';
import { measurePartyFrame } from './lib/party-frame.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/party-camera-touch',url=arg('url')??'http://127.0.0.1:5173/';
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});
const report={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),muted:true,checks:[],views:[],limitations:['Chromium emulates real coarse pointer and touch controls. Flags, invulnerability, arrival positions and facing are fixtures. Native figures and geometry are measured; no audio playback.']};
const check=(ok,label)=>{assert.ok(ok,label);report.checks.push(label);console.log('PASS '+label);};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
try{
 for(const [name,width,height]of[['phone',320,568],['portrait',390,844],['landscape',568,320],['wide-landscape',844,390]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   await page.goto(new URL('?manual=1&seed=17',url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.partyCamera);
   await page.evaluate(async()=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame({prologue:false});for(const flag of['era:mira-travels','era:tern-travels','coast:mara-travels','era:voices-returned','era:copper-memory','coast:beacon-lit'])h.game.state.setFlag(flag);h.game.inventory.giveItem('fire-wand');h.game.inventory.selectItem('fire-wand');h.state.maxMagic=h.state.magic=9;h.player.invT=999;await h.step(.3);});
   for(const size of['normal','large'])for(const [area,key,x,z,yaw]of[['workshop','mossbrook-past:2,0',3.5,9.5,Math.PI/2],['kiln','d4:0,7',7.5,8.5,Math.PI]]){
    await page.evaluate(async([key,x,z,yaw,large])=>{const h=window.__voxelHeroes;h.state.settings.largeText=large;h.teleport(key,x,z);h.player.yaw=yaw;for(const e of h.entities)if(e.kind==='enemy')e.think=()=>{};await h.step(.7);},[key,x,z,yaw,size==='large']);
    // Compact help waits for arrival banners, exactly as it does during play.
    await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible&&!window.__voxelHeroes.game.toast.toastView().visible);
    await page.evaluate(async()=>{const h=window.__voxelHeroes;await h.step(.3);});
    const frame=await page.evaluate(measurePartyFrame),controls=await page.evaluate(()=>[...document.querySelectorAll('#stick,.touch-buttons,.touch-menu')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left/innerWidth,right:r.right/innerWidth,top:r.top/innerHeight,bottom:r.bottom/innerHeight};}));
    const label=`${name}-${size}-${area}`;
    const file=`${out}/${label}.png`;await page.screenshot({path:file});report.views.push({name:label,file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),frame,controls});
    check(frame.actors.length===4,label+' measures all four figures');
    check(frame.actors.every(a=>!a.out&&!a.techOverlap),label+' figures stay visible and clear of technique help');
    check(frame.actors.every(a=>a.headerOverlaps.length===0),label+' figures stay clear of measured HUD and shortcut rectangles');
    check(frame.actors.every(a=>!controls.some(c=>a.left<c.right&&a.right>c.left&&a.top<c.bottom&&a.bottom>c.top)),label+' figures stay clear of the actual touch pad groups');
    check(frame.actors.every(a=>(a.bottom-a.top)*height>14),label+' retains fourteen pixels of figure height');
   }
   check(errors.length===0,name+' has no browser errors');
  }finally{await page.close();writeFileSync(`${out}/result.json`,JSON.stringify(report,null,2));}
 }
 report.ok=true;report.completedUtc=new Date().toISOString();
}finally{await browser.close();writeFileSync(`${out}/result.json`,JSON.stringify(report,null,2));}
