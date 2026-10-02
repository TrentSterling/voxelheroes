import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {CHROMIUM_ARGS} from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const url=arg('url')??'http://127.0.0.1:5173/',out=arg('out')??'playtest-out/reward-shield-touch';mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],captures:[],fixtures:'Muted headless Chromium at 320x568 and 568x320, normal and large text. Safe placement and catalog grants isolate reward framing; actual CDP guard touch verifies the held and lowered single mesh. Native NPC reward conversations are covered separately.'};
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
try {
 for(const[name,width,height]of[['phone',320,568],['landscape',568,320]])for(const large of[false,true]) {
  const label=`${name}-${large?'large':'normal'}`,page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true}),errors=[];
  try {
   page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   await page.goto(new URL('?manual=1&seed=17',url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.ui);
   await page.evaluate(async large=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.settings.setSetting('largeText',large);h.teleport('v1:1,1',8.5,9.5);await h.step(3);h.player.invT=0;},large);
   for(const id of['blade-start','boots-dash','shield-6','ring-half','heart-piece','magic-container','spell-truesight','bomb-bag-2']) {
    await page.evaluate(async id=>{const h=window.__voxelHeroes;h.game.grants.grant(id,1,{source:'touch-reward-fixture'});await h.step(.3);},id);await page.waitForTimeout(450);
    const v=await page.evaluate(()=>{
      const h=window.__voxelHeroes,p=h.gfx.scene.getObjectByName('item-prize');h.game.ui.requestUi();h.render();
      const points=[];p.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;
        for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z]){const v=h.gfx.camera.position.clone().set(x,y,z).applyMatrix4(o.matrixWorld).project(h.gfx.camera);points.push({x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2});}
      });
      const figure=h.player.hero.figure;figure.geometry.computeBoundingBox();const body=figure.geometry.boundingBox,bodyPoints=[];
      for(const x of[body.min.x,body.max.x])for(const y of[body.min.y,body.max.y])for(const z of[body.min.z,body.max.z]){const v=h.gfx.camera.position.clone().set(x,y,z).applyMatrix4(figure.matrixWorld).project(h.gfx.camera);bodyPoints.push({x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2});}
      return{grant:p.userData.grant,pose:h.player.hero.pose(),shield:!!h.player.guardShield.parent,hero:{left:Math.min(...bodyPoints.map(p=>p.x)),right:Math.max(...bodyPoints.map(p=>p.x)),top:Math.min(...bodyPoints.map(p=>p.y)),bottom:Math.max(...bodyPoints.map(p=>p.y))},prize:{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))},banner:h.game.banner.bannerView(),ui:h.game.ui.uiView()};
    });
    const file=`${out}/${label}-${id}.png`;await page.screenshot({path:file});result.captures.push(file);
    check(v.grant===id&&v.pose==='cheer'&&!v.shield,`${label}/${id}: actual prize replaces carried equipment`);
    check(v.prize.left>=0&&v.prize.right<=width&&v.prize.top>=0&&v.prize.bottom<=height,`${label}/${id}: the entire reward including glints is on screen ${JSON.stringify(v.prize)}`);
    check(v.hero.left>=0&&v.hero.right<=width&&v.hero.top>=0&&v.hero.bottom<=height,`${label}/${id}: the entire hero including feet is on screen ${JSON.stringify(v.hero)}`);
    check(v.banner.visible&&v.banner.layout.length>0&&v.banner.layout.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=v.ui.w+.5&&r.y+r.h<=v.ui.h+.5),`${label}/${id}: reward caption fits the native canvas`);
    check(v.banner.layout.every(r=>{const p=v.prize,sx=width/v.ui.w,sy=height/v.ui.h;return !(r.x*sx<p.right&&(r.x+r.w)*sx>p.left&&r.y*sy<p.bottom&&(r.y+r.h)*sy>p.top);}),`${label}/${id}: the caption does not cover the held model`);
    await page.evaluate(()=>window.__voxelHeroes.step(2));
   }
   // Captions use wall time while the manual simulation uses explicit ticks.
   // Wait for the native reward caption to return the touch controls.
   await page.waitForTimeout(2100);
   await page.evaluate(()=>{const h=window.__voxelHeroes;h.player.setFacing('south');h.state.gear.shield=1;});await page.evaluate(()=>window.__voxelHeroes.step(.1));
   const cdp=await page.context().newCDPSession(page),b=await page.locator('#btn-guard').boundingBox();assert.ok(b);
   const original=await page.evaluate(()=>window.__voxelHeroes.player.guardShield.uuid);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});await page.evaluate(()=>window.__voxelHeroes.step(.15));
   check(await page.evaluate(id=>{const h=window.__voxelHeroes,p=h.player;return p.guarding&&p.guardShield.uuid===id&&!!p.guardShield.parent&&p.guardShield.position.x<0;},original),`${label}: physical touch raises the same shield`);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.evaluate(()=>window.__voxelHeroes.step(.15));
   check(await page.evaluate(id=>{const p=window.__voxelHeroes.player;return !p.guarding&&p.guardShield.uuid===id&&!!p.guardShield.parent&&p.guardShield.position.x>.2;},original),`${label}: touch release lowers the same shield`);
   check(!errors.length,`${label}: no game exceptions`);
  }finally{await page.close();}
 }
 result.ok=true;
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{await browser.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));console.log(`Reward touch: ${result.checks.length} checks, ${result.captures.length} images, ok=${result.ok}`);}
