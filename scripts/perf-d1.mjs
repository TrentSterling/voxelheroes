// Where a door's fade spends its time: the walk up to the Old Barrow's door into D1 (and, with
// --cave, the Barrowfield cave), with every WebGL call, every animation-frame callback and the
// renderer's program count timed. For the Firefox D1 stall (no KHR_parallel_shader_compile there,
// so a program three.js creates links on the spot).
//
//   npx vite preview --outDir dist-x --port 4221 --strictPort   (another shell)
//   node scripts/perf-d1.mjs [--url http://localhost:4221/] [--browser firefox|chrome] [--look high]
//                            [--door d1|cave|both] [--out f.json]
// Prints each frame over 25 ms around the door with: its mode, the JS time of its rAF callbacks,
// the GL time inside them by method, programs created, and the slowest single GL calls (with a
// short stack). Frames of the phase 'door' only.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium, firefox } from 'playwright';
import { lookup } from 'node:dns/promises';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const urlArg = arg('--url', 'http://localhost:4221/');
// 'localhost' is resolved here, to the address the preview server listens on (Node puts ::1 first):
// Firefox tries 127.0.0.1 first and only falls back after ~2 s, which the title time then counted.
const url = await (async (u) => {
  const x = new URL(u);
  if (x.hostname !== 'localhost') return u;
  const { address, family } = await lookup('localhost');
  x.hostname = family === 6 ? `[${address}]` : address;
  return x.href;
})(urlArg);
const which = arg('--browser', 'firefox');
const lookLevel = arg('--look', 'high');
const doorArg = arg('--door', 'both');
const out = arg('--out', null);
const [W, H] = arg('--size', '1920x1080').split('x').map(Number);

const browser =
  which === 'firefox'
    ? await firefox.launch({ headless: true, firefoxUserPrefs: { 'media.volume_scale': '0.0', 'webgl.force-enabled': true, 'gfx.webrender.all': true } })
    : await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push(m.text());
});
await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (r) => r.abort());

