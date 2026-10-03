import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { chromium, firefox } from 'playwright';
import { CHROMIUM_ARGS } from './playtest.mjs';
import { installSilentOutput } from './lib/silent-output.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const url=arg('url')??'http://127.0.0.1:5173/',out=arg('out')??'playtest-out/equipment-layout';
assert.ok(!existsSync(`${out}/result.json`),'Choose a fresh output folder.');mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const fingerprint=()=>{const h=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){h.update(f.replaceAll('\\','/')+'\0');h.update(readFileSync(f));}return h.digest('hex');};
const result={startedUtc:new Date().toISOString(),sourceSha256:fingerprint(),checks:[],captures:[],layouts:[],scope:'Owned-blade and passive-gear fixtures in 4 viewport profiles, normal/large text and both engines. Actual touch Menu, row and Equip controls; desktop keyboard entry and mouse selection. Text, control bounds, row overlap, empty inventory and close input are measured. Speaker output disconnected before navigation. This does not claim native campaign completion.'};
const check=(ok,label,detail)=>{result.checks.push({ok:!!ok,label,...(detail?{detail}:{})});assert.ok(ok,`${label}: ${JSON.stringify(detail??'')}`);};
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
try{
  for(const engine of ['firefox','chromium']){
    const browser=await ({chromium,firefox}[engine]).launch({headless:true,...(engine==='chromium'?{args:CHROMIUM_ARGS}:{firefoxUserPrefs:{'media.volume_scale':'0.0'}})});
    try{
      for(const [profile,width,height,touch]of[['phone',320,568,true],['landscape',568,320,true],['wide',840,360,true],['desktop',1280,720,false]]){
        const context=await browser.newContext({viewport:{width,height},hasTouch:touch});await installSilentOutput(context);
        const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
        try{
          await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
          await page.goto(new URL('?manual=1&seed=17',url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.equipment);
          assert.equal(await page.evaluate(()=>window.__testAudioOutputGuard?.version),1);
          await page.evaluate(()=>{const g=window.__voxelHeroes.game.ui.g,text=g.text;window.__equipmentText=[];g.text=function(value,x,y,o={}){const w=g.measure(String(value),o.size??1,o.tracking??0);window.__equipmentText.push({text:String(value),x:o.align==='center'?Math.round(x-w/2):o.align==='right'?x-w:x,y,w,h:g.cap*(o.size??1)});return text.call(this,value,x,y,o);};});
          for(const large of[false,true])for(const count of[0,1,3]){
            const label=`${engine}-${profile}-${large?'large':'normal'}-${count}-blades`;
            await page.evaluate(async({large,count})=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.settings.setSetting('muted',true);h.game.settings.setSetting('npcVoices',false);h.game.settings.setSetting('largeText',large);h.state.gear.shield=3;h.state.gear.boots='boots-swamp';h.state.gear.ring='ring-half';if(!count){h.state.swords.owned=[];h.state.swords.equipped=null;}if(count===3){h.game.swords.giveSword('blade-warden');h.game.swords.giveSword('blade-dawn');}await h.step(1.5);h.render();},{large,count});
            if(touch)await page.locator('#btn-inv').tap();else await page.keyboard.press('Tab');
            await page.evaluate(()=>window.__voxelHeroes.tick());
            check(await page.evaluate(()=>window.__voxelHeroes.state.mode==='inventory'),`${label}: actual ${touch?'touch Menu':'Tab'} opens equipment`);
            const data=await page.evaluate(()=>{const h=window.__voxelHeroes;window.__equipmentText=[];h.game.ui.requestUi();h.render();return{...h.game.ui.uiView(),runs:window.__equipmentText,view:h.game.equipment.equipmentView()};});
            const controls=data.hits.filter(r=>r.id.startsWith('equipment-')&&!['equipment-panel','equipment-scrim'].includes(r.id));
            const escapes=data.runs.filter(r=>r.x<0||r.y<0||r.x+r.w>data.w||r.y+r.h>data.h),collisions=controls.flatMap((a,i)=>controls.slice(i+1).filter(b=>overlaps(a,b)).map(b=>[a.id,b.id]));
            result.layouts.push({label,...data,escapes,collisions});
            check(!escapes.length,`${label}: every text run fits the canvas`,escapes);
            check(controls.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=data.w&&r.y+r.h<=data.h),`${label}: every equipment control fits the view`,controls);
            check(!collisions.length,`${label}: blade rows and footer controls do not overlap`,collisions);
            check(data.view.owned.length===count&&controls.filter(r=>r.id.startsWith('equipment-blade-')).length===count,`${label}: owned blades remain reachable and unearned blades stay hidden`);
            check(controls.some(r=>r.id==='equipment-equip')===!!count,`${label}: the empty screen has no inactive Equip control`);
            const click=async id=>{const hit=data.hits.find(r=>r.id===id);assert.ok(hit);const x=(hit.x+hit.w/2)*data.scale,y=(hit.y+hit.h/2)*data.scale;if(touch)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);await page.evaluate(()=>window.__voxelHeroes.tick());};
            if(count===3){await click('equipment-blade-blade-warden');await click('equipment-equip');check(await page.evaluate(()=>window.__voxelHeroes.game.swords.equippedId()==='blade-warden'),`${label}: actual ${touch?'touch':'mouse'} row selection and Equip choose Warden`);}
            await page.evaluate(()=>window.__voxelHeroes.render());const file=`${out}/${label}.png`;await page.screenshot({path:file});result.captures.push(file);
            await click('equipment-close');check(await page.evaluate(()=>window.__voxelHeroes.state.mode==='play'),`${label}: actual Back returns to play`);
          }
          check(!errors.length,`${engine}-${profile}: no page errors`,errors);
        }finally{await context.close();}
      }
    }finally{await browser.close();}
  }
  result.sourceUnchanged=result.sourceSha256===fingerprint();assert.ok(result.sourceUnchanged);result.ok=true;
  console.log(`PASS ${result.checks.length} equipment layout/input checks, ${result.captures.length} silent images.`);
}catch(e){result.ok=false;result.error={message:e.message,stack:e.stack};console.error(e.stack);process.exitCode=1;}
finally{result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));}
