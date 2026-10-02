import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {CHROMIUM_ARGS} from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const url=arg('url')??'http://127.0.0.1:5173/',out=arg('out')??'playtest-out/combat-talk-touch';mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],captures:[],scope:'Muted Chromium at 320x568 and 568x320, normal and large text. Real simultaneous Guard and A touch, then released Guard and A conversation. Teleport, starter equipment and stationary nearby hostile isolate controls; unrelated enemies removed. No direct damage or hero health edits.'};
const check=(v,label)=>{assert.ok(v,label);result.checks.push(label);};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
try {
 for(const[name,width,height]of[['phone',320,568],['landscape',568,320]])for(const large of[false,true]) {
  const label=`${name}-${large?'large':'normal'}`,page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true});
  try {
   const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   await page.goto(new URL('?manual=1&seed=17',url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.ui);
   await page.evaluate(async large=>{
    const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.settings.setSetting('largeText',large);
    h.give({grant:'blade-start',fanfare:false});h.give({grant:'shield-1',fanfare:false});h.teleport('forest:1,2',11.5,12.5);await h.step(2);
    for(const e of [...h.entities])if(e.kind==='enemy')e.remove();const s=h.screen(),n=h.entities.find(e=>e.name==='Forester Fen');h.game.hero.hero.place(n.x-s.x0-1.1,n.z-s.z0+.75);h.game.hero.hero.setFacing('east');window.__fenFoe=h.spawn('hopper',n.x-s.x0+.25,n.z-s.z0+.75,{spawnDelay:0,crowned:false});window.__fenFoe.think=()=>{};await h.step(.5);
   },large);
   const cdp=await page.context().newCDPSession(page),point=async(id,idx)=>{const b=await page.locator(id).boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2,id:idx};},guard=await point('#btn-guard',0),a=await point('#btn-a',1);
   const touches=async(type,touchPoints)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints});await page.evaluate(()=>window.__voxelHeroes.step(.1));};
   await touches('touchStart',[guard]);
   const before=await page.evaluate(()=>{const h=window.__voxelHeroes;return{hp:window.__fenFoe.hp,held:h.input.held('guard'),raised:h.player.guarding,prompt:h.game.prompts.currentPrompts().find(p=>p.action==='sword')?.label};});
   check(before.held&&before.raised&&before.prompt==='Sword',`${label}: physical held touch Guard raises the shield and shows Sword`);
   await touches('touchStart',[guard,a]);await touches('touchEnd',[guard]);
   check(await page.evaluate(hp=>{const h=window.__voxelHeroes;return h.state.mode==='play'&&window.__fenFoe.hp<hp;},before.hp),`${label}: simultaneous touch A strikes the hostile while keeping play active`);
   await page.evaluate(()=>{const h=window.__voxelHeroes;h.game.ui.requestUi();h.render();});const fight=`${out}/${label}-guarded-sword.png`;await page.screenshot({path:fight});result.captures.push(fight);
   await touches('touchEnd',[]);await page.evaluate(async()=>{window.__fenFoe.remove();await window.__voxelHeroes.step(.5);});
   await touches('touchStart',[a]);await touches('touchEnd',[]);
   check(await page.evaluate(()=>{const h=window.__voxelHeroes;return h.state.mode==='dialog'&&h.game.dialog.dialogView()?.speaker==='Forester Fen';}),`${label}: touch A after releasing Guard opens the intended named conversation`);
   await page.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('confirm');await h.step(.05);h.game.ui.requestUi();h.render();});const talk=`${out}/${label}-forester-talk.png`;await page.screenshot({path:talk});result.captures.push(talk);
   check(errors.length===0,`${label}: no browser errors`);
  } finally {await page.close();}
 }
 result.ok=true;
} catch(e) {result.ok=false;result.error={message:e.message,stack:e.stack};process.exitCode=1;console.error(e.stack);}
finally {await browser.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));console.log(`${result.ok?'PASS':'FAIL'} ${result.checks.length} real touch checks; ${result.captures.length} muted images.`);}
