import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {CHROMIUM_ARGS} from './playtest.mjs';
const arg=n=>process.argv.find(a=>a.startsWith(`--${n}=`))?.slice(n.length+3),folder=arg('review')??'stone-eye-review';
assert.match(folder,/^[a-z0-9_-]+$/i);
const out=arg('out')??`playtest-out/${folder}-check`,url=arg('url')??`http://127.0.0.1:5173/playtest-out/${folder}/index.html`,file=`playtest-out/${folder}/manifest.json`;
mkdirSync(out,{recursive:true});const manifest=JSON.parse(readFileSync(file)),n=manifest.slides.length;
const result={startedUtc:new Date().toISOString(),manifestSha256:createHash('sha256').update(readFileSync(file)).digest('hex'),checks:[],captures:[],scope:'Muted Chromium slideshow only. Native next, wrap and keyboard previous, image decoding and horizontal text bounds at desktop, portrait and short landscape. No game or audio playback.'};
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
try{
 for(const[name,width,height]of[['desktop',1280,800],['phone',390,844],['landscape',1000,420]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  try{
   page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());await page.goto(url);
   for(let i=0;i<n;i++){
    await page.locator('#photo').evaluate(e=>e.decode());
    const d=await page.evaluate(()=>({title:document.getElementById('title').textContent,count:document.getElementById('count').textContent,overflow:document.documentElement.scrollWidth>innerWidth,bad:[...document.querySelectorAll('h1,p,a,button,span')].filter(e=>{const r=e.getBoundingClientRect();return r.x<0||r.right>innerWidth+.5||e.scrollWidth>e.clientWidth+1;}).map(e=>e.textContent)}));
    assert.equal(d.title,manifest.slides[i].title);assert.equal(d.count,`${i+1} / ${n}`);assert.equal(d.overflow,false);assert.deepEqual(d.bad,[]);result.checks.push(`${name}: slide ${i+1} title, count, image decode and text bounds`);
    if([0,Math.floor(n/2),n-1].includes(i)){const f=`${out}/${name}-slide-${i+1}.png`;await page.screenshot({path:f,fullPage:true});result.captures.push(f);}
    await page.locator('#next').click();
   }
   assert.equal(await page.locator('#count').textContent(),`1 / ${n}`);await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#count').textContent(),`${n} / ${n}`);result.checks.push(`${name}: next wraps and native keyboard previous works`);assert.deepEqual(errors,[]);result.checks.push(`${name}: no page errors`);
  }finally{await page.close();}
 }
 result.ok=true;console.log(`PASS ${result.checks.length} review checks and ${result.captures.length} silent previews.`);
}catch(e){result.ok=false;result.error={message:e.message,stack:e.stack};process.exitCode=1;console.error(e.stack);}
finally{await browser.close();result.completedUtc=new Date().toISOString();writeFileSync(`${out}/result.json`,JSON.stringify(result,null,2));}
