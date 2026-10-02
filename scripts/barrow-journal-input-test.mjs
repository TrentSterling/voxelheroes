import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {CHROMIUM_ARGS} from './playtest.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/barrow-journal-input';
const url=process.argv.find(a=>a.startsWith('--url='))?.slice(6)??'http://127.0.0.1:5173/';
mkdirSync(out,{recursive:true});
const report={utc:new Date().toISOString(),ok:false,checks:[],fixture:'Muted browser; new-game and journal state APIs choose the task. Actual mouse, touch and keyboard input test task edges, pagination and Close.'};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
try{
 for(const [name,width,height,touch]of[['desktop',1280,720,false],['phone',320,568,true],['landscape',568,320,true]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:touch,isMobile:touch});
  try{
   await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
   await page.goto(new URL('?manual=1',url).href);await page.waitForFunction(()=>window.__voxelHeroes?.game?.journal);
   await page.evaluate(()=>{const h=window.__voxelHeroes;h.game.progress.startNewGame({prologue:false});h.game.audio.setMuted(true);h.game.audio.setVolumes({master:0});h.game.settings.setSetting('npcVoices',false);h.game.journal.openJournal();h.render();});
   if(touch)assert.equal(await page.locator('#touch').isVisible(),false,'Touch gameplay controls yield to the journal');
   const click=async(id,edge=false)=>{
    const p=await page.evaluate(({id,edge})=>{const h=window.__voxelHeroes;h.render();const v=h.game.ui.uiView(),r=v.hits.find(r=>r.id===id);if(!r)return null;return{x:(r.x+r.w/2)*v.scale,y:(edge?r.y+r.h-.2:r.y+r.h/2)*v.scale};},{id,edge});
    assert.ok(p,`${name}: ${id} exists`);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);
    await page.evaluate(()=>window.__voxelHeroes.render());
   };
   if(!touch){await click('journal-task-0',true);assert.equal(await page.evaluate(()=>window.__voxelHeroes.game.journal.journalView().selected),0);report.checks.push(name+': actual mouse selects the lower edge of the intended task, not its neighbor');}
   await click('journal-next');assert.equal(await page.evaluate(()=>window.__voxelHeroes.game.journal.journalView().selected),1);
   await click('journal-prev');assert.equal(await page.evaluate(()=>window.__voxelHeroes.game.journal.journalView().selected),0);
   report.checks.push(name+': actual '+(touch?'touch':'mouse')+' task navigation works');
   if(name==='landscape'){
    await page.evaluate(()=>{const h=window.__voxelHeroes;for(let i=0;i<20;i++){h.render();const v=h.game.journal.journalView();if(v.entries[v.selected].title==='The Note Beneath')break;h.game.ui.pressUi('journal-next');}h.render();});
    assert.ok(await page.evaluate(()=>window.__voxelHeroes.game.journal.journalView().detailPages>1));
    const before=await page.evaluate(()=>window.__voxelHeroes.game.journal.journalView());
    await click('journal-detail-next');let after=await page.evaluate(()=>window.__voxelHeroes.game.journal.journalView());assert.equal(after.detailPage,1);assert.notEqual(after.shownDetail,before.shownDetail);
    report.checks.push(name+': actual touch reads the next paragraph page');
    const expectedPage=(after.detailPage+1)%after.detailPages;
    assert.equal(await page.evaluate(()=>window.__voxelHeroes.input.pressed('menu')),false,'Read must not also press the underlying Pause control');
    await page.keyboard.down('KeyJ');
    assert.ok(await page.evaluate(()=>window.__voxelHeroes.input.pressed('confirm')),'The real keyboard event reaches confirm');
    await page.evaluate(async()=>{await window.__voxelHeroes.tick();window.__voxelHeroes.render();});await page.keyboard.up('KeyJ');
    after=await page.evaluate(()=>window.__voxelHeroes.game.journal.journalView());assert.equal(after.detailPage,expectedPage,JSON.stringify({expectedPage,after,mode:await page.evaluate(()=>window.__voxelHeroes.state.mode)}));
    report.checks.push(name+': actual keyboard confirm cycles the paragraph pages');
   }
   await page.screenshot({path:`${out}/${name}-journal.png`});
   await click('journal-close');assert.equal(await page.evaluate(()=>window.__voxelHeroes.state.mode),'play');
   report.checks.push(name+': actual Close input returns to play');
  }finally{await page.close();}
 }
 report.ok=true;console.log('PASS '+report.checks.length+' journal mouse, touch and keyboard checks at desktop, portrait and landscape');
}catch(error){report.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{await browser.close();writeFileSync(`${out}/result.json`,JSON.stringify(report,null,2));}
