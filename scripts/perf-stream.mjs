// Real-GPU check of the streamed world (systems/streaming.js) in the real-time loop: boot to the
// title, a scripted walk over the outdoors (Mossbrook south to Crownhold's courtyard and back, then
// west across Barrowfield and back, then north to Chapel Green: four area edges or more), and the
// walk up to the Old Barrow's door into D1. Every frame time and every main-thread long task is
// recorded; prints p50 / p99 / max per phase and writes a JSON receipt.
//
//   npx vite build --outDir dist-x && npx vite preview --outDir dist-x --port 4201   (another shell)
//   node scripts/perf-stream.mjs [--url http://localhost:4201/] [--browser chrome|firefox]
//                                [--size 1920x1080] [--look high] [--params workers=0] [--out f.json]
// Chrome runs headless on the real GPU (ANGLE D3D11; the GPU is printed from UNMASKED_RENDERER);
// Firefox (webgl.force-enabled, gfx.webrender.all) has no long-task API, so only frames there.
// Targets: the walk has no frame over 25 ms and no long task over 50 ms; D1 entry no frame over
// 50 ms; the title shows within 1 s of load, with no long task over 150 ms after it.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium, firefox } from 'playwright';
import { lookup } from 'node:dns/promises';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const urlArg = arg('--url', 'http://localhost:4201/');
// 'localhost' is resolved here, to the address the preview server listens on (Node puts ::1 first):
// Firefox tries 127.0.0.1 first and only falls back after ~2 s, which the title time then counted.
const url = await (async (u) => {
  const x = new URL(u);
  if (x.hostname !== 'localhost') return u;
  const { address, family } = await lookup('localhost');
  x.hostname = family === 6 ? `[${address}]` : address;
  return x.href;
})(urlArg);
const which = arg('--browser', 'chrome');
const [W, H] = arg('--size', '1920x1080').split('x').map(Number);
const lookLevel = arg('--look', 'high');
const extra = arg('--params', ''); // more query parameters, e.g. workers=0
const out = arg('--out', null);

const browser =
  which === 'firefox'
    ? await firefox.launch({ headless: true, firefoxUserPrefs: { 'webgl.force-enabled': true, 'gfx.webrender.all': true } })
    : await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push(m.text()); // (the blocked web font)
});
await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (r) => r.abort());

// Recorder, installed before the page's own scripts: frames (rAF deltas), long tasks, the moment
// the title first shows, phases.
await page.addInitScript(() => {
  const R = (window.__perf = { frames: [], long: [], phase: 'boot', titleAt: null, keys: [], modes: new Set() });
  let last = performance.now();
  const tick = (now) => {
    R.frames.push([now, now - last, R.phase, window.__voxelHeroes?.state?.mode ?? null]);
    last = now;
    const h = window.__voxelHeroes;
    if (R.titleAt === null && h?.state?.mode === 'title') R.titleAt = performance.now(); // (the frame after the script ran)
    if (h?.state) {
      const k = h.state.screenKey;
      if (k !== R.keys.at(-1)?.[1] && R.phase !== 'boot') R.keys.push([now, k, h.state.mode]);
      if (R.phase === 'walk') R.modes.add(h.state.mode);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) R.long.push([e.startTime, e.duration, R.phase]);
    }).observe({ type: 'longtask', buffered: true });
    R.hasLongTasks = true;
  } catch {
    R.hasLongTasks = false;
  }
});

const t0 = Date.now();
await page.goto(`${url}?seed=1&look=${lookLevel}${extra ? '&' + extra : ''}`);
await page.waitForFunction(() => window.__perf?.titleAt !== null && window.__voxelHeroes?.version >= 1, null, { timeout: 30000 });
const gpu = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
  return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? 'unknown';
});
const phase = (p) => page.evaluate((p) => (window.__perf.phase = p), p);
await phase('title');
await page.waitForTimeout(4000); // the ring and the backdrop stream in behind the title
await page.keyboard.press('Enter');
await phase('start');
await page.waitForTimeout(1500);

