// Where boot time goes before the title shows: a CPU profile of the page load in Chrome (real
// GPU), summed by function (self time) and by a few inclusive buckets, plus the long tasks.
// Best on an unminified build (npx vite build --outDir dist-x --minify false).
//   node scripts/perf-boot.mjs [--url http://localhost:4201/] [--top 30]
import { chromium } from 'playwright';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const url = arg('--url', 'http://localhost:4201/');
const top = +arg('--top', 30);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (r) => r.abort());
await page.addInitScript(() => {
  const R = (window.__boot = { long: [], titleAt: null });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) R.long.push([+e.startTime.toFixed(0), +e.duration.toFixed(0)]);
  }).observe({ type: 'longtask', buffered: true });
  const tick = () => {
    if (R.titleAt === null && window.__voxelHeroes?.state?.mode === 'title') R.titleAt = +performance.now().toFixed(0);
    if (R.titleAt === null) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');
await page.goto(`${url}?seed=1&look=high`);
await page.waitForFunction(() => window.__boot?.titleAt !== null, null, { timeout: 30000 });
await page.waitForTimeout(3000);
const { profile } = await cdp.send('Profiler.stop');
const boot = await page.evaluate(() => window.__boot);
await browser.close();

const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const self = new Map();
const incl = new Map();
let t = profile.startTime;
const until = profile.startTime + (boot.titleAt + 50) * 1000; // roughly: up to the title
for (let i = 0; i < profile.samples.length; i++) {
  t += profile.timeDeltas[i] ?? 0;
  const n = byId.get(profile.samples[i]);
  const d = (profile.timeDeltas[i] ?? 0) / 1000;
  const f = n.callFrame;
  const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`;
  self.set(key, (self.get(key) ?? 0) + d);
  const seen = new Set();
  for (let id = n.id; id != null; id = parent.get(id)) {
    const fn = byId.get(id).callFrame.functionName || '(anon)';
    if (seen.has(fn)) continue;
    seen.add(fn);
    incl.set(fn, (incl.get(fn) ?? 0) + d);
  }
}
console.log(`title at ${boot.titleAt} ms; long tasks ${JSON.stringify(boot.long)}`);
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`${v.toFixed(0).padStart(6)} ms self  ${k}`);
console.log('--- inclusive');
for (const [k, v] of [...incl].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`${v.toFixed(0).padStart(6)} ms  ${k}`);
void until;
