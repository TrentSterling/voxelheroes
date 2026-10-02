// Verify the portable review itself, including every embedded screenshot.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = 'playtest-out/review';
const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, 'utf8'));
for (const slide of manifest.slides) assert.equal(
  createHash('sha256').update(readFileSync(slide.path)).digest('hex'), slide.screenshotSha256,
  `Screenshot changed after receipt: ${slide.path}`);
for (const build of manifest.build) assert.equal(
  createHash('sha256').update(readFileSync(build.path)).digest('hex'), build.sha256,
  `Build changed after receipt: ${build.path}`);

for (const receipt of manifest.debuggingReceipts ?? []) {
  assert.equal(createHash('sha256').update(readFileSync(receipt.path)).digest('hex'), receipt.sha256,
    'Development receipt changed: ' + receipt.path);
  assert.equal(createHash('sha256').update(readFileSync(root + '/development-history/' + receipt.path.split('/').at(-1))).digest('hex'), receipt.sha256,
    'Archived development receipt changed: ' + receipt.path);
}

for (const artifact of manifest.artifacts ?? []) assert.equal(
  createHash('sha256').update(readFileSync(artifact.path)).digest('hex'), artifact.sha256,
  'Artifact changed after receipt: ' + artifact.path);
for(const receipt of manifest.inspectionReceipts ?? (manifest.inspectionReceipt?[manifest.inspectionReceipt]:[])){
  for(const path of [receipt.path,root+'/'+receipt.path.split('/').at(-1)])assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),receipt.sha256,'Visual inspection receipt changed: '+path);
  for(const entry of receipt.entries)assert.equal(createHash('sha256').update(readFileSync(entry.path)).digest('hex'),entry.sha256,'Inspected image changed: '+entry.path);
}
if(manifest.textBoundsReceipt)for(const path of [manifest.textBoundsReceipt.path,root+'/text-bounds.json'])assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),manifest.textBoundsReceipt.sha256,'Text-bounds receipt changed: '+path);
if(manifest.npcVoicesReceipt)for(const path of [manifest.npcVoicesReceipt.path,root+'/npc-native-voices.json'])assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),manifest.npcVoicesReceipt.sha256,'Native voice receipt changed: '+path);
if(manifest.publicPartyRerun)assert.deepEqual(JSON.parse(readFileSync(root+'/public-party-rerun-blocked.json','utf8')),manifest.publicPartyRerun,'Public-relay rerun limitation changed');

const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(resolve(`${root}/voxel-heroes-review.html`)).href);
  const count = manifest.slides.length;
  assert.equal(await page.locator('#picker option').count(), count);
  for (let i = 0; i < count; i++) {
    await page.locator('#picker').selectOption(String(i));
    await page.waitForFunction(() => {
      const image = document.getElementById('frame'); return image.complete && image.naturalWidth > 0;
    });
    assert.equal(await page.locator('#title').textContent(), manifest.slides[i].caption);
    assert.equal(await page.locator('#evidence').textContent(), manifest.slides[i].evidence);
    assert.equal(await page.locator('#index').textContent(), `${i + 1} / ${count}`);
  }
  await page.locator('#next').click();
  assert.equal(await page.locator('#index').textContent(), `1 / ${count}`);
  await page.locator('#prev').click();
  assert.equal(await page.locator('#index').textContent(), `${count} / ${count}`);
  await page.locator('#next').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#index').textContent(), `1 / ${count}`);
  await page.keyboard.press('End');
  assert.equal(await page.locator('#index').textContent(), `${count} / ${count}`);
  await page.keyboard.press('Home');
  assert.equal(await page.locator('#index').textContent(), `1 / ${count}`);
  const room = manifest.slides.findIndex(slide => slide.caption === 'The mask breaks into the Hollow Crown');
  await page.locator('#picker').selectOption(String(room));
  await page.waitForFunction(() => document.getElementById('frame').complete);
  await page.screenshot({ path: `${root}/preview.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${root}/preview-phone.png`, fullPage: true });
  assert.deepEqual(errors, []);
  const result = { checkedUtc: new Date().toISOString(), slides: count, allImagesLoaded: true,
    selection: true, nextWrap: true, arrowKeys: true, screenshotHashes: true, buildHashes: true,
    phoneNoHorizontalOverflow: true, artifactHashes: true, developmentReceiptHashes: true, visualInspectionHashes: true, pageErrors: errors, screenshots: ['preview.png', 'preview-phone.png'] };
  writeFileSync(`${root}/slideshow-check.json`, JSON.stringify(result, null, 2));
  console.log(`PASS review: ${count}/${count} images loaded; receipts, navigation and phone layout checked`);
} finally { await browser.close(); }
