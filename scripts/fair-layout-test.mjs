import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { CHROMIUM_ARGS } from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/fair-layout',url=arg('url')??'http://127.0.0.1:5173/';
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],captures:[],fixtures:'Muted headless Chromium. Desktop, 320px touch portrait and 568x320 touch landscape; normal and large text. Initial gear, campaign milestones, placements, removed dialogue enemies and fixed HUD clocks are fixtures. Fair board paragraphs and choices, king story branches, journal states, all three ending pages and play HUD are measured with native mouse/touch paging. No voice or game audio playback.'};
result.panelsOnly=process.argv.includes('--panels-only');
if(result.panelsOnly)result.fixtures='Muted Chromium. Desktop, 320px touch portrait and 568x320 touch landscape at both text sizes. Campaign completion, initial placement and removed ending enemies are fixtures. Native ending hook, all three pages, fatal damage, delayed game-over panel, Try again and restored playable controls are checked. Complete text/panel bounds and touch visibility are measured. No playback.';
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
    window.__fairText={runs:[],panels:[],rects:[],parent:null};
    g.panel=function(x,y,w,height,o){const c=window.__fairText,p={x,y,w,h:height};c.panels.push(p);if(o?.accent)c.parent=p;return panel.call(this,x,y,w,height,o);};
    g.rect=function(x,y,w,height,...rest){window.__fairText.rects.push({x,y,w,h:height});return rect.call(this,x,y,w,height,...rest);};
    g.text=function(value,x,y,o={}){const c=window.__fairText,w=g.measure(String(value),o.size??1,o.tracking??0);c.runs.push({text:String(value),x:o.align==='center'?Math.round(x-w/2):o.align==='right'?x-w:x,y,w,h:g.cap*(o.size??1),parent:c.parent});return text.call(this,value,x,y,o);};
   });
   const click=async id=>{const p=await page.evaluate(id=>{const h=window.__voxelHeroes;h.render();const v=h.game.ui.uiView(),r=v.hits.find(r=>r.id===id);return r?{x:(r.x+r.w/2)*v.scale,y:(r.y+r.h/2)*v.scale}:null;},id);assert.ok(p,`${name}: native ${id} target exists`);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.evaluate(()=>window.__voxelHeroes.tick());};
   const capture=async label=>{
    const d=await page.evaluate(()=>{const h=window.__voxelHeroes,c=window.__fairText;c.runs=[];c.panels=[];c.rects=[];c.parent=null;h.game.ui.requestUi();h.player.hero.root.visible=true;h.render();return{...h.game.ui.uiView(),mode:h.state.mode,hud:h.game.hud.hudView(),banner:h.game.banner.bannerView(),touchDisplay:getComputedStyle(document.getElementById('touch')).display,...c};});
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
    if(['journal','dialog','ending','dead'].includes(d.mode))assert.equal(d.touchDisplay,'none',`${name}/${label}: touch pad hidden`);
    result.captures.push({label:name+'-'+label,w:d.w,h:d.h,violations:bad,panels,collisions});writeFileSync(`${out}/${name}-${label}.json`,JSON.stringify(d,null,2));
    assert.deepEqual(bad,[],`${name}/${label}: text fits`);assert.deepEqual(panels,[],`${name}/${label}: panels fit`);assert.deepEqual(collisions,[],`${name}/${label}: controls and text clear`);
    await page.screenshot({path:`${out}/${name}-${label}.png`});return d;
   };

   const reset=async(size,stage='offer')=>page.evaluate(async([size,stage])=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.state.settings.muted=true;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.state.settings.largeText=size==='large';h.player.invT=999;h.game.objective.trackQuest(null);h.teleport('mossbrook-fair:0,0',8.5,14);await h.step(.2);const a=h.entities.find(e=>e.type==='fair-clock').ai;if(stage!=='offer'){h.game.state.setFlag('fair:start:1');a.serial=1;}if(stage==='running'){a.phase='running';a.elapsed=12;a.mask=3;a.target=2;a.shotT=999;}if(stage==='timeout')a.phase='timeout';if(stage==='done'){h.game.state.setFlag('fair:bell-medal');h.game.state.setFlag('fair:time:478');a.phase='won';a.mask=63;}},[size,stage]);
   const readAll=async(size,label,count,choice=false)=>{
    const expected=new Map(),seen=new Map();let n=0;
    for(;n<100;n++){
     const initial=await page.evaluate(()=>window.__voxelHeroes.game.dialog.dialogView());if(!initial||initial.pages!==count)break;
     if(!expected.has(initial.page)){expected.set(initial.page,initial.text);seen.set(initial.page,[]);}
     await click('dialog');const d=await page.evaluate(()=>window.__voxelHeroes.game.dialog.dialogView());assert.ok(d);seen.get(d.page).push(d.shown);await capture(`${size}-${label}-${n}`);
     if(d.choices){check(choice&&d.choices.length===2,`${size} ${label}: both native choices visible`);await click('dialog-choice-1');break;}
     await click('dialog');
    }
    result.dialogues??=[];result.dialogues.push({viewport:name,size,label,paragraphs:[...expected].map(([i,text])=>({page:i,expected:text,shown:seen.get(i).join('')}))});
    check(n<100&&expected.size===count&&[...expected].every(([i,text])=>seen.get(i).join('')===text),`${size} ${label}: all ${count} authored paragraphs survive actual ${touch?'touch':'mouse'} paging`);
   };
   for(const size of['normal','large']){
    if(!result.panelsOnly){
    for(const[stage,count,choices]of[['offer',4,true],['running',2,false],['done',2,true]]){
     await reset(size,stage);await page.evaluate(async()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(7.5,14.6);h.game.hero.hero.setFacing('north');h.player.lockT=0;h.input.tap('sword');await h.tick();});
     check(await page.evaluate(()=>window.__voxelHeroes.state.mode==='dialog'),`${size} board ${stage}: actual Read opens`);
     await readAll(size,'board-'+stage,count,choices);
     check(await page.evaluate(()=>window.__voxelHeroes.state.mode)==='play',`${size} board ${stage}: Read returns to play`);
     check(await page.evaluate(stage=>{const h=window.__voxelHeroes;return stage!=='offer'||![...h.state.flags].some(f=>f.startsWith('fair:start:'));},stage),`${size} board ${stage}: Later leaves the attempt untouched`);
    }
    for(const[stage,status]of[['offer','offer'],['running','active'],['timeout','active'],['done','done']]){
     await reset(size,stage);await page.evaluate(()=>{const h=window.__voxelHeroes;h.game.journal.openJournal('clockfair');h.render();});
     const j=await page.evaluate(()=>window.__voxelHeroes.game.journal.journalView()),entry=j.entries[j.selected];check(entry.status===status,`${size}: journal ${stage} status`);let paragraph='';
     for(let p=0;p<j.detailPages;p++){await capture(`${size}-journal-${stage}-${p}`);paragraph+=' '+(await page.evaluate(()=>window.__voxelHeroes.game.journal.journalView())).shownDetail;if(j.detailPages>1)await click('journal-detail-next');}
     check(paragraph.trim().replace(/\s+/g,' ')===entry.detail.replace(/\s+/g,' '),`${size}: journal ${stage} detail complete`);
     if(stage!=='done'){await click('journal-track');check(await page.evaluate(()=>window.__voxelHeroes.game.objective.trackedQuestId())==='clockfair',`${size}: journal ${stage} Track input`);}else check(!await page.evaluate(()=>window.__voxelHeroes.game.ui.uiView().hits.some(r=>r.id==='journal-track')),`${size}: done has no Track action`);
     await click('journal-close');check(await page.evaluate(()=>window.__voxelHeroes.state.mode)==='play',`${size}: journal ${stage} Close input`);
    }
    for(const stage of['offer','running','timeout','done']){
     await reset(size,stage);await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);const d=await capture(`${size}-play-${stage}`);
     check(!d.runs.some(r=>r.text.includes('Southeast fair arch')),`${size}: local ${stage} HUD does not send a player to an arch already crossed`);
     check(await page.evaluate(()=>window.__voxelHeroes.game.objective.currentStep().questId)==='clockfair',`${size}: ${stage} fair has a local goal`);
    }
    for(const[stage,count]of[['initial',4],['barrow',2],['nursery',3],['watch',3],['shore',3],['tower',3],['homecoming',4]]){
     await reset(size);await page.evaluate(async stage=>{const h=window.__voxelHeroes;if(stage==='initial'){h.state.swords.owned=[];h.state.swords.equipped=null;h.state.gear.shield=0;}else{h.give('blade-start');h.game.swords.equipSword('blade-start');}if(stage==='nursery')h.game.state.setFlag('boss:d1');if(stage==='watch')h.game.state.setFlag('boss:d2');if(stage==='shore')h.game.state.setFlag('boss:d3');if(stage==='tower')for(let n=1;n<=4;n++)h.game.state.setFlag('orb:'+n);if(stage==='homecoming')h.game.state.setFlag('campaign:complete');h.teleport('ow-4-3:1,1',7.5,6.7);await h.step(.2);for(const e of [...h.entities])if(e.kind==='enemy'||e.kind==='projectile')e.remove();const k=h.entities.find(e=>e.type==='npc-king'),s=h.screen();k.wander=0;h.game.hero.hero.place(k.x-s.x0,k.z-s.z0+1.2);h.game.hero.hero.setFacing('north');h.player.lockT=0;h.input.tap('sword');await h.tick();},stage);
     check(await page.evaluate(()=>window.__voxelHeroes.state.mode==='dialog'),`${size} king ${stage}: actual talk opens`);await readAll(size,'king-'+stage,count);if(stage==='initial'){check(await page.evaluate(()=>{const h=window.__voxelHeroes;return h.state.swords.equipped==='blade-start'&&h.state.gear.shield===1;}),`${size}: native king arming survives story paging`);await readAll(size,'king-navigation',2);}
     check(await page.evaluate(()=>window.__voxelHeroes.state.mode)==='play',`${size} king ${stage}: talk returns to play`);
    }
    }
    await reset(size);await page.evaluate(async()=>{const h=window.__voxelHeroes;h.state.profile.name='LongHeroNameHere';h.teleport('tower-final:0,0',13.5,13.5);for(const e of [...h.entities])if(e.kind==='enemy'||e.kind==='projectile')e.remove();h.game.state.setFlag('campaign:complete');await h.step(1.8);});
    check(await page.evaluate(()=>window.__voxelHeroes.state.mode)==='ending',`${size}: native campaign hook opens ending`);
    const titles=[];
    for(let p=0;p<3;p++){await capture(`${size}-ending-${p}`);const o=await page.evaluate(()=>window.__voxelHeroes.game.overlay.overlayView());titles.push(o.title);await page.evaluate(async()=>window.__voxelHeroes.step(.8));await click('overlay-start');}
    check(new Set(titles).size===3,`${size}: all three original ending pages survive native paging`);await page.evaluate(async()=>window.__voxelHeroes.step(1.8));check(await page.evaluate(()=>window.__voxelHeroes.screen().key)==='v1:1,1',`${size}: ending returns to Mossbrook`);
    if(touch)check(await page.evaluate(()=>getComputedStyle(document.getElementById('touch')).display!=='none'),`${size}: ending restores the playable touch controls`);
    await reset(size);await page.evaluate(async()=>{const h=window.__voxelHeroes;h.game.hero.hero.receiveHit({damage:h.state.maxHp,kind:'hazard',ignoreIframes:true,knockback:false});await h.step(1.6);});
    check(await page.evaluate(()=>window.__voxelHeroes.state.mode)==='dead',`${size}: native fatal damage opens game over`);await capture(`${size}-game-over`);await click('overlay-start');await page.evaluate(async()=>window.__voxelHeroes.step(1.8));
    check(await page.evaluate(()=>{const h=window.__voxelHeroes;return h.state.mode==='play'&&h.state.hp>0;}),`${size}: native Try again returns to play`);
    if(touch)check(await page.evaluate(()=>getComputedStyle(document.getElementById('touch')).display!=='none'),`${size}: Try again restores the playable touch controls`);
   }
   assert.deepEqual(errors,[]);check(true,'No page errors');
  }finally{await page.close();}
 }
 result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{await browser.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));}
