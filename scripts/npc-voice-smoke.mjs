// Real recorded-media callbacks in both browsers, with all remote services blocked.
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { chromium, firefox } from 'playwright';
const args = process.argv.slice(2), get = name => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const out = get('out') ?? 'playtest-out/npc-recorded-voices', base = get('url') ?? 'http://127.0.0.1:5173/'; mkdirSync(out, { recursive: true });
const result = { startedUtc: new Date().toISOString(), url: base, modelDownloads: 0, note: 'Actual playing/ended callbacks and advancing media clocks. This does not record speaker output or establish perceptual quality.', browsers: [] };
try {
  for (const [name, engine] of Object.entries({ firefox, chromium })) {
    const browser = await engine.launch({ headless: true, ...(name === 'chromium' ? { args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : { firefoxUserPrefs: { 'media.volume_scale': '0.0' } }) });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [], requests = [];
      page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (/onnx|kokoro\.web|huggingface/.test(r.url())) requests.push(r.url()); });
      await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      const url = new URL(base); url.searchParams.set('manual', '1');
      await page.goto(url.href); await page.waitForFunction(() => window.__voxelHeroes?.version >= 1); await page.keyboard.press('Enter');
      await page.evaluate(async () => { const h = window.__voxelHeroes; await h.step(1.2); h.game.audio.setMuted(false); h.game.settings.setSetting('npcVoices', true); h.game.npcVoices.stopNpcSpeech(); });
      await page.evaluate(() => {
        window.__recordedMediaEvents = [];
        const NativeAudio = window.Audio;
        window.Audio = function(...args) {
          const audio = new NativeAudio(...args);
          for (const type of ['playing', 'ended', 'error']) audio.addEventListener(type, () => window.__recordedMediaEvents.push({ type, at: Date.now(), src: audio.currentSrc || audio.src, time: audio.currentTime, duration: audio.duration, error: audio.error?.code ?? null }));
          return audio;
        };
      });
      const report = { name, cases: [] };
      for (const [speaker, area, x, z] of [['Old Tobin','v1:1,1',13,10], ['Mira','v1:1,1',10.5,12], ['Tern','mossbrook-future:0,0',5,10]]) {
        await page.evaluate(async ({ speaker, area, x, z }) => {
          const h = window.__voxelHeroes; h.setMode('play'); h.teleport(area, x, z); await h.step(.7); h.game.npcVoices.stopNpcSpeech(); window.__recordedMediaEvents = [];
          const npc = h.entities.find(e => e.name === speaker); if (!npc) throw Error('Missing ' + speaker); npc.onInteract(h.player);
        }, { speaker, area, x, z });
        await page.waitForFunction(() => window.__recordedMediaEvents.some(e => e.type === 'playing'), null, { timeout: 10000 });
        await page.waitForFunction(() => window.__voxelHeroes.game.npcVoices.npcVoiceView().current?.time > .15, null, { timeout: 10000 });
        await page.evaluate(async () => { const h = window.__voxelHeroes; await h.step(1); h.render(); });
        await page.screenshot({ path: `${out}/${name}-${speaker.toLowerCase().replaceAll(' ', '-')}-recorded.png` });
        await page.waitForFunction(() => window.__recordedMediaEvents.some(e => e.type === 'ended'), null, { timeout: 30000 });
        const row = await page.evaluate(() => ({ view: window.__voxelHeroes.game.npcVoices.npcVoiceView(), events: window.__recordedMediaEvents }));
        assert.equal(row.view.last.engine, 'recorded-kokoro'); assert.equal(row.view.last.phase, 'ended'); assert.ok(!row.events.some(e => e.type === 'error'));
        report.cases.push({ speaker, ...row }); console.log(`PASS ${name} ${speaker}: real recorded audio played and ended`);
      }
      assert.deepEqual(errors, []); assert.deepEqual(requests, []); report.errors = errors; report.modelRequests = requests; result.browsers.push(report);
    } finally { await browser.close(); }
  }
  result.ok = true;
} catch (e) { result.ok = false; result.error = { message: e.message, stack: e.stack }; console.error(e.stack); process.exitCode = 1; }
finally { result.completedUtc = new Date().toISOString(); writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2)); }
