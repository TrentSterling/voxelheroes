import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { CHROMIUM_ARGS } from './playtest.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/mara-layout';
const url=process.argv.find(a=>a.startsWith('--url='))?.slice(6)??'http://127.0.0.1:5173/';
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const fp=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});
const report={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],captures:[],fixtures:'Muted Chromium desktop, touch portrait and landscape, both text sizes. Positions and campaign flags are fixtures. Native sword-opened keeper conversations, every paragraph and recruitment choices use actual mouse/touch, Steamwheel uses actual keyboard/two-finger Guard+Item. All canvas text/panel and touch-control bounds measured; no playback.'};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
try {
 for(const [name,width,height,touch]of[['desktop',1280,720,false],['phone',320,568,true],['landscape',568,320,true]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const check=(pass,label)=>{assert.ok(pass,name+': '+label);report.checks.push(name+': '+label);console.log('PASS '+name+': '+label);};
  try {
   await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   await page.goto(new URL('?manual=1',url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.companions);
   await page.evaluate(()=>{
    const h=window.__voxelHeroes,g=h.game.ui.g,text=g.text,panel=g.panel,rect=g.rect;
    h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;
    window.__maraText={runs:[],panels:[],rects:[],parent:null};
    g.panel=function(x,y,w,height,o){const c=window.__maraText,p={x,y,w,h:height};c.panels.push(p);c.parent=h.state.mode==='dialog'&&!o?.accent?c.parent:p;return panel.call(this,x,y,w,height,o);};
    g.rect=function(x,y,w,height,...rest){window.__maraText.rects.push({x,y,w,h:height});return rect.call(this,x,y,w,height,...rest);};
    g.text=function(value,x,y,o={}){const c=window.__maraText,w=g.measure(String(value),o.size??1,o.tracking??0);c.runs.push({text:String(value),x:o.align==='center'?Math.round(x-w/2):o.align==='right'?x-w:x,y,w,h:g.cap*(o.size??1),parent:c.parent});return text.call(this,value,x,y,o);};
   });
   const capture=async(label,title)=>{
    const d=await page.evaluate(()=>{const h=window.__voxelHeroes,c=window.__maraText;c.runs=[];c.panels=[];c.rects=[];c.parent=null;h.game.ui.requestUi();h.player.hero.root.visible=true;h.render();const v=h.game.ui.uiView(),controls=[...document.querySelectorAll('#stick,#btn-a,#btn-b,#btn-guard,#btn-dash,.touch-pill')].filter(e=>getComputedStyle(e).visibility!=='hidden'&&e.getBoundingClientRect().width).map(e=>{const r=e.getBoundingClientRect();return{x:r.x/v.scale,y:r.y/v.scale,w:r.width/v.scale,h:r.height/v.scale};});return{...v,mode:h.state.mode,hud:h.game.hud.hudView(),prompts:h.game.promptHud.promptView(),controls,...c};});
    const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
    const bad=d.runs.filter(r=>r.x<0||r.y<0||r.x+r.w>d.w||r.y+r.h>d.h||(d.mode==='dialog'||/Steamwheel|Bell Shelter|Clockwork Cross|Needs [23] magic|Recharging|Hold.*MP/.test(r.text))&&r.parent&&!(r.x>=r.parent.x&&r.y>=r.parent.y&&r.x+r.w<=r.parent.x+r.parent.w&&r.y+r.h<=r.parent.y+r.parent.h)&&!d.rects.some(p=>r.x>=p.x&&r.y>=p.y&&r.x+r.w<=p.x+p.w&&r.y+r.h<=p.y+p.h));
    const badPanels=d.panels.filter(p=>p.x<0||p.y<0||p.x+p.w>d.w||p.y+p.h>d.h);
    const tech=d.runs.find(r=>r.text===title),collisions=tech?[...d.hud.widgets,...d.hits.filter(r=>['party-open','journal-open'].includes(r.id)),...d.prompts.map(p=>({...p,h:16})),...d.controls].filter(p=>overlap(tech.parent,p)):[];
    report.captures.push({label:name+'-'+label,w:d.w,h:d.h,violations:bad,panels:badPanels,collisions});writeFileSync(`${out}/${name}-${label}.json`,JSON.stringify(d,null,2));
    assert.deepEqual(bad,[],name+'/'+label+' text fits measured panel or speaker plate');assert.deepEqual(badPanels,[],name+'/'+label+' panel fits screen');assert.deepEqual(collisions,[],name+'/'+label+' technique clear of HUD and controls');if(title)assert.ok(tech,name+'/'+label+' actual technique label visible');
    await page.screenshot({path:`${out}/${name}-${label}.png`});return d;
   };
   const click=async id=>{const p=await page.evaluate(id=>{const h=window.__voxelHeroes;h.render();const v=h.game.ui.uiView(),r=v.hits.find(r=>r.id===id);return r?{x:(r.x+r.w/2)*v.scale,y:(r.y+r.h/2)*v.scale}:null;},id);assert.ok(p,'Actual canvas hit '+id);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.evaluate(()=>window.__voxelHeroes.tick());};
   for(const size of['normal','large'])for(const stage of['unlit','lit','memory']){
    await page.evaluate(async([size,stage])=>{const h=window.__voxelHeroes;h.state.settings.largeText=size==='large';h.game.companions.setMaraTravelling(false);h.game.state.clearFlag('coast:beacon-lit');h.game.state.clearFlag('coast:beacon-memory');if(stage!=='unlit')h.game.state.setFlag('coast:beacon-lit');if(stage==='memory')h.game.state.setFlag('coast:beacon-memory');h.teleport('tidecoast:0,1',5.5,10.5);await h.step(.3);for(const e of h.entities)if(e.kind==='enemy'||e.kind==='projectile')e.remove();h.game.hero.hero.setFacing('north');h.input.tap('sword');await h.tick();},[size,stage]);
    check(await page.evaluate(()=>window.__voxelHeroes.state.mode==='dialog'),size+' '+stage+' native Talk opens');
    check(await page.locator('#touch').evaluate(e=>getComputedStyle(e).display)==='none',size+' '+stage+' conversation hides touch pad');
    const expected=new Map(),seen=new Map();let count=0,choice=false;
    for(;count<140;count++){
     const initial=await page.evaluate(()=>window.__voxelHeroes.game.dialog.dialogView());if(!initial)break;if(!expected.has(initial.page)){expected.set(initial.page,initial.text);seen.set(initial.page,[]);}
     await click('dialog');const d=await page.evaluate(()=>window.__voxelHeroes.game.dialog.dialogView());assert.ok(d);seen.get(d.page).push(d.shown);await capture(`${size}-${stage}-${count}`);
     if(d.choices){check(JSON.stringify(d.choices)===JSON.stringify(['Travel with Mara','Keep the shore']),size+' '+stage+' both choices fit');await capture(`${size}-${stage}-choices`);await click('dialog-choice-0');choice=true;break;}
     await click('dialog');
    }
    check(count<140&&expected.size===4&&[...expected].every(([i,text])=>seen.get(i).join('')===text),size+' '+stage+' every authored paragraph survives all pointer pages');
    check(await page.evaluate(()=>window.__voxelHeroes.state.mode==='play'),size+' '+stage+' conversation returns to play');
    check(choice===(stage!=='unlit')&&await page.evaluate(()=>window.__voxelHeroes.game.companions.companionView().maraRecruited)===(stage!=='unlit'),size+' '+stage+' actual recruitment respects the beacon');
   }
   await page.evaluate(async()=>{const h=window.__voxelHeroes;h.state.settings.largeText=false;h.game.companions.setMiraTravelling(true);h.game.state.setFlag('era:voices-returned');h.game.companions.setTernTravelling(true);h.game.grants.grant('copper-memory',1,{fanfare:false});h.game.inventory.giveItem('fire-wand');h.game.inventory.selectItem('fire-wand');h.state.maxMagic=h.state.magic=9;h.teleport('v1:1,1',8.5,9.5);await h.step(.5);h.player.lockT=h.player.knockT=h.player.stallT=0;});
   await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible&&!window.__voxelHeroes.game.toast.toastView().visible);await capture('steam-ready','Steamwheel');
   if(touch){
    const guard=await page.locator('#btn-guard').boundingBox(),item=await page.locator('#btn-b').boundingBox(),cdp=await page.context().newCDPSession(page);
    const a={id:1,x:guard.x+guard.width/2,y:guard.y+guard.height/2},b={id:2,x:item.x+item.width/2,y:item.y+item.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});await page.evaluate(()=>window.__voxelHeroes.step(.02));await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a,b]});await page.evaluate(()=>window.__voxelHeroes.step(.02));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[a]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
   }else{await page.keyboard.down('Shift');await page.evaluate(()=>window.__voxelHeroes.step(.02));await page.keyboard.down('k');await page.evaluate(()=>window.__voxelHeroes.step(.02));await page.keyboard.up('k');await page.keyboard.up('Shift');}
   check(await page.evaluate(()=>{const h=window.__voxelHeroes;return h.state.magic===6&&h.game.companions.companionView().steamCount===1;}),'actual '+(touch?'two-finger touch':'keyboard')+' Guard + Item casts once for three magic');await page.evaluate(()=>window.__voxelHeroes.step(.14));await capture('steam-cast',touch&&height<400?'Steamwheel!':'Steamwheel');
   await page.waitForFunction(()=>!window.__voxelHeroes.game.toast.toastView().visible);await capture('steam-recharge','Steamwheel');
   await page.evaluate(()=>{const h=window.__voxelHeroes;h.state.companionRuntime.steamCooldown=0;h.state.magic=2;});const empty=await capture('steam-empty','Steamwheel');check(empty.runs.some(r=>r.text==='Needs 3 magic'),'the three-gem cost stays readable');
   await page.keyboard.down('Shift');await page.evaluate(()=>window.__voxelHeroes.step(.02));await page.keyboard.down('j');await page.evaluate(()=>window.__voxelHeroes.step(.02));await page.keyboard.up('j');await page.keyboard.up('Shift');await page.evaluate(()=>window.__voxelHeroes.step(.1));
   check(await page.evaluate(()=>window.__voxelHeroes.game.companions.companionView().shelterCount)===1,'Guard + Sword still casts Tern shelter with all three followers');await page.waitForFunction(()=>!window.__voxelHeroes.game.toast.toastView().visible);await capture('tern-shelter','Bell Shelter');
   await page.evaluate(async()=>{const h=window.__voxelHeroes;await h.step(3.2);h.game.inventory.giveItem('grapple');h.game.inventory.selectItem('grapple');h.state.magic=4;});const cross=await capture('mira-cross',touch&&height<400?undefined:'Clockwork Cross');
   check(touch&&height<400?cross.prompts.some(p=>p.id==='item')&&!cross.runs.some(r=>r.text==='Clockwork Cross'):cross.runs.some(r=>r.text==='Clockwork Cross'),'switching away from fire restores ordinary item priority in compact landscape and Mira help elsewhere');
   check(errors.length===0,'no browser errors');
  }finally{await page.close();}
 }
 report.ok=true;
}catch(error){report.ok=false;report.error={message:error.message,stack:error.stack};console.error(error.stack);process.exitCode=1;}
finally{report.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(report,null,2));await browser.close();}
