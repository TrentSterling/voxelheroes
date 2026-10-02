import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const layoutOnly = process.argv.includes('--layout-only');
const out = process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? (layoutOnly ? 'playtest-out/voice-review-layout' : 'playtest-out/voice-review'); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
const result = { at: new Date().toISOString(), layoutOnly, checks: [], requestsBeforePlayback: [], media: [], screenshots: [] };
try {
  for (const [label, path] of [['library','voice-review'],['slides','voice-cast-20260930']]) {
    const page = await browser.newPage(), errors = [], voiceRequests = [];
    if (layoutOnly) {
      await page.route('**/*.opus', route => route.abort());
      await page.addInitScript(() => { HTMLMediaElement.prototype.play = function () { throw new Error('Playback is disabled in the layout-only review'); }; });
    }
    page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (r.url().includes('/voices/')) voiceRequests.push(r.url()); });
    await page.goto(`http://127.0.0.1:5173/playtest-out/${path}/index.html`);
    for (const [size,width,height] of [['desktop',1280,720],['phone',320,568],['landscape',568,320]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(150);
      const bounds = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, images: [...document.images].every(i => i.complete && i.naturalWidth > 0), imageHeight: document.querySelector('#photo')?.getBoundingClientRect().height ?? null }));
      assert.ok(bounds.scroll <= bounds.width); assert.ok(bounds.images);
      if (label === 'slides') assert.ok(bounds.imageHeight >= 140, 'Cast photo remains readable in short landscape windows');
      const file = `${label}-${size}.png`; await page.screenshot({ path: `${out}/${file}`, fullPage: layoutOnly && label === 'slides' });
      result.checks.push({ label, size, ...bounds }); result.screenshots.push(file);
    }
    if (label === 'library') {
      assert.equal(voiceRequests.length,0); result.requestsBeforePlayback.push(...voiceRequests);
      await page.locator('#speaker').selectOption('Mira'); assert.ok((await page.locator('#stats').textContent()).includes('matching recordings'));
      if (layoutOnly) {
        await page.locator('#search').fill('thirteen'); assert.equal(await page.locator('audio').count(),1);
        result.media.push({ label, search: true, playbackAttempted: false });
      } else {
      await page.locator('h1').click(); await page.locator('audio').first().evaluate(a => a.play());
      await page.waitForFunction(() => document.querySelector('audio').currentTime > .1);
      assert.equal(voiceRequests.length,1);
      await page.locator('audio').nth(1).evaluate(a => a.play());
      assert.ok(await page.locator('audio').first().evaluate(a => a.paused));
      await page.locator('#search').fill('thirteen'); assert.equal(await page.locator('audio').count(),1);
      result.media.push({ label, lazyRequests: voiceRequests.length, singleSpeaker: true, search: true });
      }
    } else {
      assert.equal(await page.locator('#count').textContent(),'1 / 8');
      await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('#count').textContent(),'2 / 8');
      await page.locator('#prev').click(); assert.equal(await page.locator('#count').textContent(),'1 / 8');
      if (layoutOnly) result.media.push({ label, keyboardNavigation: true, buttonNavigation: true, playbackAttempted: false });
      else {
      await page.locator('#speech').evaluate(a => a.play()); await page.waitForFunction(() => document.querySelector('audio').currentTime > .1);
      await page.locator('#next').click(); assert.ok(await page.locator('#speech').evaluate(a => a.paused));
      result.media.push({ label, keyboardNavigation: true, buttonNavigation: true, embeddedMediaPlays: true, stopOnNext: true });
      }
    }
    assert.deepEqual(errors,[]); await page.close();
  }
  result.ok = true; console.log(layoutOnly ? 'PASS voice review layout: desktop/phone/landscape bounds, readable photos, filtering and navigation; playback disabled' : 'PASS voice reviews: desktop/phone/landscape bounds, lazy loading, filtering, exclusive playback, embedded audio and slide navigation');
} catch (e) { result.ok = false; result.error = { message: e.message, stack: e.stack }; console.error(e.stack); process.exitCode = 1; }
finally { writeFileSync(`${out}/check.json`, JSON.stringify(result, null, 2)); await browser.close(); }
