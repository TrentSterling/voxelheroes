// Potato mode: the game on emulated weak hardware. Software GL (SwiftShader, no GPU) and a 4x CPU
// throttle, 960 x 540. Plays the village and the Crossroads for a while each and reports the frame
// times and the look quality the frame-time watchdog settles on.
//   npx vite preview --port 4179   then   node scripts/potato.mjs [--rate 4] [--seconds 20]
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const rate = +arg('--rate', '4');
const seconds = +arg('--seconds', '20');
const lite = process.argv.includes('--lite'); // experiment: no far backdrop, no previews
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate });
await page.goto('http://localhost:4179/?seed=1');
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1, null, { timeout: 120000 });
await page.keyboard.press('Enter');
await page.waitForTimeout(3000);
const run = async (label, where) => {
  await page.evaluate(([w, lite]) => { const h = window.__voxelHeroes; h.teleport(w[0], w[1], w[2]); if (lite) { for (const m of h.world.backdrop ?? []) m.mesh.visible = false; for (const s of h.world.previews) for (const m of s.meshes) m.mesh.visible = false; h.world.previews.clear(); } }, [where, lite]);
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const R = (window.__potato = { d: [], last: performance.now() });
    const f = (now) => { R.d.push(now - R.last); R.last = now; if (R.d.length < 100000) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  for (let i = 0; i < seconds / 2; i++) {
    const k = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'][i % 4];
    await page.keyboard.down(k); await page.waitForTimeout(1000); await page.keyboard.up(k);
    await page.waitForTimeout(1000);
  }
  const r = await page.evaluate(() => {
    const d = window.__potato.d.slice(5).sort((a, b) => a - b);
    const q = (p) => +d[Math.floor(p * (d.length - 1))].toFixed(1);
    const info = window.__voxelHeroes.look.info();
    return { frames: d.length, p50: q(0.5), p95: q(0.95), fps: +(1000 / q(0.5)).toFixed(1), quality: window.__voxelHeroes.look.get(), drops: info.drops ?? null };
  });
  console.log(`${label.padEnd(10)} median ${r.p50} ms (${r.fps} fps), p95 ${r.p95} ms, quality now '${r.quality}', watchdog drops ${JSON.stringify(r.drops)}`);
};
console.log(`potato: SwiftShader software GL, ${rate}x CPU throttle, 960x540${lite ? ', lite (no backdrop, no previews)' : ''}`);
await run('village', ['Mossbrook Square', 8, 4.5]);
await run('crossroads', ['Crossroads', 8, 5.5]);
await browser.close();
