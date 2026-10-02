// CPU profile of one area build (teleport) in Chrome: self time by function, top 20.
//   npx vite preview --port 4179   then   node scripts/perf-profile.mjs [area=d1]
import { chromium } from 'playwright';

const area = process.argv[2] ?? 'd1';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:4179/?seed=1&manual=1');
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1, null, { timeout: 30000 });
await page.keyboard.press('Enter');
await page.evaluate(() => window.__voxelHeroes.teleport('overworld'));
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
await cdp.send('Profiler.start');
const ms = await page.evaluate((a) => { const t = performance.now(); window.__voxelHeroes.teleport(a); return performance.now() - t; }, area);
const { profile } = await cdp.send('Profiler.stop');
await browser.close();

const self = new Map();
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas;
for (let i = 0; i < profile.samples.length; i++) {
  const n = byId.get(profile.samples[i]);
  const f = n.callFrame;
  const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`;
  self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000);
}
const total = [...self.values()].reduce((a, b) => a + b, 0);
console.log(`${area} build ${ms.toFixed(0)} ms; profile ${total.toFixed(0)} ms`);
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`${v.toFixed(0).padStart(6)} ms  ${k}`);
