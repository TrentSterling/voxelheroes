import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { CHROMIUM_ARGS, startServer } from './playtest.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/hive-layout';
const url=process.argv.find(a=>a.startsWith('--url='))?.slice(6);
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const fp=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});
const report={utc:new Date().toISOString(),ok:false,sourceSha256:fp.digest('hex'),checks:[],captures:[],fixture:'Muted Chromium, desktop mouse and coarse touch. Authored nursery tablet opened with real sword input, every paragraph segment advanced with actual mouse/touch. Story, positions and cleared guards are fixtures. Text and panel bounds, HUD overlap and both text sizes are measured; no audio playback.'};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});let server;
try{
 server=url?{url,close:async()=>{}}:await startServer();
 for(const [name,width,height,touch]of[['desktop',1280,720,false],['phone',320,568,true],['landscape',568,320,true]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   await page.goto(new URL('?manual=1',server.url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.ui);
   await page.evaluate(()=>{
    const h=window.__voxelHeroes,g=h.game.ui.g,text=g.text,panel=g.panel;
    h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.state.flags.add('overworld:talked:king');h.state.flags.add('dungeon:d1:entered');h.game.dungeons.giveBossKey('d1');h.game.dungeons.defeatBoss('d1');h.game.dungeons.completeDungeon('d1');h.game.dungeons.giveBossKey('d2');h.player.invT=999;
    window.__hiveText={runs:[],panels:[],parent:null};
    g.panel=function(x,y,w,height,o){const c=window.__hiveText,p={x,y,w,h:height};c.panels.push(p);if(o?.accent)c.parent=p;return panel.call(this,x,y,w,height,o);};
    g.text=function(value,x,y,o={}){const c=window.__hiveText,w=g.measure(String(value),o.size??1,o.tracking??0);c.runs.push({text:String(value),x:o.align==='center'?Math.round(x-w/2):o.align==='right'?x-w:x,y,w,h:g.cap*(o.size??1),parent:c.parent});return text.call(this,value,x,y,o);};
   });
   const check=(pass,label)=>{assert.ok(pass,name+': '+label);report.checks.push(name+': '+label);console.log('PASS '+name+': '+label);};
   const capture=async label=>{
    const data=await page.evaluate(()=>{const h=window.__voxelHeroes,c=window.__hiveText;c.runs=[];c.panels=[];c.parent=null;h.game.ui.requestUi();h.player.hero.root.visible=true;h.render();return{...h.game.ui.uiView(),mode:h.state.mode,hud:h.game.hud.hudView(),...c};});
    const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
    const bad=data.runs.filter(r=>r.x<0||r.y<0||r.x+r.w>data.w||r.y+r.h>data.h||r.parent&&r.y>=r.parent.y&&(r.x<r.parent.x+2||r.x+r.w>r.parent.x+r.parent.w-2||r.y+r.h>r.parent.y+r.parent.h));
    const panels=data.panels.filter(p=>p.x<0||p.y<0||p.x+p.w>data.w||p.y+p.h>data.h);
    const collisions=[];if(data.mode==='play')for(const objective of data.hud.widgets.filter(r=>r.id==='objective'))for(const other of[...data.hud.widgets.filter(r=>r.id!=='objective'),...data.hits.filter(r=>['party-open','journal-open'].includes(r.id))])if(overlap(objective,other))collisions.push([objective.id,other.id]);
    report.captures.push({label:name+'-'+label,w:data.w,h:data.h,violations:bad,panels,collisions});assert.deepEqual(bad,[],name+': '+label+' text bounds');assert.deepEqual(panels,[],name+': '+label+' panel bounds');assert.deepEqual(collisions,[],name+': '+label+' HUD controls');
    await page.screenshot({path:`${out}/${name}-${label}.png`});
   };
   const clickDialog=async()=>{
    const p=await page.evaluate(()=>{const h=window.__voxelHeroes;h.render();const v=h.game.ui.uiView(),r=v.hits.find(r=>r.id==='dialog');return r?{x:(r.x+r.w/2)*v.scale,y:(r.y+r.h/2)*v.scale}:null;});assert.ok(p,'Dialogue touch target exists');
    if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.evaluate(()=>window.__voxelHeroes.tick());
   };
   for(const large of[false,true]){
    await page.evaluate(async large=>{const h=window.__voxelHeroes;h.state.settings.largeText=large;h.teleport('d2:3,1',2.5,9.5);h.player.invT=999;await h.step(1.4);for(const e of [...h.entities])if(e.kind==='enemy')e.die();h.game.hero.hero.setFacing('north');h.input.tap('sword');await h.tick();},large);
    check(await page.evaluate(()=>window.__voxelHeroes.game.objective.objectiveId())==='hive-patrol-key','The actual nursery objective is active');
    check(await page.evaluate(()=>window.__voxelHeroes.state.mode==='dialog'),'Real sword input opens the nursery tablet in '+(large?'large':'normal')+' text');
    const seen=[[],[],[]];let count=0;
    for(;count<80;count++){
     if(!await page.evaluate(()=>window.__voxelHeroes.game.dialog.dialogView()))break;
     await clickDialog();const v=await page.evaluate(()=>window.__voxelHeroes.game.dialog.dialogView());assert.ok(v,'Revealing text keeps the tablet open');seen[v.page].push(v.shown);
     await capture((large?'large':'normal')+'-tablet-'+count);await clickDialog();
    }
    const authored=await page.evaluate(()=>window.__voxelHeroes.screen().def.tablet);
    check(count<80&&authored.every((line,i)=>seen[i].join('')===line),'Actual '+(touch?'touch':'mouse')+' pages expose all three full paragraphs in '+(large?'large':'normal')+' text');
    await page.evaluate(()=>{const h=window.__voxelHeroes;h.game.hero.hero.place(5.5,4.65);h.player.invT=999;});
    for(let i=0;i<200;i++){if(await page.evaluate(()=>window.__voxelHeroes.entities.find(e=>e.type==='hive-pressure')?.ai.phase==='warning'))break;await page.evaluate(()=>window.__voxelHeroes.step(.05));}
    await capture((large?'large':'normal')+'-pressure-hud');
    check(await page.evaluate(()=>window.__voxelHeroes.entities.find(e=>e.type==='hive-pressure').lanes.some(m=>m.visible)),'A visible pressure warning and current nursery objective fit '+(large?'large':'normal')+' HUD');
   }
   assert.deepEqual(errors,[]);check(true,'No page errors');
  }finally{await page.close();}
 }
 report.ok=true;
}catch(error){report.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{await browser.close();await server?.close();report.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(report,null,2));}
