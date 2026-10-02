// Real-GPU performance probe: the real-time loop (no ?manual) in headless Chrome on this machine's
// GPU. Walks across screens and loads every area, recording every frame time and every main-thread
// long task, then writes a JSON receipt and prints a summary.
//
//   npm run build && npx vite preview --port 4179     (another shell)
//   node scripts/perf.mjs [--url http://localhost:4179/] [--out playtest-out/perf.json] [--label before]
//                         [--size 2560x1440] [--dpr 1.5]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium, firefox } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const url = arg('--url', 'http://localhost:4179/');
const out = arg('--out', 'playtest-out/perf.json');
const label = arg('--label', 'run');
const [W, H] = arg('--size', '1280x720').split('x').map(Number);
const DPR = +arg('--dpr', '1');

const browser = arg('--browser', 'chrome') === 'firefox'
  ? await firefox.launch({ headless: true, firefoxUserPrefs: { 'media.volume_scale': '0.0', 'webgl.force-enabled': true, 'gfx.webrender.all': true } })
  : await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${url}?seed=1`);
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1, null, { timeout: 30000 });

// Frame and long-task recorder, with phase marks.
await page.evaluate(() => {
  const R = (window.__perf = { frames: [], long: [], marks: [], phase: 'boot' });
  let last = performance.now();
  const tick = (now) => { R.frames.push([now, now - last, R.phase]); last = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  new PerformanceObserver((l) => { for (const e of l.getEntries()) R.long.push([e.startTime, e.duration, R.phase]); }).observe({ type: 'longtask', buffered: true });
  const gl = document.createElement('canvas').getContext('webgl2');
  const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
  R.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
const phase = (p) => page.evaluate((p) => { window.__perf.phase = p; window.__perf.marks.push([performance.now(), p]); }, p);
const wait = (ms) => page.waitForTimeout(ms);
const hold = async (key, ms) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };

await phase('title'); await wait(1500);
await page.keyboard.press('Enter');
await phase('start'); await wait(3000);
const info0 = await page.evaluate(() => window.__voxelHeroes.look.info());

// Walk the start area in all four directions (screen slides).
await phase('walk');
for (const k of ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown']) await hold(k, 2500);

// Load every area (area builds + loading cards), then walk a little in each.
const areas = await page.evaluate(() => window.__voxelHeroes.registries.areas());
const perArea = [];
for (const a of areas) {
  if (/^test-|kitroom/.test(a)) continue;
  await phase(`load:${a}`);
  const t0 = await page.evaluate(() => performance.now());
  const ok = await page.evaluate((a) => { try { window.__voxelHeroes.teleport(a); return true; } catch (e) { return String(e.message ?? e); } }, a);
  await wait(2500);
  await phase(`play:${a}`);
  await hold('ArrowRight', 1200); await hold('ArrowDown', 1200);
  const info = await page.evaluate(() => window.__voxelHeroes.look.info());
  perArea.push({ area: a, ok, calls: info.calls, triangles: info.triangles, quality: info.quality ?? null, t0 });
}
await phase('end'); await wait(500);
const R = await page.evaluate(() => window.__perf);
await browser.close();

// Summaries.
const pct = (xs, p) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
const stats = (fr) => { const d = fr.map((f) => f[1]).filter((x) => x > 0 && x < 5000); return { frames: d.length, p50: pct(d, 0.5), p95: pct(d, 0.95), p99: pct(d, 0.99), max: +Math.max(0, ...d).toFixed(1), over33: d.filter((x) => x > 33.4).length, over100: d.filter((x) => x > 100).length }; };
const byPhase = {};
for (const f of R.frames) (byPhase[f[2].split(':')[0]] ??= []).push(f);
const worstLoads = perArea.map((p) => {
  const fr = R.frames.filter((f) => f[2] === `load:${p.area}`);
  const lt = R.long.filter((l) => l[2] === `load:${p.area}`);
  return { area: p.area, ok: p.ok, maxFrame: +Math.max(0, ...fr.map((f) => f[1])).toFixed(1), longTaskMs: +lt.reduce((s, l) => s + l[1], 0).toFixed(0), calls: p.calls, triangles: p.triangles };
});
const result = {
  label, when: new Date().toISOString(), gpu: R.gpu, errors,
  overall: stats(R.frames.filter((f) => !['boot', 'title'].includes(f[2]))),
  phases: Object.fromEntries(Object.entries(byPhase).map(([k, v]) => [k, stats(v)])),
  longTasks: { count: R.long.length, totalMs: +R.long.reduce((s, l) => s + l[1], 0).toFixed(0), worst: [...R.long].sort((a, b) => b[1] - a[1]).slice(0, 8).map((l) => ({ ms: +l[1].toFixed(0), phase: l[2] })) },
  start: { calls: info0.calls, triangles: info0.triangles, info: info0 },
  areas: worstLoads,
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 2));
console.log(`gpu: ${result.gpu}`);
console.log(`overall: ${JSON.stringify(result.overall)}`);
for (const [k, v] of Object.entries(result.phases)) console.log(`  ${k.padEnd(6)} ${JSON.stringify(v)}`);
console.log(`long tasks: ${result.longTasks.count}, ${result.longTasks.totalMs} ms; worst ${JSON.stringify(result.longTasks.worst.slice(0, 5))}`);
for (const a of worstLoads) console.log(`  ${a.area.padEnd(14)} ok=${a.ok} maxFrame=${a.maxFrame} longTasks=${a.longTaskMs}ms calls=${a.calls} tris=${a.triangles}`);
console.log(`errors: ${errors.length}${errors.length ? ' ' + errors.slice(0, 3).join(' | ') : ''}`);
console.log(`receipt: ${out}`);
