import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, firefox } from 'playwright';
import { CHROMIUM_ARGS } from './playtest.mjs';
import { installSilentOutput } from './lib/silent-output.mjs';

const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const url=arg('url')??'http://127.0.0.1:5173/',out=arg('out')??'playtest-out/watch-station-hud-layout';
assert.ok(!existsSync(`${out}/result.json`),'Choose a fresh output folder.');mkdirSync(out,{recursive:true});
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
const fingerprint=()=>{const h=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){h.update(f.replaceAll('\\','/')+'\0');h.update(readFileSync(f));}return h.digest('hex');};
const result={startedUtc:new Date().toISOString(),sourceSha256:fingerprint(),checks:[],captures:[],layouts:[],scope:'Isolated normal/large-text HUD matrix. Campaign, gear, placement, stage and phase are disclosed fixtures; enemy AI is stationary and expired projectiles removed. Actual touch Guard labels, Journal input, visible hero and all text/rectangle bounds are measured. Fresh solo victories are separate earned routes. Output disconnected before navigation.'};
const profiles=[['phone',320,568,true],['landscape',568,320,true],['wide',840,360,true],['desktop',1280,720,false]];
const stages=[
  {id:'oasis',key:'sunreach:1,1',x:8,z:10},
  {id:'vestibule',key:'d3:2,3'}, {id:'counterweight',key:'d3:0,2'},
  {id:'vault-rest',key:'d3:3,2',grapple:true},
  {id:'upper-landing',key:'d3:2,7',grapple:true},
  {id:'crown',key:'d3:4,6',grapple:true},
  {id:'platform-rest',key:'d3:2,5',grapple:true,crown:true},
  {id:'feet-laser',key:'d3-boss:0,0',phase:'laser-tell',stage:1},
  {id:'arms-wave',key:'d3-boss:0,0',phase:'slam-tell',stage:2},
  {id:'core-landing',key:'d3-boss:0,0',phase:'leap',stage:3},
  {id:'core-open',key:'d3-boss:0,0',phase:'idle',stage:3},
  {id:'third-light',key:'d3:0,5',complete:true},
];
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const check=(condition,label,detail)=>{result.checks.push({label,ok:!!condition,...(detail?{detail}: {})});assert.ok(condition,`${label}: ${JSON.stringify(detail??'')}`);};
try {
  for(const engine of ['firefox','chromium']) {
    const browser=await ({chromium,firefox}[engine]).launch({headless:true,...(engine==='chromium'?{args:CHROMIUM_ARGS}:{firefoxUserPrefs:{'media.volume_scale':'0.0'}})});
    try {
      for(const [profile,width,height,touch] of profiles) {
        const context=await browser.newContext({viewport:{width,height},hasTouch:touch});await installSilentOutput(context);
        const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
        try {
          await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
          await page.goto(new URL('?manual=1&seed=17',url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.ui);
          assert.equal(await page.evaluate(()=>window.__testAudioOutputGuard?.version),1);
          await page.evaluate(()=>{
            const h=window.__voxelHeroes,g=h.game.ui.g,text=g.text;window.__watchText=[];
            g.text=function(value,x,y,o={}){const w=g.measure(String(value),o.size??1,o.tracking??0);window.__watchText.push({text:String(value),x:o.align==='center'?Math.round(x-w/2):o.align==='right'?x-w:x,y,w,h:g.cap*(o.size??1)});return text.call(this,value,x,y,o);};
          });
          for(const large of [false,true])for(const stage of stages) {
            const label=`${engine}-${profile}-${large?'large':'normal'}-${stage.id}`;
            await page.evaluate(async({large,stage})=>{
              const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});
              h.game.settings.setSetting('muted',true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.settings.setSetting('largeText',large);
              h.state.gear.sword=1;h.state.gear.shield=1;h.game.inventory.giveItem('boomerang');h.game.inventory.giveItem('bombs');
              h.state.flags.add('overworld:talked:king');
              for(const id of ['d1','d2']){h.state.flags.add(`dungeon:${id}:entered`);h.game.dungeons.giveBossKey(id);h.game.dungeons.defeatBoss(id);h.game.dungeons.completeDungeon(id);}
              h.game.objective.trackQuest(null);
              if(stage.id!=='oasis')h.state.flags.add('dungeon:d3:entered');
              if(stage.grapple)h.game.inventory.giveItem('grapple');
              if(stage.crown||stage.phase||stage.complete)h.game.dungeons.giveBossKey('d3');
              if(stage.complete){h.game.dungeons.defeatBoss('d3');h.game.dungeons.completeDungeon('d3');}
              h.teleport(stage.key,stage.phase?3:stage.x??8,stage.phase?12:stage.z??9);
              for(const e of h.entities)if(e.kind==='enemy'){e.think=()=>{};if(e.type==='boss-colossus')e.introDone=true;}
              await h.step(2);
              if(stage.phase){
                const b=h.entities.find(e=>e.type==='boss-colossus'),s=h.screen();
                for(const e of [...h.entities])if(e.type==='colossus-laser'||e.type==='colossus-wave')e.remove();
                for(const part of b.segments)if(stage.stage===3||stage.stage===2&&part.index<2)part.remove();
                b.stage=stage.stage;b.mesh.setPose(stage.stage===3?'core':'body');b.x=s.x0+11;b.z=s.z0+6;
                b.ai.phase=stage.phase;b.ai.t=.9;b.ai.dx=1;b.ai.dz=0;b.ai.hopX=s.x0+6;b.ai.hopZ=s.z0+10;
                b.airborne=stage.phase==='leap';await h.tick();b.present();
              }
              h.game.ui.requestUi();h.render();
            },{large,stage});
            if(touch){const button=await page.locator('#btn-guard').boundingBox();assert.ok(button);await page.touchscreen.tap(button.x+button.width/2,button.y+button.height/2);await page.evaluate(()=>window.__voxelHeroes.step(.1));assert.equal(await page.evaluate(()=>window.__voxelHeroes.input.lastDevice()),'touch');}
            await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);await page.waitForTimeout(100);
            const data=await page.evaluate(()=>{
              const h=window.__voxelHeroes;window.__watchText=[];h.game.ui.requestUi();h.render();
              return {...h.game.ui.uiView(),hud:h.game.hud.hudView(),prompts:h.game.promptHud.promptView(),runs:window.__watchText,goal:h.game.objective.objectiveHudText(),objectiveId:h.game.objective.objectiveId(),heroVisible:h.player.hero.root.visible};
            });
            const center=data.hud.widgets.filter(r=>r.region==='center'),reserved=[...data.hud.widgets.filter(r=>r.region!=='center'),...data.hits.filter(r=>['party-open','journal-open'].includes(r.id))];
            const collisions=center.flatMap(a=>reserved.filter(b=>overlaps(a,b)).map(b=>[a.id,b.id]));
            const promptCollisions=center.flatMap(a=>data.prompts.filter(b=>overlaps(a,{...b,h:16})).map(b=>[a.id,b.id]));
            const escapes=data.runs.filter(r=>r.x<0||r.y<0||r.x+r.w>data.w||r.y+r.h>data.h);
            const bossRect=center.find(r=>r.id==='colossus-progress');
            const bossText=bossRect?data.runs.filter(r=>r.x>=bossRect.x&&r.y>=bossRect.y&&r.x+r.w<=bossRect.x+bossRect.w&&r.y+r.h<=bossRect.y+bossRect.h).map(r=>r.text).join(' '):'';
            result.layouts.push({label,...data,collisions,promptCollisions,escapes});
            check(!collisions.length,`${label}: center widgets clear side controls`,collisions);
            check(!promptCollisions.length,`${label}: center widgets clear actual action prompts`,promptCollisions);
            check(!escapes.length,`${label}: every text run fits the canvas`,escapes);
            check(data.heroVisible,`${label}: settled native hero is visible`);
            check(center.some(r=>r.id==='colossus-progress')===!!stage.phase,`${label}: Rook status is present exactly in the active arena`);
            const stageWords={1:'Feet',2:'Arms',3:'Core'};
            check(!stage.phase||bossText.includes(stageWords[stage.stage]),`${label}: current vulnerable stage is visible`,bossText);
            check(!stage.complete||data.objectiveId==='watch-homecoming',`${label}: third-light stairs have their return direction`,data.objectiveId);
            const file=`${out}/${label}.png`;await page.screenshot({path:file});result.captures.push(file);
            const hit=data.hits.find(r=>r.id==='journal-open');assert.ok(hit);
            const x=(hit.x+hit.w/2)*data.scale,y=(hit.y+hit.h/2)*data.scale;
            if(touch)await page.touchscreen.tap(x,y);else await page.mouse.click(x,y);
            await page.evaluate(()=>window.__voxelHeroes.tick());
            check(await page.evaluate(()=>window.__voxelHeroes.state.mode==='journal'),`${label}: actual ${touch?'touch':'mouse'} opens Journal`);
          }
          check(!errors.length,`${engine}-${profile}: no page errors`,errors);
        }finally{await context.close();}
      }
    }finally{await browser.close();}
  }
  result.sourceUnchanged=result.sourceSha256===fingerprint();assert.ok(result.sourceUnchanged);result.ok=true;
  console.log(`PASS ${result.checks.length} Watch station HUD checks, ${result.captures.length} settled images.`);
}catch(e){result.ok=false;result.error={message:e.message,stack:e.stack};console.error(e.stack);process.exitCode=1;}
finally{result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));}
