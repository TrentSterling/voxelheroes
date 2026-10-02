import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {launch,CHROMIUM_ARGS} from './playtest.mjs';
import journey from './scenarios/barrow-journey.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/coilmaw-native-phone',url=arg('url')??'http://127.0.0.1:5173/';
assert.ok(!existsSync(`${out}/result.json`),'Preserve existing receipts');mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),scope:'Muted Chromium at 320x568 with real coarse-pointer touch controls. Fresh title-to-Barrow route, actual boss-key doorway and introduction, then ordinary northward movement. No actor, camera, progress, gear, health or invulnerability fixtures. This checks arrival and approach, not a touch-only victory.',checks:[],captures:[]};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});let t;
try{
 t=await launch({url,out,seed:17,viewport:{width:320,height:568},browser:{newContext:opts=>browser.newContext({...opts,hasTouch:true,isMobile:true})}});
 await journey(t);await t.walkTo(8,1.5);await t.stick(0,-1,.5);await t.enter(8,.5);await t.waitFor(s=>s.mode==='boss-intro',{seconds:6});await t.waitFor(s=>s.mode==='play',{seconds:6});await t.step(.5);await t.page.waitForTimeout(6500);
 assert.ok(await t.eval(()=>matchMedia('(pointer: coarse)').matches&&!document.getElementById('touch').hidden));result.checks.push('Native arrival uses actual coarse-pointer touch controls');
 result.arrival=await t.eval(()=>{const h=window.__voxelHeroes;h.game.ui.requestUi();h.render();h.gfx.camera.updateMatrixWorld();const figure=h.player.hero.figure;figure.updateWorldMatrix(true,false);const box=figure.geometry.boundingBox??(figure.geometry.computeBoundingBox(),figure.geometry.boundingBox),cam=h.gfx.camera,points=[];for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){const v=figure.position.clone().set(x,y,z).applyMatrix4(figure.matrixWorld).project(cam);points.push({x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2});}const body={x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))},g=h.game.ui.g,hud=h.game.hud.hudBounds(g).map(r=>({x:r.x/g.w*innerWidth,y:r.y/g.h*innerHeight,w:r.w/g.w*innerWidth,h:r.h/g.h*innerHeight})),pads=['#stick','.touch-buttons','.touch-menu'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};});return{body,obstacles:[...hud,...pads,...h.game.promptHud.promptView().map(r=>({x:r.x/g.w*innerWidth,y:r.y/g.h*innerHeight,w:r.w/g.w*innerWidth,h:16/g.h*innerHeight}))],visible:h.player.hero.root.visible,framing:h.game.partyCamera.partyCameraView()};});
 assert.ok(result.arrival.visible&&result.arrival.body.x>=0&&result.arrival.body.right<=320&&result.arrival.body.y>=0&&result.arrival.body.bottom<=568,'Arriving hero fits inside the phone');assert.ok(result.arrival.obstacles.every(r=>result.arrival.body.x>=r.x+r.w||result.arrival.body.right<=r.x||result.arrival.body.y>=r.y+r.h||result.arrival.body.bottom<=r.y),'Actual hero body clears HUD and touch controls');result.checks.push('Native arrival hero fits between the actual HUD and touch controls');
 await t.shot('01-native-touch-arrival');await t.stick(0,-1,1);await t.shot('02-native-touch-approach');
 result.data=await t.eval(()=>{const h=window.__voxelHeroes;return{snapshot:h.snapshot(),hero:{visible:h.player.hero.root.visible,position:h.player.hero.root.position.toArray()},actors:h.entities.filter(e=>e.type==='boss-serpent'||e.type==='serpent-segment').map(e=>({type:e.type,x:e.x,z:e.z,visible:e.holder.visible,scale:e.holder.scale.toArray(),position:e.holder.position.toArray(),material:{opacity:e.mat.opacity,visible:e.mat.visible}}))};});
 assert.equal(result.data.snapshot.mode,'play');assert.equal(result.data.actors.length,7);result.checks.push('Ordinary movement approaches all seven live Coilmaw parts');assert.deepEqual(t.errors,[]);result.checks.push('No browser exceptions');
 result.assertions=t.log.filter(x=>x.startsWith('ok   ')).length;result.shots=t.shots;result.warnings=t.warnings;result.ok=true;
}catch(e){result.ok=false;result.error={message:e.message,stack:e.stack};process.exitCode=1;console.error(e.stack);}
finally{await t?.close();await browser.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));console.log(`${result.ok?'PASS':'FAIL'} ${result.assertions??0} native assertions and ${result.checks.length} coarse-pointer phone checks.`);}
