import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {CHROMIUM_ARGS} from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const url=arg('url')??'http://127.0.0.1:5173/',out=arg('out')??'playtest-out/coilmaw-touch';
assert.ok(!existsSync(`${out}/result.json`),'Choose a fresh receipt folder');mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],captures:[],scope:'Muted Chromium touch at 320x568 and 568x320, normal and large text. Exact Coilmaw HUD, phase instructions and exposed-head labels; actual touch A interrupts a committed head charge. Teleport, progress/equipment, invulnerability, head-stage body removal, nearby screenshot positions and sword approach are disclosed fixtures. Fresh full victory is measured separately.'};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};

try {
 for(const[name,width,height]of[['phone',320,568],['landscape',568,320]])for(const large of[false,true]) {
  const label=`${name}-${large?'large':'normal'}`,page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true}),errors=[];
  try {
   page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   await page.goto(new URL('?manual=1',url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.ui);
   await page.evaluate(async large=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame({prologue:false});h.state.settings.largeText=large;h.state.flags.add('overworld:talked:king');h.game.inventory.giveItem('boomerang');h.give('blade-start');h.give('shield-1');h.game.dungeons.giveBossKey('d1');h.player.invT=999;h.teleport('d1-boss',11,13.5);await h.step(6);const g=h.game.ui.g,text=g.text;window.__coilText=[];g.text=function(v,x,y,o={}){const w=g.measure(String(v),o.size??1,o.tracking??0);window.__coilText.push({text:String(v),x:o.align==='center'?Math.round(x-w/2):o.align==='right'?x-w:x,y,w,h:g.cap*(o.size??1)});return text.call(this,v,x,y,o);};},large);
   await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);await page.waitForTimeout(4600);
   const capture=async(id,progress)=>{
    const v=await page.evaluate(async id=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-serpent'),s=h.screen();
     if(id!=='interrupt')for(const[x,z]of[[0,1.65],[2.5,0],[-2.5,0],[0,-1.65]])if(!h.world.blocked(b.x+x,b.z+z,h.player.r,h.player)){h.game.hero.hero.place(b.x+x-s.x0,b.z+z-s.z0);break;}
     // Advance ordinary frames until the invulnerable layout fixture is visible.
     for(let n=0;n<10;n++){await h.tick();if(h.player.hero.root.visible)break;}
     window.__coilText=[];h.game.ui.requestUi();h.render();return{...h.game.ui.uiView(),runs:window.__coilText,objective:h.game.objective.objectiveHudText(),heroVisible:h.player.hero.root.visible,hero:{x:h.player.x-s.x0,z:h.player.z-s.z0},boss:{x:b.x-s.x0,z:b.z-s.z0}};},id);
    result.layouts??=[];result.layouts.push({label,id,...v});const file=`${out}/${label}-${id}.png`;await page.screenshot({path:file});result.captures.push(file);
    check(v.heroVisible,`${label}/${id}: the ordinary blink cycle renders the layout hero`);
    check(v.runs.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=v.w+.5&&r.y+r.h<=v.h+.5),`${label}/${id}: every native text run fits the canvas`);
    const overlaps=v.runs.flatMap((a,i)=>v.runs.slice(i+1).filter(b=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y).map(b=>[a.text,b.text]));
    check(!overlaps.length,`${label}/${id}: no text overlaps ${JSON.stringify(overlaps)}`);
    const all=v.runs.map(r=>r.text).join(' ').replace(/\s+/g,' ');
    check(all.includes(v.objective)&&all.includes(progress),`${label}/${id}: complete phase instruction and ${progress} remain readable`);
   };
   await capture('coils','Coils: 6/6');
   const tell=()=>page.evaluate(async()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-serpent');for(let n=0;n<600&&!b.ai.pendingLunge;n++)await h.tick();return{pending:b.ai.pendingLunge,cue:b.chargeCue.visible};});
   let v=await tell();check(v.pending&&v.cue,`${label}: a real committed charge displays its ground lane`);await capture('charge','Coils: 6/6');
   await page.evaluate(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-serpent');for(const e of b.segments.splice(0))e.remove();});await capture('head','Head: 24/24');
   await tell();await page.evaluate(()=>{const h=window.__voxelHeroes,b=h.entities.find(e=>e.type==='boss-serpent'),s=h.screen();for(const[x,z,face]of[[0,1.65,'north'],[0,-1.65,'south'],[1.65,0,'west'],[-1.65,0,'east']])if(!h.world.blocked(b.x+x,b.z+z,h.player.r,h.player)){h.game.hero.hero.place(b.x+x-s.x0,b.z+z-s.z0);h.game.hero.hero.setFacing(face);break;}});
   const cdp=await page.context().newCDPSession(page),button=await page.locator('#btn-a').boundingBox();assert.ok(button);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:button.x+button.width/2,y:button.y+button.height/2,id:1}]});await page.evaluate(()=>window.__voxelHeroes.step(.1));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   v=await page.evaluate(()=>{const b=window.__voxelHeroes.entities.find(e=>e.type==='boss-serpent');return{hp:b.hp,pending:b.ai.pendingLunge,cue:b.chargeCue.visible};});
   check(v.hp<24&&!v.pending&&!v.cue,`${label}: actual touch A damages the exposed head and cancels its charge`);await capture('interrupt',`Head: ${v.hp}/24`);await cdp.detach();assert.deepEqual(errors,[]);check(true,`${label}: no browser exceptions`);
  }finally{await page.close();}
 }
 result.ok=true;
}catch(e){result.ok=false;result.error={message:e.message,stack:e.stack};process.exitCode=1;console.error(e.stack);}
finally{await browser.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));console.log(`${result.ok?'PASS':'FAIL'} ${result.checks.length} muted Coilmaw touch checks and ${result.captures.length} captures.`);}
