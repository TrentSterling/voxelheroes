// CPU profile of rebuilding outdoor screens (unminified build), by self time and by inclusive buckets.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:4201/';
const area = process.argv[3] ?? 'ow-3-2';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url + '?seed=1&manual=1');
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1, null, { timeout: 30000 });
await page.evaluate((a) => window.__voxelHeroes.teleport(a), area);
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
await cdp.send('Profiler.start');
const ms = await page.evaluate((a) => {
  const h = window.__voxelHeroes;
  const out = [];
  for (const s of h.world.screens.values()) {
    if (s.area.id !== a) continue;
    const t = performance.now();
    h.world.buildScreen(s);
    out.push(+(performance.now() - t).toFixed(1));
  }
  return out;
}, area);
const { profile } = await cdp.send('Profiler.stop');
await browser.close();
const self = new Map();
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const incl = new Map();
const dt = profile.timeDeltas;
for (let i = 0; i < profile.samples.length; i++) {
  const n = byId.get(profile.samples[i]);
  const f = n.callFrame;
  const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`;
  const d = (dt[i] ?? 0) / 1000;
  self.set(key, (self.get(key) ?? 0) + d);
  const seen = new Set();
  for (let id = n.id; id != null; id = parent.get(id)) {
    const fn = byId.get(id).callFrame.functionName || '(anon)';
    if (seen.has(fn)) continue;
    seen.add(fn);
    incl.set(fn, (incl.get(fn) ?? 0) + d);
  }
}
console.log(`${area} per-screen build ms: ${ms.join(', ')} (sum ${ms.reduce((a, b) => a + b, 0).toFixed(0)})`);
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${v.toFixed(0).padStart(6)} ms self  ${k}`);
console.log('--- inclusive');
for (const k of ['buildScreenTerrain', 'buildRect', 'build', 'meshVoxels', 'mesh', 'joinGeometries', 'mergeGeometries', 'coarseMesh', 'cellAt', 'waterGeometry', 'box', 'set']) console.log(`${(incl.get(k) ?? 0).toFixed(0).padStart(6)} ms  ${k}`);
