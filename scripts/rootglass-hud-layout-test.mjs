import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, firefox } from 'playwright';
import { CHROMIUM_ARGS } from './playtest.mjs';
import { installSilentOutput } from './lib/silent-output.mjs';

const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const url=arg('url')??'http://127.0.0.1:5173/',out=arg('out')??'playtest-out/rootglass-hud-layout';
assert.ok(!existsSync(`${out}/result.json`),'Choose a fresh output folder.');mkdirSync(out,{recursive:true});
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
const fingerprint=()=>{const h=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){h.update(f.replaceAll('\\','/')+'\0');h.update(readFileSync(f));}return h.digest('hex');};
const result={startedUtc:new Date().toISOString(),sourceSha256:fingerprint(),checks:[],captures:[],layouts:[],scope:'Isolated normal/large-text HUD matrix. Story, gear, placement and Queen phase/health are fixtures; wardens are stationary and drones removed. Native solo victories are recorded separately. Actual touch/mouse Journal input is tested. Output disconnected before navigation.'};
const profiles=[['phone',320,568,true],['landscape',568,320,true],['wide',840,360,true],['desktop',1280,720,false]];
const stages=[
  {id:'pressure-three',key:'d2:3,1',seals:3}, {id:'pressure-one',key:'d2:3,1',seals:1},
  {id:'pressure-quiet',key:'d2:3,1',seals:0},
  ...['flight','gather','rest','volley','flipped'].map(phase=>({id:`queen-${phase}`,key:'d2-boss:0,0',phase})),
  {id:'second-orb-home',key:'d2:0,0',complete:true},
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
            const h=window.__voxelHeroes,g=h.game.ui.g,text=g.text;window.__rootglassText=[];
            g.text=function(value,x,y,o={}){const w=g.measure(String(value),o.size??1,o.tracking??0);window.__rootglassText.push({text:String(value),x:o.align==='center'?Math.round(x-w/2):o.align==='right'?x-w:x,y,w,h:g.cap*(o.size??1)});return text.call(this,value,x,y,o);};
          });
          for(const large of [false,true])for(const stage of stages) {
            const label=`${engine}-${profile}-${large?'large':'normal'}-${stage.id}`;
            await page.evaluate(async({large,stage})=>{
              const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});
              h.game.settings.setSetting('muted',true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.settings.setSetting('largeText',large);
              h.state.gear.sword=1;h.state.gear.shield=1;h.game.inventory.giveItem('boomerang');h.game.inventory.giveItem('bombs');
              h.state.flags.add('overworld:talked:king');h.state.flags.add('dungeon:d1:entered');h.game.dungeons.giveBossKey('d1');h.game.dungeons.defeatBoss('d1');h.game.dungeons.completeDungeon('d1');
              h.state.flags.add('dungeon:d2:entered');h.game.dungeons.giveMap('d2');h.game.objective.trackQuest(null);
              if(stage.phase||stage.complete)h.game.dungeons.giveBossKey('d2');
              if(stage.seals!==undefined){for(let i=0;i<3-stage.seals;i++)h.state.flags.add(`dungeon:d2:nursery-valve:${i}`);if(stage.seals===0)h.state.flags.add('dungeon:d2:nursery-vented');}
              if(stage.complete){h.game.dungeons.defeatBoss('d2');h.game.dungeons.completeDungeon('d2');}
              h.teleport(stage.key,stage.phase?11:8,stage.phase?12:9);
              for(const e of h.entities)if(e.kind==='enemy'){if(e.type==='boss-queen')e.introDone=true;else e.think=()=>{};}
              await h.step(2);
              if(stage.phase){const q=h.entities.find(e=>e.type==='boss-queen');q.ai.phase=stage.phase;q.ai.t=stage.phase==='flipped'?3.8:3;q.ai.broodT=999;q.hp=stage.phase==='flipped'?18:45;for(const e of [...h.entities])if(e.type==='queen-drone')e.remove();await h.tick();}
              h.game.ui.requestUi();h.render();
            },{large,stage});
            if(touch){const button=await page.locator('#btn-guard').boundingBox();assert.ok(button);await page.touchscreen.tap(button.x+button.width/2,button.y+button.height/2);await page.evaluate(()=>window.__voxelHeroes.step(.1));assert.equal(await page.evaluate(()=>window.__voxelHeroes.input.lastDevice()),'touch');}
            await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);await page.waitForTimeout(100);
            const data=await page.evaluate(()=>{
              const h=window.__voxelHeroes;window.__rootglassText=[];h.game.ui.requestUi();h.render();
              return {...h.game.ui.uiView(),hud:h.game.hud.hudView(),prompts:h.game.promptHud.promptView(),runs:window.__rootglassText,goal:h.game.objective.objectiveHudText(),objectiveId:h.game.objective.objectiveId(),heroVisible:h.player.hero.root.visible};
            });
            const center=data.hud.widgets.filter(r=>r.region==='center'),reserved=[...data.hud.widgets.filter(r=>r.region!=='center'),...data.hits.filter(r=>['party-open','journal-open'].includes(r.id))];
            const collisions=center.flatMap(a=>reserved.filter(b=>overlaps(a,b)).map(b=>[a.id,b.id]));
            const promptCollisions=center.flatMap(a=>data.prompts.filter(b=>overlaps(a,{...b,h:16})).map(b=>[a.id,b.id]));
            const escapes=data.runs.filter(r=>r.x<0||r.y<0||r.x+r.w>data.w||r.y+r.h>data.h);
            const queenRect=center.find(r=>r.id==='amber-queen-progress');
            const queenText=queenRect?data.runs.filter(r=>r.x>=queenRect.x&&r.y>=queenRect.y&&r.x+r.w<=queenRect.x+queenRect.w&&r.y+r.h<=queenRect.y+queenRect.h).map(r=>r.text).join(' '):'';
            result.layouts.push({label,...data,collisions,promptCollisions,escapes});
            check(!collisions.length,`${label}: center widgets clear side controls`,collisions);
            check(!promptCollisions.length,`${label}: center widgets clear actual action prompts`,promptCollisions);
            check(!escapes.length,`${label}: every text run fits the canvas`,escapes);
            check(data.heroVisible,`${label}: settled native hero is visible`);
            check(center.some(r=>r.id==='amber-queen-progress')===!!stage.phase,`${label}: Queen status is present exactly in the active arena`);
            const phaseWords={flipped:['Overturned','Flip','F4s'],rest:['Open','Hit'],volley:['Amber volley','Volley','Dodge'],gather:['Landing','Land'],flight:['Folded','Fly']};
            check(stage.phase?phaseWords[stage.phase].some(word=>queenText.includes(word))
              :data.objectiveId===(stage.complete?'hive-homecoming':stage.seals?'hive-pressure-'+stage.seals:'hive-nursery-guards'),`${label}: actual stage direction and Queen phase are visible`,data.objectiveId);
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
  console.log(`PASS ${result.checks.length} Rootglass HUD checks, ${result.captures.length} settled images.`);
}catch(e){result.ok=false;result.error={message:e.message,stack:e.stack};console.error(e.stack);process.exitCode=1;}
finally{result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));}
