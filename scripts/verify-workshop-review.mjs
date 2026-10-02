import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { CHROMIUM_ARGS } from './playtest.mjs';
const out=process.argv[2]??'playtest-out/workshop-review',manifest=JSON.parse(readFileSync(`${out}/manifest.json`));
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS}),checks=[];
try{
 const page=await browser.newPage();await page.setContent(readFileSync(`${out}/index.html`,'utf8'));
 for(const [width,height]of[[1280,720],[320,568],[844,390]]){
  await page.setViewportSize({width,height});
  for(let i=0;i<manifest.slides.length;i++){
   await page.evaluate(i=>show(i),i);await page.waitForFunction(()=>photo.complete&&photo.naturalWidth>0);
   const slide=manifest.slides[i];assert.equal(createHash('sha256').update(readFileSync(slide.file)).digest('hex'),slide.sha256);
   assert.equal(await page.locator('#title').textContent(),slide.title);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#count').textContent(),`1 / ${manifest.slides.length}`);
  await page.locator('#next').click();assert.equal(await page.locator('#count').textContent(),`2 / ${manifest.slides.length}`);
  await page.screenshot({path:`${out}/review-${width}.png`});checks.push({width,height,slides:manifest.slides.length,hashes:true,images:true,navigation:true,noHorizontalOverflow:true});
 }
 writeFileSync(`${out}/check.json`,JSON.stringify({utc:new Date().toISOString(),checks},null,2));
 console.log(`PASS ${manifest.slides.length} slideshow images and receipt hashes, keyboard/buttons, and three viewport layouts.`);
}finally{await browser.close();}