// The walker: a breadth-first path over the global tile grid (the hero's own collision test,
// no warps, no hazards), steered each frame through the virtual stick. Waypoints are global tiles.
async function walkRoute(points, label, maxMs) {
  return page.evaluate(
    async ([points, label, maxMs]) => {
      const h = window.__voxelHeroes;
      const w = h.world;
      const p = h.player;
      const R = window.__perf;
      const taken = () => {
        const s = new Set();
        for (const e of h.entities) if (e.solid && !e.removed) s.add(`${Math.floor(e.x)},${Math.floor(e.z)}`);
        return s;
      };
      const path = (from, to, near = 0) => {
        const busy = taken();
        const free = (x, z) => {
          if (busy.has(`${x},${z}`) && !(x === to[0] && z === to[1])) return false;
          if (w.blocked(x + 0.5, z + 0.5, p.r, p)) return false;
          const def = w.tileDefAt(x, z);
          return !!def && !def.onEnter && !def.hazard;
        };
        const key = (x, z) => `${x},${z}`;
        const prev = new Map([[key(...from), null]]);
        const q = [from];
        for (let qi = 0; qi < q.length; qi++) {
          const c = q[qi];
          if (Math.abs(c[0] - to[0]) + Math.abs(c[1] - to[1]) <= near) {
            const out = [];
            for (let k = key(...c); k; k = prev.get(k)) out.unshift(k.split(',').map(Number));
            return out.slice(1);
          }
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const n = [c[0] + dx, c[1] + dz];
            const k = key(...n);
            if (prev.has(k) || !free(...n)) continue;
            prev.set(k, key(...c));
            q.push(n);
          }
        }
        return null;
      };
      R.phase = label;
      const start = performance.now();
      let wp = 0; // waypoint being walked to
      let route = [];
      let i = 0;
      let replans = 0;
      const here = () => [Math.floor(p.x), Math.floor(p.z)];
      const plan = () => {
        route = path(here(), points[wp]) ?? path(here(), points[wp], 2) ?? [];
        i = 0;
      };
      plan();
      let best = Infinity;
      let since = 0;
      await new Promise((done) => {
        const step = () => {
          if (wp >= points.length || performance.now() - start > maxMs) {
            h.input.setStick(0, 0);
            return done();
          }
          p.invT = 10; // foes do not stop the walk
          if (h.state.mode !== 'play') {
            h.input.setStick(0, 0);
            return requestAnimationFrame(step);
          }
          if (i >= route.length) {
            wp++;
            if (wp < points.length) plan();
            best = Infinity;
            return requestAnimationFrame(step);
          }
          const tgt = route[i];
          const dx = tgt[0] + 0.5 - p.x;
          const dz = tgt[1] + 0.5 - p.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.3) {
            i++;
            best = Infinity;
            since = 0;
          } else {
            if (d < best - 0.02) {
              best = d;
              since = 0;
            } else since++;
            if (since > 45) {
              // wedged (someone stepped into the way): plan again from here around them
              replans++;
              since = 0;
              best = Infinity;
              plan();
            }
            h.input.setStick(dx / d, dz / d);
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      return { ok: wp >= points.length, waypoints: points.length, reached: wp, replans, ms: Math.round(performance.now() - start), at: [+p.x.toFixed(1), +p.z.toFixed(1), h.state.screenKey], next: route[i] ?? null };
    },
    [points, label, maxMs]
  );
}

await page.evaluate(() => window.__voxelHeroes.camera.choose('A'));
// Mossbrook Square (v1 1,1) -> Crownhold Courtyard (ow-4-3 1,1) -> back -> West Gate -> Barrowfield
// (ow-3-2 2,1 -> 1,1 -> 0,1) -> back to the Square.
const route = [
  [168, 88],
  [168, 100],
  [168, 118],
  [168, 100],
  [168, 84],
  [152, 72],
  [136, 72],
  [120, 72],
  [104, 72],
  [120, 72],
  [136, 72],
  [152, 72],
  [168, 76],
  [168, 58],
];
const walk = await walkRoute(route, 'walk', 90000);
await phase('after');
await page.waitForTimeout(500);

// D1: settle outside the Old Barrow's door as a player walking up would, then in through it.
await page.evaluate(() => window.__voxelHeroes.teleport('ow-3-2:1,2', 8.5, 12, { yaw: Math.PI }));
await phase('approach');
await page.waitForTimeout(3000);
const d1 = await page.evaluate(async () => {
  const h = window.__voxelHeroes;
  const R = window.__perf;
  R.phase = 'd1';
  const t = performance.now();
  await new Promise((done) => {
    const step = () => {
      h.input.setStick(h.state.mode === 'play' && h.state.screenKey.startsWith('ow-3-2') ? 0 : 0, h.state.mode === 'play' && h.state.screenKey.startsWith('ow-3-2') ? -1 : 0);
      if ((h.state.mode === 'play' && h.state.screenKey.startsWith('d1')) || performance.now() - t > 12000) {
        h.input.setStick(0, 0);
        return done();
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  await new Promise((r) => setTimeout(r, 800)); // the first frames of play in D1
  R.phase = 'end';
  return { ok: h.state.screenKey.startsWith('d1'), key: h.state.screenKey, ms: Math.round(performance.now() - t) };
});

const R = await page.evaluate(() => ({ ...window.__perf, modes: [...window.__perf.modes] }));
const stream = await page.evaluate(() => window.__voxelHeroes.world.stream.state());
await browser.close();

const pct = (xs, q) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1);
};
const stats = (ph) => {
  const d = R.frames.filter((f) => f[2] === ph).map((f) => f[1]).slice(1);
  const lt = R.long.filter((l) => l[2] === ph).map((l) => +l[1].toFixed(0));
  return { frames: d.length, p50: pct(d, 0.5), p99: pct(d, 0.99), max: +Math.max(0, ...d).toFixed(1), over25: d.filter((x) => x > 25).length, over50: d.filter((x) => x > 50).length, longTasks: lt.length, longMax: Math.max(0, ...lt) };
};
const afterTitle = R.long.filter((l) => R.titleAt !== null && l[0] >= R.titleAt).map((l) => +l[1].toFixed(0));
const beforeTitle = R.long.filter((l) => R.titleAt !== null && l[0] < R.titleAt).map((l) => +l[1].toFixed(0));
const walkKeys = R.keys.filter((k) => k[0] >= (R.frames.find((f) => f[2] === 'walk')?.[0] ?? Infinity) && k[0] <= (R.frames.findLast((f) => f[2] === 'walk')?.[0] ?? 0));
const areaOf = (k) => k.split(':')[0];
let edges = 0;
for (let i = 1; i < walkKeys.length; i++) if (areaOf(walkKeys[i][1]) !== areaOf(walkKeys[i - 1][1])) edges++;
const result = {
  browser: which,
  gpu,
  size: `${W}x${H}`,
  look: lookLevel,
  boot: { titleMs: R.titleAt === null ? null : +R.titleAt.toFixed(0), longBeforeTitle: beforeTitle, longAfterTitleMax: Math.max(0, ...afterTitle), longAfterTitle: afterTitle, hasLongTasks: R.hasLongTasks },
  title: stats('title'),
  walk: { ...stats('walk'), route: walk, areaEdges: edges, modes: R.modes, screens: walkKeys.map((k) => k[1]) },
  d1: { ...stats('d1'), ...d1, slow: R.frames.filter((f) => f[2] === 'd1' && f[1] > 25).map((f) => [+f[1].toFixed(0), f[3]]) },
  stream,
  errors,
  wallSeconds: Math.round((Date.now() - t0) / 1000),
};
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 2));
}
const line = (name, s) => `${name.padEnd(6)} frames ${s.frames}  p50 ${s.p50}  p99 ${s.p99}  max ${s.max}  >25ms ${s.over25}  >50ms ${s.over50}  long tasks ${s.longTasks} (max ${s.longMax} ms)`;
console.log(`${which} ${W}x${H} look=${lookLevel}  gpu: ${gpu}`);
console.log(`boot   title at ${result.boot.titleMs} ms; long tasks before it ${JSON.stringify(beforeTitle)}; after it max ${result.boot.longAfterTitleMax} ms (${afterTitle.length})`);
console.log(line('title', result.title));
console.log(line('walk', result.walk));
console.log(`       route ${JSON.stringify(walk)}; ${edges} area edges; modes ${R.modes.join(',')}; ${walkKeys.length} screens`);
console.log(line('d1', result.d1));
console.log(`       ${JSON.stringify(d1)}; slow frames [ms, mode]: ${JSON.stringify(result.d1.slow)}`);
console.log(`errors: ${errors.length}${errors.length ? ' ' + errors.slice(0, 3).join(' | ') : ''}`);
