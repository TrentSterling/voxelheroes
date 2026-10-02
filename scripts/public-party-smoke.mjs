// Exercise the shipped relay and ICE configuration, without the local test relay.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, firefox } from 'playwright';
import { startServer, CHROMIUM_ARGS } from './playtest.mjs';

const server = await startServer(), browsers = [], pages = [], errors = [], notices = [];
const code = randomBytes(4).toString('hex').toUpperCase();
const path = 'playtest-out/public-party';
mkdirSync(path, { recursive: true });
let result;
try {
  for (const [name, engine] of Object.entries({ chromium, firefox })) {
    const browser = await engine.launch({ headless: true, ...(name === 'chromium' ? { args: CHROMIUM_ARGS } : { firefoxUserPrefs: { 'media.volume_scale': '0.0' } }) });
    browsers.push(browser);
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    page.on('console', m => { if (/relay|WebSocket/i.test(m.text())) notices.push(`${name}: ${m.text()}`); });
    await page.goto(`${server.url}?manual=1&look=flat&seed=1`);
    await page.waitForFunction(() => window.__voxelHeroes?.game?.party);
    await page.evaluate(() => window.__voxelHeroes.game.progress.startNewGame());
    pages.push(page);
  }
  assert.equal(await pages[0].evaluate(code => window.__voxelHeroes.game.party.createParty(code), code), true);
  assert.equal(await pages[1].evaluate(code => window.__voxelHeroes.game.party.joinParty(code), code), true);
  await Promise.all(pages.map(page => page.waitForFunction(() => {
    const p = window.__voxelHeroes.game.party;
    return p.partyView().ready && p.partyView().count === 2 && p.partyFriends().length === 1;
  }, null, { timeout: 45000 })));
  assert.deepEqual(errors, []);
  result = { passed: true, completedUtc: new Date().toISOString(), browsers: ['Chromium', 'Firefox'],
    scope: 'Two local browsers match through the shipped public Nostr relays and default ICE; separate networks and cross-NAT connections are not covered.', errors, notices };
  console.log('PASS public party: Firefox and Chromium matched using the shipped public relays and default ICE');
} catch (error) {
  result = { passed: false, completedUtc: new Date().toISOString(), error: error.message, errors, notices };
  console.error(`FAIL public party: ${error.message}`);
  process.exitCode = 1;
} finally {
  writeFileSync(`${path}/result.json`, JSON.stringify(result, null, 2));
  for (const page of pages) if (!page.isClosed()) await page.evaluate(() => window.__voxelHeroes.game.party.leaveParty()).catch(() => {});
  await Promise.all(browsers.map(browser => browser.close()));
  await server.close();
}
