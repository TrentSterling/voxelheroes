// Where an area load's time goes: build (world.loadArea via teleport), shader compile, first render
// (buffer uploads and draws), each followed by gl.finish so GPU work is counted where it happens.
//   npx vite preview --port 4179   then   node scripts/perf-load.mjs [--browser firefox]
import { chromium, firefox } from 'playwright';

const ff = process.argv.includes('--browser') && process.argv[process.argv.indexOf('--browser') + 1] === 'firefox';
const browser = ff
  ? await firefox.launch({ headless: true, firefoxUserPrefs: { 'media.volume_scale': '0.0', 'webgl.force-enabled': true } })
  : await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:4179/?seed=1&manual=1');
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1, null, { timeout: 30000 });
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
const rows = await page.evaluate(() => {
  const h = window.__voxelHeroes;
  const { renderer, scene, camera } = h.gfx;
  const gl = renderer.getContext();
  const out = [];
  for (const a of h.registries.areas().filter((a) => !/^test-|kitroom/.test(a))) {
    const p0 = renderer.info.programs.length;
    const t0 = performance.now();
    h.teleport(a);
    const t1 = performance.now();
    renderer.compile(scene, camera);
    gl.finish();
    const t2 = performance.now();
    h.render ? h.render() : renderer.render(scene, camera);
    gl.finish();
    const t3 = performance.now();
    h.render ? h.render() : renderer.render(scene, camera);
    gl.finish();
    const t4 = performance.now();
    out.push({ area: a, build: +(t1 - t0).toFixed(0), compile: +(t2 - t1).toFixed(0), first: +(t3 - t2).toFixed(0), second: +(t4 - t3).toFixed(0),
      newPrograms: renderer.info.programs.length - p0, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures });
  }
  return out;
});
await browser.close();
console.log('area           build  compile  first  second  newProg  geoms  tex');
for (const r of rows) console.log(`${r.area.padEnd(14)} ${String(r.build).padStart(5)} ${String(r.compile).padStart(8)} ${String(r.first).padStart(6)} ${String(r.second).padStart(7)} ${String(r.newPrograms).padStart(8)} ${String(r.geometries).padStart(6)} ${String(r.textures).padStart(4)}`);
