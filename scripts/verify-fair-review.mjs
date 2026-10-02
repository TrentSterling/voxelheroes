import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {CHROMIUM_ARGS} from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3);
const out=arg('out')??'playtest-out/fair-final-review-check-20261001',url=arg('url')??'http://127.0.0.1:5173/playtest-out/fair-review/index.html';
mkdirSync(out,{recursive:true});const manifest=JSON.parse(readFileSync('playtest-out/fair-review/manifest.json'));
const result={startedUtc:new Date().toISOString(),manifestSha256:createHash('sha256').update(readFileSync('playtest-out/fair-review/manifest.json')).digest('hex'),checks:[],captures:[],scope:'Muted Chromium review only. Native slideshow navigation and horizontal text bounds measured; no game audio, NPC playback or model generation.'};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
try{
 for(const[name,width,height]of[['desktop',1280,800],['phone',390,844],['landscape',1000,420]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());await page.goto(url);
   for(let i=0;i<manifest.slides.length;i++){
    await page.locator('#photo').evaluate(el=>el.decode());
    const data=await page.evaluate(()=>({title:document.getElementById('title').textContent,count:document.getElementById('count').textContent,overflow:document.documentElement.scrollWidth>innerWidth,bad:[...document.querySelectorAll('h1,p,button,a,span')].filter(el=>{const r=el.getBoundingClientRect();return r.x<0||r.right>innerWidth+.5||el.scrollWidth>el.clientWidth+1;}).map(el=>el.textContent)}));
    assert.equal(data.title,manifest.slides[i].title);assert.equal(data.count,`${i+1} / 12`);assert.equal(data.overflow,false);assert.deepEqual(data.bad,[]);
    result.checks.push(`${name}: slide ${i+1} title, count and horizontal text bounds`);
    if(i===0||i===8||i===11){const file=`${out}/${name}-slide-${i+1}.png`;await page.screenshot({path:file,fullPage:true});result.captures.push(file);}
    await page.locator('#next').click();
   }
   assert.equal(await page.locator('#count').textContent(),'1 / 12');await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#count').textContent(),'12 / 12');
   result.checks.push(`${name}: next wraps and native keyboard previous works`);assert.deepEqual(errors,[]);result.checks.push(`${name}: no page errors`);
  }finally{await page.close();}
 }
 result.ok=true;console.log(`PASS ${result.checks.length} review checks, ${result.captures.length} silent previews.`);
}catch(error){result.ok=false;result.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error.stack);}
finally{await browser.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));}
