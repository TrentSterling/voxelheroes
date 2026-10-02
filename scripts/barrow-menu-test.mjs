import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {CHROMIUM_ARGS} from './playtest.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/barrow-menu';
const url=process.argv.find(a=>a.startsWith('--url='))?.slice(6)??'http://127.0.0.1:5173/';
mkdirSync(out,{recursive:true});
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]);
const files=[...walk('src'),...walk('public/voices'),'index.html','package.json','package-lock.json'].sort(),fingerprint=createHash('sha256');
for(const f of files){fingerprint.update(f+'\0');fingerprint.update(readFileSync(f));}
const result={utc:new Date().toISOString(),ok:false,sourceSha256:fingerprint.digest('hex'),checks:[],fixture:'Saved late-game title fixture; actual canvas text metrics, About DOM bounds and real mouse/touch party navigation. Muted browser and disabled game audio.'};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
try{
 for(const [name,width,height,touch]of[['desktop',1280,720,false],['phone',320,568,true],['landscape',568,320,true]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch});
  try{
   await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   await page.goto(new URL('?manual=1',url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.journal);
   await page.evaluate(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);const g=h.game.ui.g,text=g.text,panel=g.panel,button=g.button;window.__menuText={runs:[],panels:[],parent:null,party:false};g.panel=function(x,y,w,height,opts){const c=window.__menuText,p={x,y,w,h:height};c.panels.push(p);if(opts?.accent)c.parent=p;return panel.call(this,x,y,w,height,opts);};g.button=function(id,...args){const c=window.__menuText;c.party=id==='party-open';const r=button.call(this,id,...args);c.party=false;return r;};g.text=function(value,x,y,o={}){const c=window.__menuText,w=g.measure(String(value),o.size??1,o.tracking??0),left=o.align==='center'?x-w/2:o.align==='right'?x-w:x;c.runs.push({text:String(value),x:left,y,w,h:g.cap*(o.size??1),parent:c.parent,party:c.party});return text.call(this,value,x,y,o);};});
   await page.evaluate(()=>{const h=window.__voxelHeroes;h.teleport('d4:3,1',8,7);h.game.saves.saveSlot(1);h.newGame();h.render();});
   const capture=async(state)=>{
    const d=await page.evaluate(()=>{const h=window.__voxelHeroes,c=window.__menuText;c.runs=[];c.panels=[];c.parent=null;h.game.ui.requestUi();h.render();const v=h.game.ui.uiView(),el=document.querySelector('.tront-about>summary'),r=el?.getBoundingClientRect();return{...v,runs:c.runs,panels:c.panels,about:r&&r.width&&r.height?{x:r.x/v.scale,y:r.y/v.scale,w:r.width/v.scale,h:r.height/v.scale}:null};});
    const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
    for(const p of d.panels)assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=d.w&&p.y+p.h<=d.h,`${name}/${state}: panel in bounds ${JSON.stringify(p)}`);
    for(const r of d.runs)assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=d.w&&r.y+r.h<=d.h,`${name}/${state}: text in bounds ${r.text}`);
    const party=d.hits.find(h=>h.id==='party-open');
    if(party)for(const r of d.runs.filter(r=>r.parent&&!r.party))assert.equal(overlap(r,party),false,`${name}: party button clears title text ${r.text}`);
    if(d.about)for(const r of d.runs.filter(r=>r.parent))assert.equal(overlap(r,d.about),false,`${name}: About badge clears title text ${r.text}`);
    result.checks.push({name,state,textRuns:d.runs.length,partyClear:true,aboutClear:true,panelsInBounds:true});await page.screenshot({path:`${out}/${name}-${state}.png`});
   };
   const click=async id=>{const p=await page.evaluate(id=>{const v=window.__voxelHeroes.game.ui.uiView(),h=v.hits.find(h=>h.id===id);return h?{x:(h.x+h.w/2)*v.scale,y:(h.y+h.h/2)*v.scale}:null;},id);assert.ok(p,id);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);};
   await capture('saved-title');await click('party-open');assert.equal(await page.evaluate(()=>window.__voxelHeroes.state.mode),'party');
   if(touch)assert.equal(await page.locator('#touch').isVisible(),false,'Touch gameplay controls yield to the party menu');
   await capture('party-entry');
   await click('party-close');assert.equal(await page.evaluate(()=>window.__voxelHeroes.state.mode),'title');
   result.checks.push({name,state:'actual-party-navigation',touch,returnedToTitle:true});
  }finally{await page.close();}
 }
 result.ok=true;console.log('PASS '+result.checks.length+' title/party layout and actual navigation checks across desktop, portrait and landscape');
}catch(error){result.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{await browser.close();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));}
