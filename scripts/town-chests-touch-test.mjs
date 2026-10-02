import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {CHROMIUM_ARGS} from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const url=arg('url')??'http://127.0.0.1:5173/',out=arg('out')??'playtest-out/town-chests-touch';mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],captures:[],fixtures:'Muted Chromium touch at 320x568 and 568x320, normal and large text. Placements, prerequisite flags, invulnerability and direct sentry damage isolate interactions. Actual CDP A-button events test every future chest while locked and available; native text bounds are measured. Story repair and combat are tested separately.'};
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
const vaults=[{id:'seed',screen:'mossbrook-future:0,0',x:7,z:3,ready:'era:water-restored',reward:'era:dawn-seed',hint:'engine'},{id:'archive',screen:'mossbrook-future:2,0',x:7,z:3,ready:'era:archive-powered',reward:'era:copper-memory',hint:'valves'},{id:'departure',screen:'mossbrook-future:1,1',x:11,z:12,ready:'era:departure-powered',reward:'era:departure-tag',hint:'fix signal'},{id:'keeper',screen:'mossbrook-future:0,0',x:13,z:12,ready:'coast:beacon-lit',reward:'coast:beacon-memory',hint:'beacon'}];
try {
 for(const [name,width,height]of [['phone',320,568],['landscape',568,320]])for(const large of [false,true]) {
  const label=`${name}-${large?'large':'normal'}`,page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true}),errors=[];
  try {
   page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   await page.goto(new URL('?manual=1',url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.ui);
   await page.evaluate(()=>{const h=window.__voxelHeroes,g=h.game.ui.g,text=g.text;window.__chestText=[];g.text=function(value,x,y,o={}){const w=g.measure(String(value),o.size??1,o.tracking??0);window.__chestText.push({text:String(value),x:o.align==='center'?Math.round(x-w/2):o.align==='right'?x-w:x,y,w,h:g.cap*(o.size??1)});return text.call(this,value,x,y,o);};});
   const cdp=await page.context().newCDPSession(page);
   const pressA=async()=>{const b=await page.locator('#btn-a').boundingBox();assert.ok(b);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});await page.evaluate(()=>window.__voxelHeroes.tick());await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.evaluate(()=>window.__voxelHeroes.step(.03));};
   const capture=async(id)=>{const r=await page.evaluate(()=>{const h=window.__voxelHeroes;window.__chestText=[];h.player.hero.root.visible=true;h.game.ui.requestUi();h.render();return{...h.game.ui.uiView(),runs:window.__chestText,prompts:h.game.promptHud.promptView(),toast:h.game.toast.toastView().text,touch:getComputedStyle(document.getElementById('touch')).display};});check(r.runs.every(x=>x.x>=0&&x.y>=0&&x.x+x.w<=r.w+.5&&x.y+x.h<=r.h+.5),`${label}/${id}: all native text fits the canvas`);const overlaps=r.runs.flatMap((a,i)=>r.runs.slice(i+1).filter(b=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y).map(b=>[a.text,b.text]));check(!overlaps.length,`${label}/${id}: text layers do not overlap ${JSON.stringify(overlaps)}`);if(id.endsWith('-locked')&&r.h<200)check(r.prompts.every(p=>p.action!=='sword'),`${label}/${id}: contextual A labels yield to feedback`);if(id.endsWith('-locked'))check(r.runs.map(x=>x.text).join(' ').replace(/\s+/g,' ').includes(r.toast),`${label}/${id}: the complete prerequisite message is visible`);check(r.touch!=='none',`${label}/${id}: touch controls remain visible`);const file=`${out}/${label}-${id}.png`;await page.screenshot({path:file});result.captures.push(file);};
   for(const v of vaults) {
    await page.evaluate(async({v,large})=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.state.settings.largeText=large;h.teleport(v.screen,v.x+.5,v.z+1.5);h.game.hero.hero.place(v.x+.5,v.z+1.5);h.game.hero.hero.setFacing('north');h.player.invT=999;await h.step(.1);},{v,large});
    await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);await pressA();
    check(await page.evaluate(v=>{const h=window.__voxelHeroes,s=h.screen();return h.game.toast.toastView().text.includes(v.hint)&&!h.state.flags.has(`chest:${s.x0+v.x},${s.z0+v.z}`);},v),`${label}/${v.id}: actual touch A explains the lock without awarding treasure`);
    await page.waitForTimeout(250);await capture(`${v.id}-locked`);
    await page.evaluate(async v=>{const h=window.__voxelHeroes;h.game.state.setFlag(v.ready);for(const e of h.entities)if(e.kind==='enemy'&&!e.removed)e.hurt({damage:999,knockback:0,source:'touch-chest-fixture'});await h.step(.2);},v);
    await pressA();check(await page.evaluate(v=>window.__voxelHeroes.state.flags.has(v.reward),v),`${label}/${v.id}: actual touch A opens the available vault`);
    await page.evaluate(async()=>{const h=window.__voxelHeroes;for(let i=0;i<900&&h.state.mode!=='play';i++){if(i%15===0)h.input.tap('confirm');await h.tick();}});
    await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);await capture(`${v.id}-opened`);
   }
   assert.deepEqual(errors,[]);check(true,`${label}: no game exceptions`);await cdp.detach();
  } finally {await page.close();}
 }
 result.ok=true;
} catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{await browser.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));console.log(`${result.ok?'PASS':'FAIL'} ${result.checks.length} muted touch checks, ${result.captures.length} captures.`);}
