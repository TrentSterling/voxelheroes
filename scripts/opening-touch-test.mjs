import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {CHROMIUM_ARGS} from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const url=arg('url')??'http://127.0.0.1:5173/',out=arg('out')??'playtest-out/opening-touch';mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],captures:[],scope:'Muted Chromium at 320x568 and 568x320, normal and large text. Actual touch A and guard. Teleport, quiet gear, damaged starting health and direct guard defeat isolate the spring and room-specific objective layout. No invulnerability. The native complete opening route and combat are measured separately.'};
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
try {
  for(const[name,width,height]of[['phone',320,568],['landscape',568,320]])for(const large of[false,true]){
    const label=`${name}-${large?'large':'normal'}`,page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true}),errors=[];
    try {
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
      await page.goto(new URL('?manual=1',url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.ui);
      await page.evaluate(large=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame();h.state.settings.largeText=large;const g=h.game.ui.g,text=g.text;window.__openingText=[];g.text=function(v,x,y,o={}){const w=g.measure(String(v),o.size??1,o.tracking??0);window.__openingText.push({text:String(v),x:o.align==='center'?Math.round(x-w/2):o.align==='right'?x-w:x,y,w,h:g.cap*(o.size??1)});return text.call(this,v,x,y,o);};},large);
      const cdp=await page.context().newCDPSession(page);
      const touch=async(id,held=.03)=>{const b=await page.locator(id).boundingBox();assert.ok(b,`${id} visible`);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});await page.evaluate(s=>window.__voxelHeroes.step(s),held);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
      const capture=async(id)=>{
        await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
        // Toast fades use wall time; manual simulation does not advance it.
        // Wait through the native 200 ms fade-in before drawing the receipt.
        await page.waitForTimeout(250);
        const v=await page.evaluate(()=>{const h=window.__voxelHeroes;window.__openingText=[];h.game.ui.requestUi();h.render();return{...h.game.ui.uiView(),runs:window.__openingText,toast:h.game.toast.toastView().text};});
        result.layouts??=[];result.layouts.push({label,id,...v});
        const file=`${out}/${label}-${id}.png`;await page.screenshot({path:file});result.captures.push(file);
        check(v.runs.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=v.w+.5&&r.y+r.h<=v.h+.5),`${label}/${id}: every native HUD text run fits the canvas`);
        const overlaps=v.runs.flatMap((a,i)=>v.runs.slice(i+1).filter(b=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y).map(b=>[a.text,b.text]));
        check(!overlaps.length,`${label}/${id}: HUD text does not overlap ${JSON.stringify(overlaps)}`);
        if(v.toast)check(v.runs.map(r=>r.text).join(' ').replace(/\s+/g,' ').includes(v.toast),`${label}/${id}: the complete spring feedback is readable`);
      };
      await page.evaluate(async()=>{const h=window.__voxelHeroes;h.teleport('ow-4-3:1,0',8,8);await h.step(.1);});await capture('unarmed-road');
      await page.evaluate(async()=>{const h=window.__voxelHeroes;h.give({grant:'blade-start',fanfare:false});h.give({grant:'shield-1',fanfare:false});h.game.state.setFlag('overworld:talked:king');h.teleport('v1:1,1',8,8);await h.step(.1);});await capture('find-wyll');
      await page.evaluate(async()=>{const h=window.__voxelHeroes;h.teleport('ow-3-2:1,2',4.5,10.4);h.game.hero.hero.setFacing('south');h.setHp(2);await h.step(.1);});
      // Let the arrival banner finish before interacting so the actual
      // spring feedback is visible when the receipt is drawn.
      await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
      await touch('#btn-a');check(await page.evaluate(()=>{const h=window.__voxelHeroes;return h.state.hp===2&&h.game.toast.toastView().text==='Clear barrow guards.';}),`${label}: actual touch A respects the remaining guards`);await capture('spring-guarded');
      await page.evaluate(async()=>{const h=window.__voxelHeroes;for(const e of h.entities)if(e.kind==='enemy'&&!e.removed)e.hurt({damage:999,knockback:0,source:'opening-touch-fixture'});await h.step(.2);});
      await touch('#btn-a');check(await page.evaluate(()=>window.__voxelHeroes.state.hp===window.__voxelHeroes.state.maxHp),`${label}: actual touch A drinks and restores hearts`);await capture('spring-restored');
      const b=await page.locator('#btn-guard').boundingBox();assert.ok(b);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});await page.evaluate(()=>window.__voxelHeroes.step(.1));
      check(await page.evaluate(()=>window.__voxelHeroes.player.guarding),`${label}: actual held touch guard raises the owned starter shield`);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.evaluate(()=>window.__voxelHeroes.step(.1));
      check(await page.evaluate(()=>!window.__voxelHeroes.player.guarding),`${label}: releasing touch guard lowers the shield`);
      assert.deepEqual(errors,[]);check(true,`${label}: no game exceptions`);await cdp.detach();
    }finally{await page.close();}
  }
  result.ok=true;
}catch(e){result.ok=false;result.error={message:e.message,stack:e.stack};process.exitCode=1;console.error(e.stack);}
finally{await browser.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));console.log(`${result.ok?'PASS':'FAIL'} ${result.checks.length} muted touch checks, ${result.captures.length} images.`);}
