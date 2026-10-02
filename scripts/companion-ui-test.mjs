import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { CHROMIUM_ARGS } from './playtest.mjs';
import { inventory } from './voice-inventory.mjs';
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'playtest-out/companion-ui';
const url = process.argv.find(a => a.startsWith('--url='))?.slice(6) ?? 'http://127.0.0.1:5173/';
const tern = process.argv.includes('--tern'), title = tern ? 'Bell Shelter' : 'Clockwork Cross';
const ternLines=tern?inventory().lines.filter(r=>r.speaker==='Tern'&&r.sources.some(s=>s.startsWith('src/game/companions.js:'))).map(r=>r.text):[];
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const fingerprint=createHash('sha256');for(const file of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fingerprint.update(file.replaceAll('\\','/')+'\0');fingerprint.update(readFileSync(file));}
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
const result = { at: new Date().toISOString(), sourceSha256:fingerprint.digest('hex'), checks: [], fixture: 'Recruitment and archive grant set through game APIs; actual canvas text metrics and real coarse-pointer browser contexts. Tern casts through real keyboard or simultaneous two-finger touch input. Audio master muted, NPC voices disabled; no playback checks.' };
try {
  for (const [name, width, height, touch] of [['desktop',1280,720,false],['phone',320,568,true],['landscape',568,320,true]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', r => ['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
    await page.goto(new URL('?manual=1', url).href); await page.waitForFunction(() => window.__voxelHeroes?.game?.companions);
    await page.evaluate(async tern => {
      const h = window.__voxelHeroes; h.game.audio.setMuted(true); h.game.audio.setVolumes({master:0}); h.game.settings.setSetting('npcVoices',false);
      h.game.progress.startNewGame({prologue:false}); h.game.companions.setMiraTravelling(true); h.game.grants.grant('copper-memory',1,{fanfare:false}); await h.step(4.5);
      if(tern){h.game.state.setFlag('era:voices-returned');h.game.companions.setTernTravelling(true);await h.step(.2);}
      h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);
      const g=h.game.ui.g, panel=g.panel, text=g.text, rect=g.rect;
      window.__companionDraw={runs:[],all:[],rects:[],parent:null};
      g.rect=function(x,y,w,h,...args){window.__companionDraw.rects.push({x,y,w,h});return rect.call(this,x,y,w,h,...args);};
      g.panel=function(x,y,w,height,...args){window.__companionDraw.parent=h.state.mode==='dialog'&&!args[0]?.accent?null:{x,y,w,h:height};return panel.call(this,x,y,w,height,...args);};
      g.text=function(value,x,y,opts={}){const str=String(value),w=g.measure(str,opts.size??1,opts.tracking??0),left=opts.align==='center'?Math.round(x-w/2):opts.align==='right'?x-w:x;const run={text:str,x:left,y,w,h:g.cap*(opts.size??1),parent:window.__companionDraw.parent};window.__companionDraw.all.push(run);if(/Clockwork Cross|Bell Shelter|Sheltered \d+s|Hold .*release|Hold .*MP|Charge .*MP|Needs 2 magic|Recharging|Release for Cross/.test(str))window.__companionDraw.runs.push(run);return text.call(this,value,x,y,opts);};
    },tern);
    if(tern){await page.keyboard.down('Shift');await page.evaluate(()=>window.__voxelHeroes.step(.02));}
    const capture = async (state, visible = true, toastOnly = false) => {
      const bounds = await page.evaluate(() => {
        const h=window.__voxelHeroes,c=window.__companionDraw;c.runs=[];c.all=[];c.parent=null;h.game.ui.requestUi();h.render();
        return {view:h.game.ui.uiView(),hud:h.game.hud.hudView(),prompts:h.game.promptHud.promptView(),banner:h.game.banner.bannerView(),runs:c.runs,coarse:matchMedia('(pointer: coarse)').matches};
      });
      await page.screenshot({path:`${out}/${name}-${state}.png`});result.checks.push({name,state,...bounds});
      assert.equal(bounds.coarse,touch);
      if (!visible && !toastOnly) { assert.deepEqual(bounds.runs,[],`${name}/${state}: contextual UI takes priority over technique help`); return bounds; }
      const plateTitle=toastOnly?title+'!':title;
      assert.ok(bounds.runs.some(r=>r.text===plateTitle));
      if(toastOnly)assert.ok(!bounds.runs.some(r=>r.text===title),'Short touch feedback replaces the technique plate');
      for(const r of bounds.runs){assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=bounds.view.w&&r.y+r.h<=bounds.view.h,`${name}/${state}: text within screen`);assert.ok(r.x>=r.parent.x&&r.y>=r.parent.y&&r.x+r.w<=r.parent.x+r.parent.w&&r.y+r.h<=r.parent.y+r.parent.h,`${name}/${state}: text within panel`);}
      const panel=bounds.runs.find(r=>r.text===plateTitle).parent;
      const obstacles=[...bounds.hud.widgets,...bounds.view.hits.filter(h=>['party-open','journal-open'].includes(h.id)),...bounds.prompts.map(p=>({...p,h:16})),...bounds.banner.layout];
      const overlap=obstacles.filter(w=>panel.x<w.x+w.w&&panel.x+panel.w>w.x&&panel.y<w.y+w.h&&panel.y+panel.h>w.y);
      assert.deepEqual(overlap,[],`${name}/${state}: companion panel clear of HUD widgets`);
      if(touch){const buttons=await page.locator('#stick, #btn-a, #btn-b, #btn-guard, #btn-dash, .touch-pill').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));const scale=bounds.view.scale;for(const b of buttons)assert.ok(!(panel.x*scale<b.x+b.w&&(panel.x+panel.w)*scale>b.x&&panel.y*scale<b.y+b.h&&(panel.y+panel.h)*scale>b.y),`${name}/${state}: technique panel clear of touch controls ${JSON.stringify({panel,scale,button:b})}`);}
    };
    if(touch) { await page.locator('#btn-guard').tap(); await page.evaluate(async()=>{await window.__voxelHeroes.step(.1);}); }
    if(touch&&height<400) {
      await page.evaluate(()=>window.__voxelHeroes.game.banner.showBanner('Mossbrook'));
      const arrival=await capture('arrival',false);assert.ok(arrival.banner.visible);
    }
    // Arrival banners and toasts use wall time, independently of simulation.
    await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible&&!window.__voxelHeroes.game.toast.toastView().visible);
    await capture('ready');
    if(tern){
      if(touch){
        await page.keyboard.up('Shift');
        const guard=await page.locator('#btn-guard').boundingBox(),sword=await page.locator('#btn-a').boundingBox(),cdp=await page.context().newCDPSession(page);
        const a={id:1,x:guard.x+guard.width/2,y:guard.y+guard.height/2},b={id:2,x:sword.x+sword.width/2,y:sword.y+sword.height/2};
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});await page.evaluate(()=>window.__voxelHeroes.step(.02));
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a,b]});await page.evaluate(()=>window.__voxelHeroes.step(.02));
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[a]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
      }else{await page.keyboard.down('j');await page.evaluate(()=>window.__voxelHeroes.step(.02));await page.keyboard.up('j');await page.keyboard.up('Shift');}
      await page.evaluate(()=>window.__voxelHeroes.step(.1));
      assert.equal(await page.evaluate(()=>window.__voxelHeroes.game.companions.companionView().shelterCount),1,'Actual guard and sword input casts one shelter');
      await capture('sheltered',!(touch&&height<400),touch&&height<400);
      await page.waitForFunction(()=>!window.__voxelHeroes.game.toast.toastView().visible);await capture('shelter-status');
      await page.evaluate(()=>window.__voxelHeroes.step(3.1));await page.keyboard.down('Shift');await page.evaluate(()=>window.__voxelHeroes.step(.02));
    }
    await page.evaluate(()=>{window.__voxelHeroes.state.magic=0;});await capture('empty');
    await page.evaluate(tern=>{if(tern)window.__voxelHeroes.state.companionRuntime.shelterCooldown=3;else window.__voxelHeroes.state.companionRuntime.cooldown=3;},tern);await capture('cooldown');
    if(touch&&height<400) {
      await page.evaluate(()=>window.__voxelHeroes.game.grants.grant('bombs',1,{fanfare:false}));
      const item=await capture('item-prompt',false);assert.ok(item.prompts.some(p=>p.id==='item'),'item use remains visible');
    }
    if(tern){
      await page.keyboard.up('Shift');
      await page.evaluate(()=>{const h=window.__voxelHeroes;h.state.settings.largeText=true;h.game.companions.talkToTern();});
      assert.equal(await page.locator('#touch').evaluate(e=>getComputedStyle(e).display),'none','Dialogue hides the gameplay pad');
      const paragraphs=[];let segments=0,closed=false;
      for(let i=0;i<60;i++){
        await page.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('confirm');await h.tick();});
        const d=await page.evaluate(()=>window.__voxelHeroes.game.dialog.dialogView());assert.ok(d);
        paragraphs[d.page]=(paragraphs[d.page]??'')+d.shown;segments++;
        const bounds=await page.evaluate(()=>{const h=window.__voxelHeroes,c=window.__companionDraw;c.runs=[];c.all=[];c.rects=[];c.parent=null;h.game.ui.requestUi();h.render();return{view:h.game.ui.uiView(),runs:c.all,rects:c.rects};});
        writeFileSync(`${out}/${name}-tern-dialog-${segments}.json`,JSON.stringify(bounds,null,2));await page.screenshot({path:`${out}/${name}-tern-dialog-${segments}.png`});
        for(const r of bounds.runs){assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=bounds.view.w&&r.y+r.h<=bounds.view.h,`${name}: actual Tern dialog text stays in bounds: ${JSON.stringify(r)}`);if(r.parent){const plate=r.text==='TERN'&&r.y<r.parent.y&&bounds.rects.some(p=>r.x>=p.x&&r.y>=p.y&&r.x+r.w<=p.x+p.w&&r.y+r.h<=p.y+p.h);assert.ok(plate||(r.x>=r.parent.x&&r.y>=r.parent.y&&r.x+r.w<=r.parent.x+r.parent.w&&r.y+r.h<=r.parent.y+r.parent.h),`${name}: Tern dialog text stays inside its panel or measured speaker plate: ${JSON.stringify(r)}`);}}
        if(d.choices){await page.screenshot({path:`${out}/${name}-tern-choices.png`});const hit=await page.evaluate(()=>{const h=window.__voxelHeroes,v=h.game.ui.uiView(),r=v.hits.find(r=>r.id==='dialog-choice-1');return{x:(r.x+r.w/2)*v.scale,y:(r.y+r.h/2)*v.scale};});if(touch)await page.touchscreen.tap(hit.x,hit.y);else await page.mouse.click(hit.x,hit.y);await page.evaluate(()=>window.__voxelHeroes.step(.02));closed=true;break;}
        await page.evaluate(async()=>{const h=window.__voxelHeroes;h.input.tap('confirm');await h.tick();});
      }
      assert.equal(closed,true,'All Tern paragraphs and choices are reachable');
      assert.deepEqual(paragraphs.map(s=>s.replace(/\s/g,'')).sort(),ternLines.map(s=>s.replace(/\s/g,'')).sort(),'Actual large-text pages preserve all three authored and voiced paragraphs');
      assert.equal(await page.evaluate(()=>window.__voxelHeroes.state.mode),'play');
      assert.equal(await page.evaluate(()=>window.__voxelHeroes.game.companions.companionView().ternRecruited),false,'Actual Tend the garden choice dismisses Tern');
      result.checks.push({name,state:'actual-tern-dialog',paragraphs:paragraphs.length,segments,allCharacters:true,largeText:true,padHidden:true,actualPointerChoice:true,choicesClose:true});
    }
    assert.deepEqual(errors,[]);await page.close();
  }
  result.ok=true;console.log(`PASS ${title} UI: desktop and real touch portrait/landscape; text bounds, HUD/prompt separation, technique states and arrival/item priority; no playback.`);
} catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));await browser.close();}
