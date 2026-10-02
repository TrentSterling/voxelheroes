import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { CHROMIUM_ARGS } from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/departure-layout',url=arg('url')??'http://127.0.0.1:5173/';
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],captures:[],fixtures:'Muted headless Chromium. Desktop, 320px touch portrait and 568x320 touch landscape; normal and large text. Position, campaign flags and removal of enemies are fixtures. Actual sword-opened conversations, every authored paragraph, consent choices, journal pages, Track/Close and reward captions use native mouse/touch inputs. No voice or game audio playback.'};
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
    h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.player.invT=999;
    window.__departureText={runs:[],panels:[],rects:[],parent:null};
    g.panel=function(x,y,w,height,o){const c=window.__departureText,p={x,y,w,h:height};c.panels.push(p);if(o?.accent)c.parent=p;return panel.call(this,x,y,w,height,o);};
    g.rect=function(x,y,w,height,...rest){window.__departureText.rects.push({x,y,w,h:height});return rect.call(this,x,y,w,height,...rest);};
    g.text=function(value,x,y,o={}){const c=window.__departureText,w=g.measure(String(value),o.size??1,o.tracking??0);c.runs.push({text:String(value),x:o.align==='center'?Math.round(x-w/2):o.align==='right'?x-w:x,y,w,h:g.cap*(o.size??1),parent:c.parent});return text.call(this,value,x,y,o);};
   });
   const click=async id=>{const p=await page.evaluate(id=>{const h=window.__voxelHeroes;h.render();const v=h.game.ui.uiView(),r=v.hits.find(r=>r.id===id);return r?{x:(r.x+r.w/2)*v.scale,y:(r.y+r.h/2)*v.scale}:null;},id);assert.ok(p,`${name}: native ${id} target exists`);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.evaluate(()=>window.__voxelHeroes.tick());};
   const capture=async label=>{
    const d=await page.evaluate(()=>{const h=window.__voxelHeroes,c=window.__departureText;c.runs=[];c.panels=[];c.rects=[];c.parent=null;h.game.ui.requestUi();h.player.hero.root.visible=true;h.render();return{...h.game.ui.uiView(),mode:h.state.mode,hud:h.game.hud.hudView(),banner:h.game.banner.bannerView(),touchDisplay:getComputedStyle(document.getElementById('touch')).display,...c};});
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
   const setup=async(size,stage)=>page.evaluate(async([size,stage])=>{
    const h=window.__voxelHeroes;h.state.settings.largeText=size==='large';for(const id of['era:departure','era:departure-powered','era:departure-tag','era:departure-home','era:departure-claimed','era:tern-travels'])h.game.state.clearFlag(id);
    h.game.state.setFlag('era:water-restored');h.game.state.setFlag('era:archive-powered');h.state.maxMagic=h.state.magic=10;
    if(['past-after','future-consent','future-done'].includes(stage))h.game.state.setFlag('era:departure-powered');
    if(stage==='future-consent')h.game.state.setFlag('era:departure-tag');if(stage==='future-done')h.game.state.setFlag('era:departure-home');
    const past=stage.startsWith('past'),x=stage==='past-signal'?6.5:past?4.5:3.5;
    h.teleport(past?'mossbrook-past:1,1':'mossbrook-future:1,1',x,5.6);await h.step(.5);for(const e of [...h.entities])if(e.kind==='enemy'||e.kind==='projectile')e.remove();h.game.hero.hero.setFacing('north');h.player.lockT=h.player.knockT=h.player.stallT=0;h.input.tap('sword');await h.tick();
   },[size,stage]);
   for(const size of['normal','large']){
    for(const[stage,paragraphs]of[['past-intro',4],['past-signal',2],['past-after',2],['future-waiting',3],['future-consent',2],['future-done',2]]){
     await setup(size,stage);check(await page.evaluate(()=>window.__voxelHeroes.state.mode==='dialog'),`${size} ${stage}: real Talk opens`);
     const expected=new Map(),seen=new Map();let count=0;
     for(;count<140;count++){
      const initial=await page.evaluate(()=>window.__voxelHeroes.game.dialog.dialogView());if(!initial)break;
      if(!expected.has(initial.page)){expected.set(initial.page,initial.text);seen.set(initial.page,[]);}
      await click('dialog');const d=await page.evaluate(()=>window.__voxelHeroes.game.dialog.dialogView());assert.ok(d);seen.get(d.page).push(d.shown);await capture(`${size}-${stage}-${count}`);
      if(d.choices){check(JSON.stringify(d.choices)===JSON.stringify(['Call the courier home','Let me think']),`${size}: both consent choices fit`);await capture(`${size}-${stage}-choices`);await click('dialog-choice-1');break;}
      await click('dialog');
     }
     check(count<140&&expected.size===paragraphs&&[...expected].every(([i,text])=>seen.get(i).join('')===text),`${size} ${stage}: every paragraph survives actual ${touch?'touch':'mouse'} paging`);
     check(await page.evaluate(()=>window.__voxelHeroes.state.mode==='play'),`${size} ${stage}: returns to play`);
     if(stage==='future-consent')check(await page.evaluate(()=>!window.__voxelHeroes.game.state.hasFlag('era:departure-home')&&window.__voxelHeroes.state.maxMagic===10),`${size}: declining preserves the unfinished reward`);
    }
    for(const[stage,status]of[['offer','offer'],['active','active'],['powered','active'],['ready','ready'],['done','done']]){
     await page.evaluate(([size,stage])=>{const h=window.__voxelHeroes;h.state.settings.largeText=size==='large';for(const id of['era:departure','era:departure-powered','era:departure-tag','era:departure-home'])h.game.state.clearFlag(id);if(stage!=='offer')h.game.state.setFlag('era:departure');if(['powered','ready','done'].includes(stage))h.game.state.setFlag('era:departure-powered');if(['ready','done'].includes(stage))h.game.state.setFlag('era:departure-tag');if(stage==='done')h.game.state.setFlag('era:departure-home');h.game.objective.trackQuest(null);h.game.journal.openJournal('last-departure');h.render();},[size,stage]);
     const j=await page.evaluate(()=>window.__voxelHeroes.game.journal.journalView()),entry=j.entries[j.selected];check(entry.status===status,`${size}: journal ${stage} status`);let paragraph='';
     for(let p=0;p<j.detailPages;p++){await capture(`${size}-journal-${stage}-${p}`);paragraph+=' '+(await page.evaluate(()=>window.__voxelHeroes.game.journal.journalView())).shownDetail;if(j.detailPages>1)await click('journal-detail-next');}
     result.journalPages??=[];result.journalPages.push({name,size,stage,expected:entry.detail,shown:paragraph,pages:j.detailPages});
     check(paragraph.trim().replace(/\s+/g,' ')===entry.detail.replace(/\s+/g,' '),`${size}: journal ${stage} detail complete`);
     if(stage!=='done'){await click('journal-track');check(await page.evaluate(()=>window.__voxelHeroes.game.objective.trackedQuestId())==='last-departure',`${size}: journal ${stage} Track input`);}else check(!await page.evaluate(()=>window.__voxelHeroes.game.ui.uiView().hits.some(r=>r.id==='journal-track')),`${size}: done has no Track action`);
     await click('journal-close');check(await page.evaluate(()=>window.__voxelHeroes.state.mode)==='play',`${size}: journal ${stage} Close input`);
    }
    await setup(size,'future-consent');
    for(let i=0;i<140;i++){const d=await page.evaluate(()=>window.__voxelHeroes.game.dialog.dialogView());if(d.choices)break;await click('dialog');}
    await click('dialog-choice-0');await page.evaluate(()=>window.__voxelHeroes.step(.1));const prize=await capture(`${size}-homeward-prize`);
    check(await page.evaluate(()=>window.__voxelHeroes.game.state.hasFlag('era:departure-home')&&window.__voxelHeroes.state.maxMagic===11),`${size}: affirmative input awards one gem`);
    check(prize.banner.visible&&prize.runs.some(r=>r.text.includes('Homeward')),`${size}: actual Homeward Chime caption fits`);
    await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);await page.evaluate(()=>window.__voxelHeroes.step(3));
    await page.evaluate(async size=>{
     const h=window.__voxelHeroes;h.state.settings.largeText=size==='large';h.game.state.setFlag('era:copper-memory');h.game.state.setFlag('era:voices-returned');h.game.state.setFlag('era:tern-travels');h.state.maxMagic=h.state.magic=5;
     h.state.companionRuntime.shelterCooldown=h.state.companionRuntime.wardT=0;
     h.teleport('mossbrook-future:1,1',8.5,7.3);await h.step(.4);
     for(const e of [...h.entities])if(e.kind==='enemy'||e.kind==='projectile')e.remove();
     h.game.hero.hero.setFacing('north');h.player.lockT=h.player.knockT=h.player.stallT=h.player.attackT=0;
    },size);
    await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
    await page.keyboard.down('Shift');await page.evaluate(()=>window.__voxelHeroes.tick());
    await page.keyboard.press('KeyJ');await page.evaluate(()=>window.__voxelHeroes.tick());await page.keyboard.up('Shift');
    check(await page.evaluate(()=>window.__voxelHeroes.game.companions.companionView().wardT>2.9&&window.__voxelHeroes.state.magic===3),`${size}: native Guard and Sword activate Bell Shelter`);
    const feedback=await capture(`${size}-shelter-feedback`);
    check(feedback.runs.filter(r=>r.text==='Bell Shelter!').length===1&&!feedback.runs.some(r=>r.text==='Bell Shelter'||r.text.startsWith('Sheltered ')||r.text.startsWith('Recharging ')),`${size}: technique feedback clears the status panel`);
    await page.waitForFunction(()=>!window.__voxelHeroes.game.toast.toastView().visible);
    const restored=await capture(`${size}-shelter-status`);
    check(restored.runs.some(r=>r.text==='Bell Shelter')&&restored.runs.some(r=>r.text.startsWith('Sheltered '))&&!restored.runs.some(r=>r.text==='Bell Shelter!'),`${size}: shelter status returns after feedback fades`);
   }
   assert.deepEqual(errors,[]);check(true,'No page errors');
  }finally{await page.close();}
 }
 result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{await browser.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));}
