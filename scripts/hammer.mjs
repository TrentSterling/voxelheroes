// Hammer test: minutes of random real-time play on the real GPU, with area loads, save/load,
// resizes and key mashing, watching for errors, stuck modes, bad positions, leaks and hitches.
// Writes a JSON receipt.
//   npx vite preview --port 4179   then   node scripts/hammer.mjs [--minutes 5] [--seed 7] [--browser firefox]
import { writeFileSync, mkdirSync } from 'node:fs';
import { chromium, firefox } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const minutes = +arg('--minutes', '5');
let seed = +arg('--seed', '7');
const ff = arg('--browser', 'chrome') === 'firefox';
const out = arg('--out', `playtest-out/hammer-${ff ? 'firefox' : 'chrome'}.json`);
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const browser = ff
  ? await firefox.launch({ headless: true, firefoxUserPrefs: { 'webgl.force-enabled': true } })
  : await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push({ t: Date.now(), kind: 'pageerror', msg: String(e.message).slice(0, 300) }));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push({ t: Date.now(), kind: 'console', msg: m.text().slice(0, 300) }); });
await page.goto('http://localhost:4179/?seed=1');
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1, null, { timeout: 30000 });
await page.evaluate(() => {
  const R = (window.__hammer = { worst: 0, over50: 0, frames: 0, last: performance.now() });
  const tick = (now) => { const d = now - R.last; R.last = now; R.frames++; if (d > R.worst) R.worst = d; if (d > 50) R.over50++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);

const areas = (await page.evaluate(() => window.__voxelHeroes.registries.areas())).filter((a) => !/^test-|kitroom/.test(a));
const MOVE = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const ACT = ['KeyJ', 'KeyK', 'KeyL', 'ShiftLeft', 'Space', 'Enter', 'Escape', 'KeyM', 'KeyI', 'Tab'];
const snap = () => page.evaluate(() => {
  const h = window.__voxelHeroes;
  const m = h.gfx.renderer.info.memory;
  return { mode: h.state.mode, area: h.world.loaded, x: h.player.x, z: h.player.z, hp: h.state.hp ?? null,
    entities: h.entities.length, geometries: m.geometries, textures: m.textures, programs: h.gfx.renderer.info.programs.length,
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, pending: h.world.pending.size };
});

const log = [];
const problems = [];
const end = Date.now() + minutes * 60000;
let nextWarp = Date.now() + 8000, nextSave = Date.now() + 20000, nextResize = Date.now() + 30000;
let lastMode = null, modeSince = Date.now(), warps = 0, saves = 0, loads = 0, resizes = 0, presses = 0;
while (Date.now() < end) {
  // a burst of play: hold a direction, mash an action or two
  const k = pick(MOVE);
  await page.keyboard.down(k);
  if (rnd() < 0.6) { await page.keyboard.press(pick(ACT)); presses++; }
  await page.waitForTimeout(150 + rnd() * 600);
  await page.keyboard.up(k);
  presses++;
  const now = Date.now();
  if (now > nextWarp) {
    nextWarp = now + 8000 + rnd() * 7000;
    const a = pick(areas);
    await page.evaluate((a) => { const h = window.__voxelHeroes; if (h.state.mode !== 'play') h.teleport(a); else h.transitions.warpTo(a); }, a).catch((e) => problems.push({ t: now, what: `warp ${a}: ${e.message}` }));
    warps++;
  }
  if (now > nextSave) {
    nextSave = now + 20000 + rnd() * 15000;
    const r = await page.evaluate(() => { const h = window.__voxelHeroes; if (h.state.mode !== 'play') return 'skip'; h.saveToSlot(1); h.loadFromSlot(1); return 'ok'; }).catch((e) => `err ${e.message}`);
    if (r === 'ok') { saves++; loads++; } else if (r !== 'skip') problems.push({ t: now, what: `save/load: ${r}` });
  }
  if (now > nextResize) {
    nextResize = now + 30000 + rnd() * 20000;
    await page.setViewportSize(pick([{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 1920, height: 1080 }, { width: 800, height: 600 }]));
    resizes++;
  }
  const s = await snap();
  if (s.mode !== lastMode) { lastMode = s.mode; modeSince = now; }
  // stuck: any non-play mode for 20 s (dialogs and menus get Enter/Escape from the mashing)
  if (s.mode !== 'play' && now - modeSince > 20000) {
    problems.push({ t: now, what: `stuck in mode '${s.mode}' for 20 s in ${s.area}` });
    await page.keyboard.press('Escape'); await page.keyboard.press('Enter');
    modeSince = now;
  }
  if (!Number.isFinite(s.x) || !Number.isFinite(s.z)) problems.push({ t: now, what: `hero position not finite: ${s.x},${s.z}` });
  if (log.length === 0 || now - log[log.length - 1].t > 5000) log.push({ t: now, ...s });
}
const fr = await page.evaluate(() => window.__hammer);
const final = await snap();
await browser.close();

// Leak check: geometry/texture/heap after the first minute vs the end (only one area is ever built).
const early = log.find((l) => l.t - log[0].t > 60000) ?? log[0];
const result = {
  browser: ff ? 'firefox' : 'chrome', minutes, seed, warps, saves, loads, resizes, presses,
  frames: fr.frames, worstFrameMs: +fr.worst.toFixed(1), framesOver50ms: fr.over50,
  errors, problems,
  growth: { geometries: [early.geometries, final.geometries], textures: [early.textures, final.textures], programs: [early.programs, final.programs], heapMB: [early.heapMB, final.heapMB], entities: [early.entities, final.entities] },
  modesSeen: [...new Set(log.map((l) => l.mode))], areasSeen: [...new Set(log.map((l) => l.area))],
  log,
};
mkdirSync('playtest-out', { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 2));
console.log(`${result.browser} ${minutes} min: ${warps} loads, ${saves} save+load, ${resizes} resizes, ${presses} presses, ${fr.frames} frames`);
console.log(`errors ${errors.length}, problems ${problems.length}, worst frame ${result.worstFrameMs} ms, frames >50ms ${fr.over50}`);
console.log(`growth ${JSON.stringify(result.growth)}`);
for (const e of errors.slice(0, 8)) console.log(`  ERR ${e.kind}: ${e.msg}`);
for (const p of problems.slice(0, 8)) console.log(`  PROBLEM ${p.what}`);
console.log(`receipt: ${out}`);
