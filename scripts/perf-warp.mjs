// Frame times through real area loads (fade, loading card, fade in) in the real-time loop, per area:
// the worst frame and frames over 33 ms from the start of the fade until play resumes, and how long
// the load took. This is the hitch a player feels.
//   npx vite preview --port 4179   then   node scripts/perf-warp.mjs [--browser firefox] [--url u] [--out f.json]
import { writeFileSync } from 'node:fs';
import { chromium, firefox } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ff = arg('--browser', 'chrome') === 'firefox';
const browser = ff
  ? await firefox.launch({ headless: true, firefoxUserPrefs: { 'media.volume_scale': '0.0', 'webgl.force-enabled': true } })
  : await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`${arg('--url', 'http://localhost:4179/')}?seed=1`);
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1, null, { timeout: 30000 });
await page.keyboard.press('Enter');
await page.waitForTimeout(2500);
const areas = (await page.evaluate(() => window.__voxelHeroes.registries.areas())).filter((a) => !/^test-|kitroom/.test(a));
const rows = [];
for (const a of [...areas, areas[0]]) {
  const r = await page.evaluate(async (a) => {
    const h = window.__voxelHeroes;
    const frames = [];
    let last = performance.now(), run = true;
    const tick = (now) => { frames.push(now - last); last = now; if (run) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const t0 = performance.now();
    h.transitions.warpTo(a);
    await new Promise((res) => { const w = () => (h.state.mode === 'play' ? res() : setTimeout(w, 5)); setTimeout(w, 50); });
    const ms = performance.now() - t0;
    await new Promise((res) => setTimeout(res, 400)); // the first frames of play
    run = false;
    return { area: a, loadMs: Math.round(ms), frames: frames.length, worst: +Math.max(...frames).toFixed(1), over33: frames.filter((f) => f > 33.4).length, over50: frames.filter((f) => f > 50).length };
  }, a);
  rows.push(r);
  await page.waitForTimeout(600);
}
await browser.close();
console.log(`${ff ? 'firefox' : 'chrome'} 1920x1080`);
console.log('area           loadMs  worst  >33ms  >50ms');
for (const r of rows) console.log(`${r.area.padEnd(14)} ${String(r.loadMs).padStart(6)} ${String(r.worst).padStart(6)} ${String(r.over33).padStart(6)} ${String(r.over50).padStart(6)}`);
const out = arg('--out', null);
if (out) writeFileSync(out, JSON.stringify(rows, null, 2));
