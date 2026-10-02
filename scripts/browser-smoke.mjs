// Startup under the EasyPrivacy /boomerang.js rule, in both browser engines.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium, firefox } from 'playwright';
import { startRelay } from './lib/nostr-relay.mjs';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'playtest-out/browser-smoke';

const url = process.argv.find((arg) => arg.startsWith('--url='))?.slice(6) ?? 'http://127.0.0.1:5173/';
const reproduce = process.argv.includes('--expect-blocked');
mkdirSync(out, { recursive: true });
const localRelay=process.argv.includes('--local-signaling')?await startRelay():null;
try {
for (const [name, engine] of Object.entries({ firefox, chromium })) {
  const browser = await engine.launch({ headless: true, ...(name === 'chromium' ? { args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : { firefoxUserPrefs: { 'media.volume_scale': '0.0' } }) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    if(localRelay)await page.addInitScript(({relayUrl})=>{
      const Socket=window.WebSocket,Connection=window.RTCPeerConnection;
      window.WebSocket=class extends Socket{constructor(url,protocols){super(String(url).startsWith('wss:')?relayUrl:url,protocols);}};
      window.RTCPeerConnection=class extends Connection{constructor(config={}){super({...config,iceServers:[]});}};
    },{relayUrl:localRelay.url});
    const errors = [], blocked = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', async (route) => {
      const requestUrl=new URL(route.request().url());
      if(localRelay&&['http:','https:'].includes(requestUrl.protocol)&&!['localhost','127.0.0.1'].includes(requestUrl.hostname))return route.abort('blockedbyclient');
      // EasyPrivacy's generic filename rule also matches a same-origin game module.
      if (new URL(route.request().url()).pathname.includes('/boomerang.js')) {
        blocked.push(route.request().url());
        await route.abort('blockedbyclient');
      } else await route.continue();
    });
    const target = new URL(url);
    target.searchParams.set('manual', '1');
    target.searchParams.set('seed', '1');
    await page.goto(target.href);
    if (reproduce) {
      await page.waitForTimeout(1500);
      assert.equal(await page.evaluate(() => !!window.__voxelHeroes), false);
      assert.ok(blocked.length > 0);
      console.log(`REPRODUCED ${name}: /boomerang.js blocked and startup never completed`);
    } else {
      try {
        await page.waitForFunction(() => window.__voxelHeroes?.version >= 1);
      } catch (error) {
        await page.screenshot({ path: `${out}/${name}-boot-failed.png` });
        throw new Error(`${name} failed to boot: ${errors.join('; ') || error.message}`);
      }
      assert.deepEqual(blocked, []);
      await page.keyboard.press('Enter');
      await page.evaluate(async () => { await window.__voxelHeroes.step(2); window.__voxelHeroes.render(); });
      const state = await page.evaluate(() => window.__voxelHeroes.snapshot());
      assert.equal(state.mode, 'play');
      assert.ok(await page.evaluate(() => window.__voxelHeroes.registries.entities().includes('boomerang')));
      assert.deepEqual(errors, []);
      console.log(`PASS ${name}: filter enabled, game started, boomerang registered, no page errors`);
      await page.screenshot({ path: `${out}/${name}-after.png` });
      await page.evaluate(() => {
        const h = window.__voxelHeroes; h.newGame(); h.render();
        h.game.ui.pressUi('party-open'); h.render(); h.game.ui.pressUi('party-code');
      });
      await page.keyboard.insertText('BAD');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__voxelHeroes.game.partyUi.partyMenuView().notice);
      assert.equal(await page.evaluate(() => window.__voxelHeroes.state.mode), 'party');
      await page.evaluate(() => { const h = window.__voxelHeroes; h.render(); h.game.ui.pressUi('party-create'); });
      await page.waitForFunction(() => window.__voxelHeroes.game.party.partyView().ready && window.__voxelHeroes.state.mode === 'play');
      assert.equal(await page.evaluate(() => window.__voxelHeroes.screen().name), 'Mossbrook Square');
      assert.equal(await page.evaluate(() => window.__voxelHeroes.state.swords.equipped), null);
      await page.evaluate(() => { const h = window.__voxelHeroes; h.game.partyUi.openParty(); h.render(); });
      await page.screenshot({ path: `${out}/${name}-party-create.png` });
      await page.evaluate(() => window.__voxelHeroes.game.party.leaveParty());
      assert.deepEqual(errors, []);
      console.log(`PASS ${name}: real party menu accepts text, rejects invalid code, creates an adventure from title${localRelay?' (local signaling fixture; external HTTP blocked and public ICE disabled)':''}`);
    }
    if (reproduce) await page.screenshot({ path: `${out}/${name}-before.png` });
  } finally { await browser.close(); }
}
} finally { await localRelay?.close(); }
