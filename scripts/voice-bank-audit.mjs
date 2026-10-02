// Every recorded asset must match current authored content and decode in both
// target browsers. Network restrictions apply to the game, not the dev recorder.
import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inventory } from './voice-inventory.mjs';
import { buildGame, startServer, CHROMIUM_ARGS } from './playtest.mjs';
const args = process.argv.slice(2), get = name => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const staticOnly = args.includes('--static-only');
const out = get('out') ?? 'playtest-out/voice-bank-audit'; mkdirSync(out, { recursive: true });
const catalog = inventory(), bank = JSON.parse(readFileSync('src/game/voice-bank.json', 'utf8'));
const result = { startedUtc: new Date().toISOString(), lines: bank.lines.length, characters: catalog.cast.length, staticChecks: 0, browsers: [], failures: [], notes: [staticOnly ? 'Every asset is checked for current source coverage, hash and Opus container; no browser, decoding or playback.' : 'Every asset is checked for current source coverage, hash, Opus container and actual PCM decode.', 'Decode and playback checks do not substitute for human listening.'] };
let server;
try {
  assert.equal(bank.lines.length, catalog.lines.length, 'Every authored NPC line must have a recording'); result.staticChecks++;
  const actual = new Map(bank.lines.map(row => [row.key, row]));
  assert.equal(actual.size, bank.lines.length, 'No duplicate voice keys'); result.staticChecks++;
  let bytes = 0, seconds = 0;
  for (const row of catalog.lines) {
    const clip = actual.get(row.key); assert.ok(clip, `${row.speaker}: ${row.text}`);
    assert.equal(clip.id, row.id); assert.equal(clip.voice, row.voice); assert.equal(clip.batch, row.batch);
    const raw = readFileSync(`public/${clip.path}`);
    assert.equal(raw.length, clip.bytes); assert.equal(createHash('sha256').update(raw).digest('hex'), clip.sha256);
    assert.ok(raw.includes(Buffer.from('OpusHead')) && raw.subarray(0, 4).toString() === 'OggS');
    bytes += clip.bytes; seconds += clip.duration; result.staticChecks += 7;
  }
  result.bytes = bytes; result.audioSeconds = seconds; result.batches = catalog.batches;
  result.scope = staticOnly ? 'assets-only' : 'assets-and-browser-decode';
  if (!staticOnly && !get('url')) { if (!args.includes('--no-build')) await buildGame(); server = await startServer(); }
  const base = get('url') ?? server?.url;
  for (const [name, engine] of (staticOnly ? [] : Object.entries({ chromium, firefox }))) {
    const browser = await engine.launch({ headless: true, ...(name === 'chromium' ? { args: CHROMIUM_ARGS } : { firefoxUserPrefs: { 'media.volume_scale': '0.0' } }) });
    try {
      const page = await browser.newPage(), forbidden = [];
      await page.route('**/*', route => {
        const host = new URL(route.request().url()).hostname;
        if (['localhost', '127.0.0.1'].includes(host)) return route.continue();
        if (!host.startsWith('fonts.')) forbidden.push(route.request().url());
        return route.abort();
      });
      await page.goto(new URL('?manual=1', base).href); await page.waitForFunction(() => window.__voxelHeroes?.version);
      const liveCast = await page.evaluate(placements => placements.map(p => {
        const h = window.__voxelHeroes, npc = h.game.registry.createEntity(p.type, { ...p.opts, x: h.player.x, z: h.player.z });
        const actual = { name: npc.name, personality: h.game.npcTalk.personalityOf(npc) }; npc.onRemove(); return actual;
      }), catalog.placements);
      for (let i = 0; i < liveCast.length; i++) {
        const expected = catalog.cast.find(p => p.name === catalog.placements[i].name);
        assert.equal(liveCast[i].name, expected.name); assert.equal(liveCast[i].personality, expected.personality);
      }
      const requests = []; page.on('request', request => { if (request.url().includes('/voices/')) requests.push(request.url()); });
      await page.keyboard.press('Enter'); await page.evaluate(async () => { const h = window.__voxelHeroes; await h.step(1); h.game.settings.setSetting('npcVoices', false); h.game.npcVoices.stopNpcSpeech(); });
      assert.equal(requests.length, 0, 'Starting the game does not preload its voice library');
      const report = { name, decoded: 0, assertions: 1 + liveCast.length * 2, castPlacements: liveCast.length, lines: [] };
      for (let offset = 0; offset < bank.lines.length; offset += 50) {
        const decoded = await page.evaluate(async ({ rows, base }) => {
          const ctx = new (window.AudioContext || window.webkitAudioContext)(), result = [];
          try {
            for (const row of rows) {
              const response = await fetch(new URL(row.path, base)); if (!response.ok) throw Error(`HTTP ${response.status}: ${row.id}`);
              const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
              let peak = 0, sum = 0, finite = true;
              const data = buffer.getChannelData(0);
              for (let i = 0; i < data.length; i++) { const value = data[i]; finite &&= Number.isFinite(value); peak = Math.max(peak, Math.abs(value)); sum += value * value; }
              result.push({ id: row.id, duration: buffer.duration, channels: buffer.numberOfChannels, finite, peak, rms: Math.sqrt(sum / data.length) });
            }
          } finally { await ctx.close(); }
          return result;
        }, { rows: bank.lines.slice(offset, offset + 50), base });
        for (let i = 0; i < decoded.length; i++) {
          const d = decoded[i], expected = bank.lines[offset + i];
          assert.equal(d.channels, 1); assert.ok(d.finite && d.peak > .01 && d.rms > .001); assert.ok(Math.abs(d.duration - expected.duration) < .06); report.assertions += 3;
        }
        report.lines.push(...decoded); report.decoded += decoded.length;
        console.log(`PASS ${name}: decoded ${report.decoded}/${bank.lines.length} real Opus recordings`);
      }
      assert.deepEqual(forbidden, []); report.assertions++;
      result.browsers.push(report); writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2));
    } finally { await browser.close(); }
  }
  result.ok = true;
  if (staticOnly) result.notes.push('Asset-only run: no browsers launched and no playback or decoding repeated.');
  console.log(`VOICE AUDIT PASS: ${bank.lines.length} lines, ${(result.bytes / 1e6).toFixed(2)} MB, ${(result.audioSeconds / 60).toFixed(1)} minutes, ${staticOnly ? 'assets only; no browsers' : 'both browsers'}`);
} catch (e) { result.ok = false; result.failures.push({ message: e.message, stack: e.stack }); console.error(e.stack); process.exitCode = 1; }
finally { result.completedUtc = new Date().toISOString(); writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2)); await server?.close(); }
