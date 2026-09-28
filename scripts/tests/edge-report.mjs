// Where do paths lead nowhere? Every walkable tile on an outer screen edge with no screen beyond it.
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
await page.goto('http://localhost:4179/?seed=1&manual=1');
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1);
const r = await page.evaluate(() => {
  const h = window.__voxelHeroes;
  const W = h.world;
  const out = [];
  for (const s of W.screens.values()) {
    if (s.area.rooms) continue;
    const edges = [
      ['north', (i) => [s.x0 + i, s.z0], (i) => [s.x0 + i, s.z0 - 1], s.w],
      ['south', (i) => [s.x0 + i, s.z1 - 1], (i) => [s.x0 + i, s.z1], s.w],
      ['west', (i) => [s.x0, s.z0 + i], (i) => [s.x0 - 1, s.z0 + i], s.h],
      ['east', (i) => [s.x1 - 1, s.z0 + i], (i) => [s.x1, s.z0 + i], s.h],
    ];
    for (const [side, inside, beyond, n] of edges) {
      const open = [];
      for (let i = 0; i < n; i++) {
        const [ix, iz] = inside(i);
        const [bx, bz] = beyond(i);
        if (!W.isSolid(ix, iz) && !W.locate(bx, bz)) open.push(i);
      }
      if (open.length) out.push(`${s.area.id} ${s.key} "${s.name ?? ''}" ${side}: ${open.length} open tiles (${open.join(',')})`);
    }
  }
  return { areas: h.registries.areas(), nowhere: out, links: typeof h.links === 'function' ? h.links() : null };
});
await browser.close();
console.log('areas:', r.areas.join(', '));
console.log(`edges to nowhere: ${r.nowhere.length}`);
for (const l of r.nowhere) console.log('  ' + l);
console.log('links report:', JSON.stringify(r.links)?.slice(0, 600));