if (process.argv.includes('--linkcost')) await page.addInitScript(() => (window.__linkcost = true));
await page.addInitScript(() => {
  const R = (window.__probe = { phase: 'boot', frames: [], cur: null, titleAt: null });
  const newFrame = (now) => ({ at: now, gap: 0, js: 0, gl: {}, glMs: 0, links: 0, compiles: 0, slow: [], mode: null, programs: 0, phase: R.phase });
  // every GL method timed
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    for (const k of Object.getOwnPropertyNames(C.prototype)) {
      const d = Object.getOwnPropertyDescriptor(C.prototype, k);
      if (!d || typeof d.value !== 'function' || k === 'constructor') continue;
      const f = d.value;
      C.prototype[k] = function (...a) {
        const t = performance.now();
        const r = f.apply(this, a);
        const ms = performance.now() - t;
        const F = R.cur;
        if (F) {
          F.gl[k] = (F.gl[k] ?? 0) + ms;
          F.glMs += ms;
          if (k === 'linkProgram') {
            F.links++;
            if (R.phase === 'boot') {
              const st = (new Error().stack ?? '').split(String.fromCharCode(10)).slice(2, 12).map((x) => x.split('@')[0]).join(' < ');
              (R.linkStacks ??= {})[st] = (R.linkStacks[st] ?? 0) + 1;
            }
          }
          if (k === 'compileShader') F.compiles++;
          if (ms > 8 && F.slow.length < 8) F.slow.push([k, +ms.toFixed(1), (new Error().stack ?? '').split('\n').slice(2, 9).map((s) => s.trim().slice(0, 90)).join(' < ')]);
        }
        return r;
      };
    }
  }
  // --linkcost: wait for every program right after its link (serialises the driver, so frame
  // times mean nothing then) and record what each cost: shader name, point lights, target
  if (window.__linkcost) {
    const src = new WeakMap();
    const C = window.WebGL2RenderingContext.prototype;
    const ss = C.shaderSource;
    C.shaderSource = function (sh, text) {
      src.set(sh, text);
      return ss.call(this, sh, text);
    };
    const link = C.linkProgram;
    C.linkProgram = function (prog) {
      const t = performance.now();
      link.call(this, prog);
      this.getProgramParameter(prog, this.LINK_STATUS);
      const ms = performance.now() - t;
      const text = (this.getAttachedShaders(prog) ?? []).map((sh) => src.get(sh) ?? '').join(String.fromCharCode(10));
      const name = /#define SHADER_NAME (\S+)/.exec(text)?.[1] ?? /#define SHADER_TYPE (\S+)/.exec(text)?.[1] ?? '?';
      const pl = /#define NUM_POINT_LIGHTS (\d+)/.exec(text)?.[1] ?? '-';
      (R.linkCost ??= []).push([+ms.toFixed(0), name, pl, text.length, R.phase]);
    };
  }
  // outside rAF (timers, promise jobs) go into the frame that follows them
  R.cur = newFrame(performance.now());
  const raf = window.requestAnimationFrame.bind(window);
  let lastFrameAt = 0;
  window.requestAnimationFrame = (cb) =>
    raf((now) => {
      if (now !== lastFrameAt) {
        // a new frame: close the previous one
        const F = R.cur;
        F.gap = lastFrameAt ? now - lastFrameAt : 0;
        const h = window.__voxelHeroes;
        F.mode = h?.state?.mode ?? null;
        F.programs = h?.gfx?.renderer?.info?.programs?.length ?? 0;
        F.key = h?.state?.screenKey ?? null;
        const fe = document.getElementById('fade');
        F.fade = !fe ? '' : fe.style.background.startsWith('radial') ? 'iris' : +fe.style.opacity >= 1 ? 'black' : +fe.style.opacity > 0 ? 'dim' : '';
        R.frames.push(F);
        if (R.frames.length > 4000) R.frames.splice(0, 1000);
        R.cur = newFrame(now);
        lastFrameAt = now;
        if (R.titleAt === null && h?.state?.mode === 'title') R.titleAt = performance.now();
      }
      const t = performance.now();
      try {
        cb(now);
      } finally {
        R.cur.js += performance.now() - t;
      }
    });
});

await page.goto(`${url}?seed=1&look=${lookLevel}`);
await page.waitForFunction(() => window.__probe?.titleAt !== null && window.__voxelHeroes?.version >= 1, null, { timeout: 30000 });
const titleMs = await page.evaluate(() => Math.round(window.__probe.titleAt));
if (process.argv.includes('--boot')) {
  // the frames up to the title and just after: when each came, the JS inside it, links
  const boot = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource').filter((r) => /.js$/.test(r.name)).map((r) => [r.name.split('/').pop(), Math.round(r.responseEnd)]);
    return { dcl: Math.round(nav?.domContentLoadedEventEnd ?? 0), load: Math.round(nav?.loadEventEnd ?? 0), res, frames: window.__probe.frames.slice(0, 16).map((f) => [Math.round(f.at), Math.round(f.gap), Math.round(f.js), Math.round(f.glMs), f.links, f.mode]) };
  });
  console.log(`boot: DOMContentLoaded ${boot.dcl} ms, load ${boot.load} ms, scripts ${JSON.stringify(boot.res)}`);
  console.log(`  frames [at, gap, js, gl, links, mode]: ${JSON.stringify(boot.frames)}`);
  for (const [st, n] of Object.entries(await page.evaluate(() => window.__probe.linkStacks ?? {}))) console.log(`  ${n} links: ${st}`);
}
await page.waitForTimeout(4000);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.evaluate(() => window.__voxelHeroes.camera.choose('A'));

