import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { CHROMIUM_ARGS } from './playtest.mjs';

const game=resolve('dist'),site=resolve('../portfolio-site'),out=resolve('playtest-out/portfolio-final');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const isGame=pathname.startsWith('/voxelheroes/');
  const root=isGame?game:site;
  const file=resolve(root,'.'+(isGame?pathname.slice('/voxelheroes'.length):pathname)+(pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(root)||!existsSync(file)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(readFileSync(file));
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,args:CHROMIUM_ARGS});
const checks=[];
try {
  const page=await browser.newPage();
  await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  for(const [label,width,height] of [['desktop',1440,1000],['phone',390,844]]){
    await page.setViewportSize({width,height});
    await page.goto(base+'/games/');
    const card=page.locator('a.item[href="https://tront.xyz/voxelheroes/"]');
    assert.equal(await card.count(),1);
    await card.scrollIntoViewIfNeeded();
    await card.locator('img').evaluate(img=>img.decode());
    const result=await card.evaluate(el=>({image:el.querySelector('img').getAttribute('src'),w:el.querySelector('img').naturalWidth,h:el.querySelector('img').naturalHeight,text:el.innerText,overflow:el.scrollWidth>el.clientWidth}));
    assert.equal(result.w,1200);assert.equal(result.h,630);assert.equal(result.overflow,false);assert.match(result.text,/Co-op/);
    await page.screenshot({path:resolve(out,`games-${label}.png`)});
    await card.screenshot({path:resolve(out,`card-${label}.png`)});
    checks.push({label,...result});
  }
  await page.goto(base+'/voxelheroes/');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://tront.xyz/voxelheroes/');
  const schema=JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  assert.ok(schema.playMode.includes('CoOp'));
  await page.locator('#trontAbout summary').click();
  assert.ok(await page.locator('#trontAbout>div').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
  await page.screenshot({path:resolve(out,'game-about-phone.png')});
  const smoke=await promisify(execFile)(process.execPath,['scripts/browser-smoke.mjs',`--url=${base}/voxelheroes/`,'--local-signaling'],{timeout:180000,maxBuffer:1024*1024});
  writeFileSync(resolve(out,'browser-smoke.log'),smoke.stdout+smoke.stderr);
  console.log(smoke.stdout);
  const hash=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
  writeFileSync(resolve(out,'website-check.json'),JSON.stringify({utc:new Date().toISOString(),checks,schema,ogSHA256:hash(resolve(game,'og-image.png')),cardSourceSHA256:hash(resolve(site,'games/index.html')),browserSmoke:smoke.stdout},null,2));
  const captures=JSON.parse(readFileSync(resolve(out,'receipts.json'))).captures;
  const gallery=captures.map(c=>`<figure><a href="${c.clean.file}"><img src="${c.clean.file}" alt="${c.state.screenName}"></a><figcaption>${c.state.screenName} · fresh game capture, HUD hidden</figcaption></figure>`).join('');
  writeFileSync(resolve(out,'index.html'),`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Voxel Heroes: refreshed portfolio captures</title><style>body{margin:32px auto;max-width:1200px;padding:0 16px;background:#151719;color:#eee;font:16px system-ui}figure{margin:30px 0}img{width:100%;height:auto}a{color:#abe083}figcaption{padding:10px 0}</style><h1>Voxel Heroes: refreshed captures</h1><p>September 30, 2026. Real game frames with location/profile fixtures; HUD hidden for clean images. Originals and SHA-256 receipts are preserved alongside this gallery.</p>${gallery}<h2>Portfolio card</h2><img src="card-desktop.png" style="max-width:460px"><p><a href="receipts.json">Capture receipts</a> · <a href="website-check.json">Website checks</a></p>`);
  console.log('PASS portfolio card desktop + phone; metadata; About bounds; browser startup and party UI.');
} finally {await browser.close();server.close();}
