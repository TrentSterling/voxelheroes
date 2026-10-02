import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {CHROMIUM_ARGS} from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const url=arg('url')??'http://127.0.0.1:5173/',out=arg('out')??'playtest-out/barrow-path-touch';
assert.ok(!existsSync(`${out}/result.json`),'Choose a fresh receipt folder');mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]),fp=createHash('sha256');
for(const f of [...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort()){fp.update(f.replaceAll('\\','/')+'\0');fp.update(readFileSync(f));}
const result={startedUtc:new Date().toISOString(),sourceSha256:fp.digest('hex'),checks:[],captures:[],scope:'Muted Chromium touch portrait 320x568 and landscape 568x320, normal and large text. Native HUD directions, room hints and feedback bounds; actual CDP touch A denies and then restores hourstone hearts/magic. Room positions, progress flags, equipment, stationary harmless enemies, initial health/magic and damage-API clearing are disclosed fixtures.'};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
const check=(ok,label)=>{assert.ok(ok,label);result.checks.push(label);console.log('PASS '+label);};
try {
  for(const[name,width,height]of[['phone',320,568],['landscape',568,320]])for(const large of[false,true]) {
    const label=`${name}-${large?'large':'normal'}`,page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true}),errors=[];
    try {
      page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
      await page.goto(new URL('?manual=1',url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.ui);
      await page.evaluate(large=>{const h=window.__voxelHeroes;h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.progress.startNewGame({prologue:false});h.state.settings.largeText=large;h.state.flags.add('overworld:talked:king');h.state.flags.add('dungeon:d1:entered');const g=h.game.ui.g,text=g.text;window.__pathText=[];g.text=function(v,x,y,o={}){const w=g.measure(String(v),o.size??1,o.tracking??0);window.__pathText.push({text:String(v),x:o.align==='center'?Math.round(x-w/2):o.align==='right'?x-w:x,y,w,h:g.cap*(o.size??1)});return text.call(this,v,x,y,o);};},large);
      const cdp=await page.context().newCDPSession(page);
      const touchA=async()=>{const b=await page.locator('#btn-a').boundingBox();assert.ok(b);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});await page.evaluate(()=>window.__voxelHeroes.step(.03));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
      const place=async(key,x,z)=>page.evaluate(async({key,x,z})=>{const h=window.__voxelHeroes;h.teleport(key,x,z);await h.step(1);for(const e of h.entities)if(e.kind==='enemy'){e.think=()=>{};e.harmless=true;}h.game.hero.hero.place(x,z);h.player.hero.root.visible=true;}, {key,x,z});
      const capture=async(id)=>{
        await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);await page.waitForTimeout(250);
        const v=await page.evaluate(()=>{const h=window.__voxelHeroes;window.__pathText=[];h.game.ui.requestUi();h.render();const toast=h.game.toast.toastView();return {...h.game.ui.uiView(),runs:window.__pathText,toast:toast.visible?toast.text:'',objective:h.game.objective.objectiveHudText()};});
        result.layouts??=[];result.layouts.push({label,id,...v});const file=`${out}/${label}-${id}.png`;await page.screenshot({path:file});result.captures.push(file);
        check(v.runs.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=v.w+.5&&r.y+r.h<=v.h+.5),`${label}/${id}: every native text run fits the canvas`);
        const overlaps=v.runs.flatMap((a,i)=>v.runs.slice(i+1).filter(b=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y).map(b=>[a.text,b.text]));
        check(!overlaps.length,`${label}/${id}: no text overlaps ${JSON.stringify(overlaps)}`);
        const all=v.runs.map(r=>r.text).join(' ').replace(/\s+/g,' ');
        check(all.includes(v.objective),`${label}/${id}: the entire short route direction is readable`);
        if(v.toast)check(all.includes(v.toast),`${label}/${id}: complete native rest feedback is readable`);
      };
      await place('d1:3,8',8,8);await capture('map-route');await page.evaluate(()=>window.__voxelHeroes.game.dungeons.giveMap('d1'));
      await place('d1:2,8',12,6);await capture('copper-turn');await page.evaluate(()=>window.__voxelHeroes.state.flags.add('dungeon:d1:door:I-4:n'));
      await place('d1:3,7',8.5,9.5);await capture('pale-bridge');
      await place('d1:4,6',3.5,6.45);await page.evaluate(()=>{const h=window.__voxelHeroes;h.game.hero.hero.setFacing('north');h.setHp(2);h.game.vitals.setMagic(0);});
      await page.waitForFunction(()=>!window.__voxelHeroes.game.banner.bannerView().visible);await touchA();
      check(await page.evaluate(()=>{const h=window.__voxelHeroes;return h.state.hp===2&&h.state.magic===0&&h.game.toast.toastView().text==='Defeat the room guards.';}),`${label}: actual touch A cannot rest through guards`);await capture('hourstone-guarded');
      await page.evaluate(async()=>{const h=window.__voxelHeroes;for(const e of [...h.entities])if(e.kind==='enemy')h.game.damage.dealDamage(e,{amount:999,source:'bomb',from:{x:e.x,z:e.z-2}});await h.step(.2);});await touchA();
      check(await page.evaluate(()=>{const h=window.__voxelHeroes;return h.state.hp===h.state.maxHp&&h.state.magic===h.state.maxMagic;}),`${label}: actual touch A restores hearts and magic`);await capture('hourstone-restored');
      await page.waitForTimeout(2600);await page.evaluate(()=>window.__voxelHeroes.game.inventory.giveItem('boomerang'));
      await place('d1:3,6',5.5,7.5);await capture('single-eye');await page.evaluate(()=>{const h=window.__voxelHeroes;h.state.flags.add('dungeon:d1:keytaken:G-4');h.state.flags.add('dungeon:d1:keytaken:E-3');});
      await place('d1:3,4',8,7);await capture('four-eyes');await page.evaluate(()=>window.__voxelHeroes.game.dungeons.giveBossKey('d1'));
      await place('d1:3,3',4.5,8.45);await capture('last-rest');assert.deepEqual(errors,[]);check(true,`${label}: no browser exceptions`);await cdp.detach();
    }finally{await page.close();}
  }
  result.ok=true;
}catch(e){result.ok=false;result.error={message:e.message,stack:e.stack};process.exitCode=1;console.error(e.stack);}
finally{await browser.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));console.log(`${result.ok?'PASS':'FAIL'} ${result.checks.length} muted touch checks, ${result.captures.length} captures.`);}
