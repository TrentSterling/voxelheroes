import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {CHROMIUM_ARGS} from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const url=arg('url')??'http://127.0.0.1:5173/',out=arg('out')??'playtest-out/stone-eye-touch';mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of[...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],captures:[],fixtures:'Muted Chromium at touch portrait 320x568 and landscape 568x320, normal and large text. Starter gear, one missing half-heart, positions, initial cooldown and an isolated uncrowned Stone Eye are fixtures. Actual CDP touch joystick and item-button events drive sidestep and boomerang interruption; complete short room hint and UI text bounds are measured.'};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};
try{
 for(const[name,width,height]of[['phone',320,568],['landscape',568,320]])for(const large of [false,true]){
  const label=`${name}-${large?'large':'normal'}`,page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true}),errors=[];
  try{
   page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   await page.goto(new URL('?manual=1',url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.ui);
   await page.evaluate(async large=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame({prologue:false});h.state.settings.largeText=large;h.game.swords.giveSword('blade-start');h.game.swords.equipSword('blade-start');h.game.inventory.giveItem('boomerang');h.game.inventory.selectItem('boomerang');h.teleport('d1:4,7',10.5,7.5);await h.step(3.2);for(const e of [...h.entities])if(e.kind==='enemy'||e.kind==='projectile')e.remove();h.game.hero.hero.place(10.5,7.5);h.game.hero.hero.setFacing('west');h.setHp(h.state.maxHp-1);h.player.invT=0;const e=h.spawn('gazer',3.5,7.5,{crowned:false});e.spawned=true;e.growT=1;e.holder.scale.setScalar(1);e.yaw=Math.PI/2;e.ai.eye.cool=0;window.__touchEye=e;await h.tick();const g=h.game.ui.g,original=g.text;window.__eyeText=[];g.text=function(value,x,y,o={}){const w=g.measure(String(value),o.size??1,o.tracking??0);window.__eyeText.push({text:String(value),x:o.align==='center'?Math.round(x-w/2):o.align==='right'?x-w:x,y,w,h:g.cap*(o.size??1)});return original.call(this,value,x,y,o);};},large);
   const capture=async stage=>{
    const r=await page.evaluate(()=>{const h=window.__voxelHeroes;window.__eyeText=[];h.game.ui.requestUi();h.player.hero.root.visible=true;h.render();return {...h.game.ui.uiView(),runs:window.__eyeText,touch:getComputedStyle(document.getElementById('touch')).display};});
    check(r.runs.every(x=>x.x>=0&&x.y>=0&&x.x+x.w<=r.w+.5&&x.y+x.h<=r.h+.5),`${label}/${stage}: all native text stays inside the canvas`);
    check(r.touch!=='none',`${label}/${stage}: playable touch controls remain visible`);
    const overlaps=r.runs.flatMap((a,i)=>r.runs.slice(i+1).filter(b=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y).map(b=>[a.text,b.text]));
    check(overlaps.length===0,`${label}/${stage}: text layers stay separate: ${JSON.stringify(overlaps)}`);
    const file=`${out}/${label}-${stage}.png`;await page.screenshot({path:file});result.captures.push(file);return r;
   };
   await capture('arrival');
   await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
   let r=await capture('warning');
   check(r.runs.map(x=>x.text).join(' ').includes('Sidestep or boomerang.'),`${label}: the complete short room instruction survives touch wrapping`);
   const state=()=>page.evaluate(()=>{const h=window.__voxelHeroes,e=window.__touchEye;return {hp:h.state.hp,z:h.player.z,held:h.game.hero.hero.hasStatus('paralyzed'),cue:e.sightCue.visible,phase:e.ai.eye.phase,enemyHp:e.hp,stun:e.stunT,shots:h.entities.filter(e=>e.type==='gazer-shot'&&!e.removed).length};});
   const before=await state();check(before.cue&&!before.held,`${label}: native targeting warns while touch movement is available`);
   const cdp=await page.context().newCDPSession(page),stick=await page.locator('#stick').boundingBox();assert.ok(stick);
   const cx=stick.x+stick.width/2,cy=stick.y+stick.height/2;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx,y:cy-44,id:1}]});await page.evaluate(()=>window.__voxelHeroes.step(.3));
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   check(before.z-(await state()).z>1,`${label}: actual touch joystick sidesteps the line`);
   await page.evaluate(()=>window.__voxelHeroes.step(1.8));check((await state()).hp===before.hp,`${label}: the vulnerable touch hero evades the real shot`);
   await page.evaluate(async()=>{const h=window.__voxelHeroes,e=window.__touchEye;for(const shot of [...h.entities])if(shot.kind==='projectile')shot.remove();h.game.hero.hero.place(7.5,7.5);h.game.hero.hero.setFacing('west');e.x=h.screen().x0+3.5;e.z=h.screen().z0+7.5;e.yaw=Math.PI/2;Object.assign(e.ai.eye,{phase:'roam',cool:0});await h.tick();});
   const item=await page.locator('#btn-b').boundingBox();assert.ok(item);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:item.x+item.width/2,y:item.y+item.height/2,id:2}]});await page.evaluate(()=>window.__voxelHeroes.tick());
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.evaluate(()=>window.__voxelHeroes.step(.4));r=await state();
   check(r.phase==='recover'&&!r.cue&&r.stun>1.5&&r.enemyHp===6&&r.shots===0,`${label}: actual touch item button interrupts with the zero-damage boomerang`);
   await capture('boomerang');assert.deepEqual(errors,[]);check(true,`${label}: no game exceptions`);await cdp.detach();
  }finally{await page.close();}
 }
 for(const[name,width,height]of[['laptop',1024,600],['desktop',1280,720]])for(const large of [false,true]){
  const label=`${name}-${large?'large':'normal'}-journal`,page=await browser.newPage({viewport:{width,height}}),errors=[];
  try{
   page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());await page.goto(new URL('?manual=1',url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.journal);
   await page.evaluate(large=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame({name:'WWWWWWWWWWWW',class:'balanced'});h.state.settings.largeText=large;h.state.errands.Rook={status:'active',found:false};h.state.flags.add('overworld:talked:king');for(const d of ['d1','d2','d3','d4']){h.state.flags.add('dungeon:'+d+':entered');h.game.dungeons.giveBossKey(d);h.game.dungeons.defeatBoss(d);h.game.dungeons.completeDungeon(d);}h.game.journal.openJournal();},large);
   const total=await page.evaluate(()=>window.__voxelHeroes.game.journal.journalView().entries.length),seen=new Set();check(total>=13,`${label}: a full campaign exposes the long quest list`);
   for(let i=0;i<total;i++){
    const data=await page.evaluate(()=>{const h=window.__voxelHeroes;h.game.ui.requestUi();h.render();const ui=h.game.ui.uiView(),j=h.game.journal.journalView();return {w:ui.w,h:ui.h,scale:ui.scale,selected:j.selected,id:j.selectedId,hits:ui.hits.filter(x=>x.id.startsWith('journal-')&&!['journal-panel','journal-scrim'].includes(x.id))};});seen.add(data.id);
    const overlap=data.hits.flatMap((a,i)=>data.hits.slice(i+1).filter(b=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y).map(b=>[a.id,b.id]));
    check(overlap.length===0&&data.hits.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=data.w&&r.y+r.h<=data.h),`${label}/${i+1}: quest and footer controls stay separate and in bounds`);
    check(data.hits.some(x=>x.id===`journal-task-${data.selected}`),`${label}/${i+1}: the selected quest remains in the visible list`);
    if(i===0||i===total-1){const file=`${out}/${label}-${i===0?'first':'last'}.png`;await page.screenshot({path:file});result.captures.push(file);}
    const next=data.hits.find(x=>x.id==='journal-next');assert.ok(next);await page.mouse.click((next.x+next.w/2)*data.scale,(next.y+next.h/2)*data.scale);await page.evaluate(()=>window.__voxelHeroes.tick());
   }
   check(seen.size===total,`${label}: native Next reaches every authored quest`);assert.deepEqual(errors,[]);check(true,`${label}: no game exceptions`);
  }finally{await page.close();}
 }
 result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{await browser.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));console.log(`${result.ok?'PASS':'FAIL'} ${result.checks.length} muted touch checks, ${result.captures.length} captures.`);}
