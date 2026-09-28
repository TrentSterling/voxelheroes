// Which shader programs still link on the spot in the first drawn frame (after the boot warm-up,
// core/warm.js): KHR_parallel_shader_compile support, then each program the first frame makes
// with how long its first use blocked. The ring around the start is built first (manual mode).
//   node scripts/perf-shaders.mjs [--url http://localhost:4201/] [--browser chrome|firefox]
import { chromium, firefox } from 'playwright';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const url = arg('--url', 'http://localhost:4201/');
const browser =
  arg('--browser', 'chrome') === 'firefox'
    ? await firefox.launch({ headless: true, firefoxUserPrefs: { 'webgl.force-enabled': true, 'gfx.webrender.all': true } })
    : await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`${url}?seed=1&look=high&manual=1`);
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1, null, { timeout: 30000 });
const r = await page.evaluate(async () => {
  const h = window.__voxelHeroes;
  const { renderer } = h.gfx;
  const gl = renderer.getContext();
  for (let i = 0; i < 900 && h.world.pending.size; i++) await h.tick();
  const out = { parallel: !!gl.getExtension('KHR_parallel_shader_compile'), before: renderer.info.programs.length, rows: [] };
  const push = renderer.info.programs.push;
  renderer.info.programs.push = function (p) {
    const real = p.getUniforms;
    let first = true;
    p.getUniforms = function () {
      if (!first) return real.call(this);
      first = false;
      const t = performance.now();
      const u = real.call(this);
      out.rows.push([p.type ?? '', String(p.cacheKey).replace(/\s+/g, ' ').slice(0, 50), +(performance.now() - t).toFixed(1)]);
      return u;
    };
    return push.call(this, p);
  };
  const t = performance.now();
  h.render();
  gl.finish();
  out.firstFrameMs = +(performance.now() - t).toFixed(0);
  out.after = renderer.info.programs.length;
  renderer.info.programs.push = push;
  return out;
});
await browser.close();
console.log(`parallel compile: ${r.parallel}; programs ${r.before} -> ${r.after}; first frame ${r.firstFrameMs} ms`);
for (const x of r.rows) console.log(`  ${String(x[2]).padStart(7)} ms  ${x[0]}  ${x[1]}`);
