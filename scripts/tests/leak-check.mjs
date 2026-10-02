// GPU resource leak check: visit every area three times (teleport + render so resources upload),
// and compare the renderer's geometry/texture counts each time we are back in the first area.
//   npx vite preview --port 4179   then   node scripts/tests/leak-check.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
await page.goto('http://localhost:4179/?seed=1&manual=1');
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1);
await page.keyboard.press('Enter');
const rows = await page.evaluate(async () => {
  const h = window.__voxelHeroes;
  const { renderer, scene, camera } = h.gfx;
  const areas = h.registries.areas().filter((a) => !/^test-|kitroom/.test(a));
  const out = [];
  for (let lap = 0; lap < 3; lap++) {
    for (const a of areas) {
      h.teleport(a);
      for (let i = 0; i < 30; i++) h.step ? h.step(1 / 60) : null; // let pending screens build
      renderer.render(scene, camera);
    }
    h.teleport(areas[0]);
    for (let i = 0; i < 30; i++) h.step ? h.step(1 / 60) : null;
    renderer.render(scene, camera);
    const m = renderer.info.memory;
    let meshes = 0; scene.traverse((o) => { if (o.isMesh) meshes++; });
    out.push({ lap, geometries: m.geometries, textures: m.textures, sceneMeshes: meshes, children: scene.children.length });
  }
  return out;
});
await browser.close();
for (const r of rows) console.log(JSON.stringify(r));
const g = rows.map((r) => r.geometries);
console.log(g[2] > g[1] + 2 ? `LEAK: geometries keep growing ${g.join(' -> ')}` : `no geometry growth after the first lap (${g.join(' -> ')})`);
