import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { CHROMIUM_ARGS } from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/clock-layout',url=arg('url')??'http://127.0.0.1:5173/';
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],captures:[],fixtures:'Muted headless Chromium. Desktop, 320px touch portrait and 568x320 touch landscape; normal and large text. Initial gear, campaign flags, position, removed dialogue enemies and a frozen harmless HUD keeper are fixtures. Every authored anchor/clock paragraph, journal state, Track/Close and play HUD are measured with native mouse/touch paging. No voice or game audio playback.'};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
try{
 for(const[name,width,height,touch]of[['desktop',1280,720,false],['phone',320,568,true],['landscape',568,320,true]].filter(v=>!arg('viewports')||arg('viewports').split(',').includes(v[0]))){
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const check=(ok,label)=>{assert.ok(ok,`${name}: ${label}`);result.checks.push(`${name}: ${label}`);console.log(`PASS ${name}: ${label}`);};
  try{
   await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   await page.goto(new URL('?manual=1',url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.journal);
   await page.evaluate(()=>{
    const h=window.__voxelHeroes,g=h.game.ui.g,text=g.text,panel=g.panel,rect=g.rect;
    h.game.progress.startNewGame({prologue:false});h.state.settings.muted=true;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;
    window.__clockText={runs:[],panels:[],rects:[],parent:null};
    g.panel=function(x,y,w,height,o){const c=window.__clockText,p={x,y,w,h:height};c.panels.push(p);if(o?.accent)c.parent=p;return panel.call(this,x,y,w,height,o);};
    g.rect=function(x,y,w,height,...rest){window.__clockText.rects.push({x,y,w,h:height});return rect.call(this,x,y,w,height,...rest);};
    g.text=function(value,x,y,o={}){const c=window.__clockText,w=g.measure(String(value),o.size??1,o.tracking??0);c.runs.push({text:String(value),x:o.align==='center'?Math.round(x-w/2):o.align==='right'?x-w:x,y,w,h:g.cap*(o.size??1),parent:c.parent});return text.call(this,value,x,y,o);};
   });
   const click=async id=>{const p=await page.evaluate(id=>{const h=window.__voxelHeroes;h.render();const v=h.game.ui.uiView(),r=v.hits.find(r=>r.id===id);return r?{x:(r.x+r.w/2)*v.scale,y:(r.y+r.h/2)*v.scale}:null;},id);assert.ok(p,`${name}: native ${id} target exists`);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.evaluate(()=>window.__voxelHeroes.tick());};
   const capture=async label=>{
    const d=await page.evaluate(()=>{const h=window.__voxelHeroes,c=window.__clockText;c.runs=[];c.panels=[];c.rects=[];c.parent=null;h.game.ui.requestUi();h.player.hero.root.visible=true;h.render();return{...h.game.ui.uiView(),mode:h.state.mode,hud:h.game.hud.hudView(),banner:h.game.banner.bannerView(),touchDisplay:getComputedStyle(document.getElementById('touch')).display,...c};});
    const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
    const fits=(r,p)=>r.x>=p.x&&r.y>=p.y&&r.x+r.w<=p.x+p.w&&r.y+r.h<=p.y+p.h;
    const bad=d.runs.filter(r=>r.x<0||r.y<0||r.x+r.w>d.w||r.y+r.h>d.h||r.parent&&!fits(r,r.parent)&&!d.rects.some(p=>p.w<d.w&&p.h<d.h&&fits(r,p)));
    const panels=d.panels.filter(p=>p.x<0||p.y<0||p.x+p.w>d.w||p.y+p.h>d.h),collisions=[];
    if(d.mode==='journal'){
     const controls=d.hits.filter(r=>r.id.startsWith('journal-')&&!['journal-panel','journal-scrim'].includes(r.id));
     for(let i=0;i<controls.length;i++)for(const b of controls.slice(i+1))if(overlap(controls[i],b))collisions.push([controls[i].id,b.id]);
     const text=d.runs.filter(r=>r.parent);for(let i=0;i<text.length;i++)for(const b of text.slice(i+1))if(overlap(text[i],b))collisions.push([text[i].text,b.text]);
     for(const r of text.filter(r=>r.text.startsWith('Reward:')))for(const c of controls)if(overlap(r,c))collisions.push([r.text,c.id]);
    }
    if(['journal','dialog'].includes(d.mode))assert.equal(d.touchDisplay,'none',`${name}/${label}: touch pad hidden`);
    result.captures.push({label:name+'-'+label,w:d.w,h:d.h,violations:bad,panels,collisions});writeFileSync(`${out}/${name}-${label}.json`,JSON.stringify(d,null,2));
    assert.deepEqual(bad,[],`${name}/${label}: text fits`);assert.deepEqual(panels,[],`${name}/${label}: panels fit`);assert.deepEqual(collisions,[],`${name}/${label}: controls and text clear`);
    await page.screenshot({path:`${out}/${name}-${label}.png`});return d;
   };
   const campaign=()=>{const h=window.__voxelHeroes;for(let n=1;n<=4;n++){h.game.state.setFlag('orb:'+n);h.game.state.setFlag('boss:d'+n);h.game.state.setFlag('dungeon:d'+n+':complete');h.game.state.setFlag('dungeon:d'+n+':entered');h.game.dungeons.giveBossKey('d'+n);}h.game.state.setFlag('overworld:talked:king');};
   // Serialize the campaign setup once; every per-state fixture below is explicit.
   await page.evaluate(campaign);
   const reset=async(size,count=0)=>page.evaluate(async([size,count])=>{const h=window.__voxelHeroes;h.state.settings.largeText=size==='large';h.game.state.clearFlag('tower:trial');h.game.state.clearFlag('boss:tower-trial');for(const id of['return','break','draw','kindle'])h.game.state.clearFlag('tower:clock:'+id);for(const id of['return','break','draw','kindle'].slice(0,count))h.game.state.setFlag('tower:clock:'+id);h.game.objective.trackQuest(null);h.state.mode='play';h.teleport('tower-trial:0,0',11,13.5);await h.step(.2);},[size,count]);
   for(const size of['normal','large']){
    for(const[stage,x,z]of[['return',4.5,8.6],['break',17.5,8.6],['draw',7.5,12.6],['kindle',14.5,12.6],['clock',10.5,8.6]]){
     await reset(size);await page.evaluate(async([x,z])=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.kind==='enemy'||e.kind==='projectile')e.remove();h.game.hero.hero.place(x,z);h.game.hero.hero.setFacing('north');h.player.lockT=h.player.knockT=h.player.stallT=0;h.input.tap('sword');await h.tick();},[x,z]);
     check(await page.evaluate(()=>window.__voxelHeroes.state.mode==='dialog'),`${size} ${stage}: actual Read opens`);
     const expected=new Map(),seen=new Map();let count=0;
     for(;count<100;count++){
      const initial=await page.evaluate(()=>window.__voxelHeroes.game.dialog.dialogView());if(!initial)break;
      if(!expected.has(initial.page)){expected.set(initial.page,initial.text);seen.set(initial.page,[]);}
      await click('dialog');const d=await page.evaluate(()=>window.__voxelHeroes.game.dialog.dialogView());assert.ok(d);seen.get(d.page).push(d.shown);await capture(`${size}-${stage}-${count}`);await click('dialog');
     }
     check(count<100&&expected.size===2&&[...expected].every(([i,text])=>seen.get(i).join('')===text),`${size} ${stage}: both authored paragraphs survive actual ${touch?'touch':'mouse'} paging`);
     check(await page.evaluate(()=>window.__voxelHeroes.state.mode==='play'),`${size} ${stage}: Read closes to play`);
    }
    for(const[stage,status,count]of[['offer','offer',0],['active','active',0],['partial','active',2],['last','active',3],['done','done',4]]){
     await reset(size,count);await page.evaluate(stage=>{const h=window.__voxelHeroes;h.game.state.clearFlag('dungeon:tower-trial:entered');if(stage!=='offer')h.game.state.setFlag('dungeon:tower-trial:entered');if(stage==='done'){h.game.state.setFlag('tower:trial');h.game.state.setFlag('boss:tower-trial');}h.game.journal.openJournal('fourfold-clock');h.render();},stage);
     const j=await page.evaluate(()=>window.__voxelHeroes.game.journal.journalView()),entry=j.entries[j.selected];check(entry.status===status,`${size}: journal ${stage} status`);let paragraph='';
     for(let p=0;p<j.detailPages;p++){await capture(`${size}-journal-${stage}-${p}`);paragraph+=' '+(await page.evaluate(()=>window.__voxelHeroes.game.journal.journalView())).shownDetail;if(j.detailPages>1)await click('journal-detail-next');}
     result.journalPages??=[];result.journalPages.push({name,size,stage,expected:entry.detail,shown:paragraph,pages:j.detailPages});
     check(paragraph.trim().replace(/\s+/g,' ')===entry.detail.replace(/\s+/g,' '),`${size}: journal ${stage} detail complete`);
     if(stage!=='done'){await click('journal-track');check(await page.evaluate(()=>window.__voxelHeroes.game.objective.trackedQuestId())==='fourfold-clock',`${size}: journal ${stage} Track input`);}else check(!await page.evaluate(()=>window.__voxelHeroes.game.ui.uiView().hits.some(r=>r.id==='journal-track')),`${size}: done has no Track action`);
     await click('journal-close');check(await page.evaluate(()=>window.__voxelHeroes.state.mode)==='play',`${size}: journal ${stage} Close input`);
    }
    for(let count=0;count<4;count++){
     await reset(size,count);await page.evaluate(()=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.kind==='projectile'||e.type==='crown-wisp')e.remove();const b=h.entities.find(e=>e.type==='boss-bishop');if(b){b.think=()=>{};b.harmless=true;b.ai.phase='hold';b.present();}for(const e of h.entities)if(e.type==='bishop-copy')e.harmless=true;h.game.objective.trackQuest('fourfold-clock');});await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
     const d=await capture(`${size}-play-${count}`);check(!d.runs.some(r=>r.text.includes('Endure')),`${size}: HUD has no obsolete countdown at ${count}/4`);
     if(name==='desktop')check(d.runs.some(r=>r.text===`Anchors: ${count}/4`),`${size}: HUD reports ${count}/4 anchors`);
     check(await page.evaluate(count=>window.__voxelHeroes.game.objective.objectiveHudText().includes(`Clock ${count}/4`),count),`${size}: compact goal advances to ${count}/4`);
    }
   }
   assert.deepEqual(errors,[]);check(true,'No page errors');
  }finally{await page.close();}
 }
 result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{await browser.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));}