async function door(name, spot, stick, inside) {
  await page.evaluate(([k, x, z]) => window.__voxelHeroes.teleport(k, x, z, { yaw: Math.PI }), spot);
  await page.evaluate(() => (window.__probe.phase = 'approach'));
  await page.waitForTimeout(3000);
  const before = await page.evaluate(() => window.__voxelHeroes.gfx.renderer.info.programs.map((p) => p.cacheKey));
  return page.evaluate(
    async ([name, stick, inside]) => {
      const h = window.__voxelHeroes;
      const R = window.__probe;
      R.phase = name;
      const from = h.state.screenKey.split(':')[0];
      const t = performance.now();
      await new Promise((done) => {
        const step = () => {
          const outside = h.state.mode === 'play' && h.state.screenKey.startsWith(from);
          h.input.setStick(outside ? stick[0] : 0, outside ? stick[1] : 0);
          if ((h.state.mode === 'play' && h.state.screenKey.startsWith(inside)) || performance.now() - t > 12000) {
            h.input.setStick(0, 0);
            return done();
          }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      await new Promise((r) => setTimeout(r, 1000));
      R.phase = 'after';
      return { ok: h.state.screenKey.startsWith(inside), key: h.state.screenKey, ms: Math.round(performance.now() - t), lighting: h.look.lighting() };
    },
    [name, stick, inside]
  ).then(async (r) => {
    // the programs made on the way in, each against the old program of the same shader that differs least
    const after = await page.evaluate(() => window.__voxelHeroes.gfx.renderer.info.programs.map((p) => ({ name: p.name, key: p.cacheKey, id: p.id })));
    const old = new Set(before);
    const fresh = after.filter((p) => !old.has(p.key));
    // who uses them: meshes in the scene whose material's current program is new
    r.users = await page.evaluate((freshKeys) => {
      const { renderer, scene } = window.__voxelHeroes.gfx;
      const keys = new Set(freshKeys);
      const out = new Map();
      scene.traverse((o) => {
        for (const m of [o.material].flat()) {
          if (!m) continue;
          const mp = renderer.properties.get(m);
          const pr = [...(mp.programs?.values?.() ?? [])].find((q) => keys.has(q.cacheKey));
          if (!pr) continue;
          const path = [];
          for (let q = o; q && path.length < 3; q = q.parent) path.push(q.name || q.type);
          const g = o.geometry;
          const flags = [o.type, o.castShadow ? 'cast' : '', o.receiveShadow ? 'recv' : '', m.vertexColors ? 'vcol' : '', m.transparent ? 'transp' : '', m.map ? 'map' : '', m.fog ? '' : 'nofog', m.toneMapped ? '' : 'notone', m.side ? 'side' + m.side : '', g ? Object.keys(g.attributes).join('+') : ''].filter(Boolean).join(' ');
          const k = `${pr.cacheKey.length}/${pr.id} ${m.type} [${flags}]`;
          const e = out.get(k) ?? { n: 0, on: path.join('<') };
          e.n++;
          out.set(k, e);
        }
      });
      return [...out].map(([k, e]) => `${e.n}x ${k} e.g. ${e.on}`);
    }, fresh.map((p) => p.key));
    r.newPrograms = fresh.map((p) => {
      const parts = p.key.split(',');
      const near = [];
      for (const k of before) {
        const q = k.split(',');
        if (q.length !== parts.length || q[0] !== parts[0]) continue;
        near.push(parts.map((v, i) => (v !== q[i] ? `#${i} ${q[i]}->${v}` : null)).filter(Boolean).join(' '));
      }
      near.sort((a, b) => a.split('#').length - b.split('#').length);
      return `${p.id} ${p.name || parts[0].slice(0, 24)}: ${near.length ? [...new Set(near)].slice(0, 3).join(' | ') : 'no match'}`;
    });
    return r;
  });
}

const runs = {};
if (doorArg === 'd1' || doorArg === 'both') runs.d1 = await door('d1', ['ow-3-2:1,2', 8.5, 12], [0, -1], 'd1');
if (doorArg === 'cave' || doorArg === 'both') {
  // a cave mouth: found at run time (the first warp tile outdoors into a cave area)
  const spot = await page.evaluate(() => {
    const h = window.__voxelHeroes;
    const w = h.world;
    for (const s of w.screens?.values?.() ?? []) {
      if (!s.streams) continue;
      for (let z = 1; z < s.h - 1; z++)
        for (let x = 1; x < s.w - 1; x++) {
          const d = w.warpAt(s.x0 + x, s.z0 + z);
          if (!d || d.screen.streams || !/cave/i.test(d.screen.area.id)) continue;
          // stand two tiles south of it if that is open ground
          if (w.blocked(s.x0 + x + 0.5, s.z0 + z + 2.5, 0.3, h.player)) continue;
          return { key: s.key, x: x + 0.5, z: z + 2.5, area: d.screen.area.id };
        }
    }
    return null;
  });
  if (spot) runs.cave = { spot, ...(await door('cave', [spot.key, spot.x, spot.z], [0, -1], spot.area)) };
  else runs.cave = { ok: false, why: 'no cave mouth found' };
}

if (process.argv.includes('--linkcost')) {
  await page.waitForTimeout(8000);
  const lc = await page.evaluate(() => window.__probe.linkCost ?? []);
  const by = {};
  for (const [ms, name, pl, len, ph] of lc) {
    const k = `${ph} ${name} lights ${pl}`;
    by[k] ??= [0, 0];
    by[k][0]++;
    by[k][1] += ms;
  }
  console.log(`link cost: ${lc.length} programs, ${lc.reduce((a, x) => a + x[0], 0)} ms`);
  for (const [k, [n, ms]] of Object.entries(by).sort((a, b) => b[1][1] - a[1][1])) console.log(`  ${ms} ms  ${n}x ${k}`);
}
const R = await page.evaluate(() => window.__probe.frames);
await browser.close();

const report = {};
for (const name of Object.keys(runs)) {
  const fr = R.filter((f) => f.phase === name);
  const gaps = fr.map((f) => f.gap);
  const slow = fr
    .filter((f) => f.gap > 25)
    .map((f) => ({
      gap: +f.gap.toFixed(0),
      js: +f.js.toFixed(0),
      gl: +f.glMs.toFixed(0),
      mode: f.mode,
      fade: f.fade,
      key: f.key,
      programs: f.programs,
      links: f.links,
      compiles: f.compiles,
      top: Object.entries(f.gl)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k, v]) => `${k} ${v.toFixed(0)}`)
        .join(', '),
      slowCalls: f.slow,
    }));
  const timeline = fr.map((f) => `${f.gap.toFixed(0)}${f.fade ? f.fade[0] : f.mode === 'play' ? 'p' : 'w'}${f.links ? '+' + f.links : ''}`).join(' ');
  report[name] = {
    timeline,
    ...runs[name],
    frames: fr.length,
    max: +Math.max(0, ...gaps).toFixed(0),
    over50: gaps.filter((g) => g > 50).length,
    programs: [fr[0]?.programs, fr.at(-1)?.programs],
    links: fr.reduce((a, f) => a + f.links, 0),
    slow,
  };
}
const result = { browser: which, look: lookLevel, titleMs, report, errors };
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 2));
}
console.log(`${which} look=${lookLevel} title at ${titleMs} ms`);
for (const [name, r] of Object.entries(report)) {
  console.log(`${name}: ok ${r.ok} -> ${r.key} (${r.lighting}); frames ${r.frames}, max ${r.max} ms, >50 ms ${r.over50}; programs ${r.programs.join(' -> ')}, links ${r.links}`);
  for (const p of r.newPrograms ?? []) console.log(`  new ${p}`);
  for (const u of r.users ?? []) console.log(`  used by ${u}`);
  if (process.argv.includes('--timeline')) console.log(`  timeline (ms, i iris / b black / d dim / p play, +links): ${r.timeline}`);
  for (const s of r.slow) {
    console.log(`  ${s.gap} ms [${s.mode} ${s.fade}] js ${s.js} gl ${s.gl} links ${s.links}: ${s.top}`);
    for (const c of s.slowCalls) console.log(`      ${c[0]} ${c[1]} ms  ${c[2]}`);
  }
}
console.log(`errors: ${errors.length}${errors.length ? ' ' + errors.slice(0, 3).join(' | ') : ''}`);
