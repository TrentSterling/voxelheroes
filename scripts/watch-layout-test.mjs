import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { CHROMIUM_ARGS, startServer } from './playtest.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/watch-layout';
const url=process.argv.find(a=>a.startsWith('--url='))?.slice(6);
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);
const fp=createHash('sha256');for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
mkdirSync(out,{recursive:true});
const report={utc:new Date().toISOString(),ok:false,sourceSha256:fp.digest('hex'),checks:[],captures:[],fixture:'Muted Chromium. Actual sword-opened tablets, every authored paragraph paged with real mouse/touch, item-get message, and sentry warning HUD at both text sizes. Campaign, enemy kills and positions are fixtures. Canvas text/panel bounds and HUD controls measured; no audio playback.'};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});let server;
try {
  server=url?{url,close:async()=>{}}:await startServer();
  for(const[name,width,height,touch]of[['desktop',1280,720,false],['phone',320,568,true],['landscape',568,320,true]]){
    const page=await browser.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
      await page.goto(new URL('?manual=1',server.url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.ui);
      await page.evaluate(()=>{
        const h=window.__voxelHeroes,g=h.game.ui.g,text=g.text,panel=g.panel;
        h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.state.flags.add('overworld:talked:king');for(const id of['d1','d2']){h.state.flags.add(`dungeon:${id}:entered`);h.game.dungeons.giveBossKey(id);h.game.dungeons.defeatBoss(id);h.game.dungeons.completeDungeon(id);}h.game.dungeons.giveMap('d3');h.game.inventory.giveItem('grapple');h.player.invT=999;
        window.__watchText={runs:[],panels:[],parent:null};
        g.panel=function(x,y,w,height,o){const c=window.__watchText,p={x,y,w,h:height};c.panels.push(p);if(o?.accent)c.parent=p;return panel.call(this,x,y,w,height,o);};
        g.text=function(value,x,y,o={}){const c=window.__watchText,w=g.measure(String(value),o.size??1,o.tracking??0);c.runs.push({text:String(value),x:o.align==='center'?Math.round(x-w/2):o.align==='right'?x-w:x,y,w,h:g.cap*(o.size??1),parent:c.parent});return text.call(this,value,x,y,o);};
      });
      const check=(pass,label)=>{assert.ok(pass,name+': '+label);report.checks.push(name+': '+label);console.log('PASS '+name+': '+label);};
      const capture=async label=>{
        const data=await page.evaluate(()=>{const h=window.__voxelHeroes,c=window.__watchText;c.runs=[];c.panels=[];c.parent=null;h.game.ui.requestUi();h.player.hero.root.visible=true;h.render();const v=h.game.ui.uiView(),controls=[...document.querySelectorAll('#stick,.touch-buttons,.touch-menu')].filter(e=>getComputedStyle(e).visibility!=='hidden'&&e.getBoundingClientRect().width).map(e=>{const r=e.getBoundingClientRect();return{x:r.x/v.scale,y:r.y/v.scale,w:r.width/v.scale,h:r.height/v.scale};});return{...v,mode:h.state.mode,hud:h.game.hud.hudView(),banner:h.game.banner.bannerView(),controls,...c};});
        const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
        const bad=data.runs.filter(r=>r.x<0||r.y<0||r.x+r.w>data.w||r.y+r.h>data.h||r.parent&&r.y>=r.parent.y&&(r.x<r.parent.x+2||r.x+r.w>r.parent.x+r.parent.w-2||r.y+r.h>r.parent.y+r.parent.h));
        const panels=data.panels.filter(p=>p.x<0||p.y<0||p.x+p.w>data.w||p.y+p.h>data.h),collisions=[];
        if(data.mode==='play')for(const objective of data.hud.widgets.filter(r=>r.id==='objective'))for(const other of[...data.hud.widgets.filter(r=>r.id!=='objective'),...data.hits.filter(r=>['party-open','journal-open'].includes(r.id))])if(overlap(objective,other))collisions.push([objective.id,other.id]);
        if(label.endsWith('sun-dial-prize'))for(const line of data.banner.layout)for(const control of data.controls)if(overlap(line,control))collisions.push(['reward-caption','touch-control']);
        report.captures.push({label:name+'-'+label,w:data.w,h:data.h,violations:bad,panels,collisions});assert.deepEqual(bad,[],name+': '+label+' text bounds');assert.deepEqual(panels,[],name+': '+label+' panel bounds');assert.deepEqual(collisions,[],name+': '+label+' HUD controls');await page.screenshot({path:`${out}/${name}-${label}.png`});
      };
      const clickDialog=async()=>{
        const p=await page.evaluate(()=>{const h=window.__voxelHeroes;h.render();const v=h.game.ui.uiView(),r=v.hits.find(r=>r.id==='dialog');return r?{x:(r.x+r.w/2)*v.scale,y:(r.y+r.h/2)*v.scale}:null;});assert.ok(p,'Dialogue touch target exists');if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.evaluate(()=>window.__voxelHeroes.tick());
      };
      for(const large of[false,true]){
        const size=large?'large':'normal';await page.evaluate(large=>{window.__voxelHeroes.state.settings.largeText=large;},large);
        for(const[key,label,x,z]of[['d3:2,3','vestibule',4.5,5.5],['d3:2,7','landing',3.5,4.5],['sunreach:2,3','meridian',5.5,4.5]]){
          await page.evaluate(async([key,x,z])=>{const h=window.__voxelHeroes;h.teleport(key,x,z);h.player.invT=999;await h.step(1.5);for(const e of [...h.entities])if(e.kind==='enemy'||e.kind==='projectile')e.remove();h.game.hero.hero.setFacing('north');h.input.tap('sword');await h.tick();},[key,x,z]);
          check(await page.evaluate(()=>window.__voxelHeroes.state.mode==='dialog'),'Real sword opens '+label+' in '+size+' text');
          const authored=await page.evaluate(()=>{const s=window.__voxelHeroes.screen();return s.def.tablet??s.def.signs['5,3'];}),seen=authored.map(()=>[]);let count=0;
          for(;count<80;count++){
            if(!await page.evaluate(()=>window.__voxelHeroes.game.dialog.dialogView()))break;
            await clickDialog();const v=await page.evaluate(()=>window.__voxelHeroes.game.dialog.dialogView());assert.ok(v,'Revealing text keeps the tablet open');seen[v.page].push(v.shown);await capture(size+'-'+label+'-'+count);await clickDialog();
          }
          check(count<80&&authored.every((line,i)=>seen[i].join('')===line),'Every '+label+' paragraph is complete through '+(touch?'touch':'mouse')+' in '+size+' text');
        }
        await page.evaluate(async()=>{const h=window.__voxelHeroes;h.teleport('d3:1,7',8.5,4.5);await h.step(.5);for(const e of [...h.entities])if(e.kind==='enemy')e.die();h.state.inventory.owned=h.state.inventory.owned.filter(id=>id!=='sun-dial');h.game.grants.grant('sun-dial');h.render();});
        await capture(size+'-sun-dial-prize');check(await page.evaluate(()=>window.__voxelHeroes.game.inventory.hasItem('sun-dial')),'The Sun Dial prize fits '+size+' text');
        await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);
        await page.evaluate(()=>{const h=window.__voxelHeroes;h.game.ui.requestUi();h.render();});
        check(await page.evaluate(()=>!document.body.classList.contains('reward-caption')),'The touch controls return after the '+size+' reward caption expires');
        await page.evaluate(async()=>{const h=window.__voxelHeroes;await h.step(4);h.teleport('d3:3,6',5.5,8.5);h.player.invT=999;await h.step(1.4);});
        for(let i=0;i<250;i++){if(await page.evaluate(()=>window.__voxelHeroes.entities.some(e=>e.type==='watch-sentinel'&&e.cue.visible)))break;await page.evaluate(()=>window.__voxelHeroes.step(.05));}
        await capture(size+'-sentry-hud');check(await page.evaluate(()=>window.__voxelHeroes.entities.some(e=>e.type==='watch-sentinel'&&e.cue.visible)),'A real sentry warning fits the '+size+' HUD');
      }
      assert.deepEqual(errors,[]);check(true,'No page errors');
    }finally{await page.close();}
  }
  report.ok=true;
}catch(error){report.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{await browser.close();await server?.close();report.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(report,null,2));}
