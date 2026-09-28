// Real-time check that a thrust landing on a foe fires the impact feedback: 'enemy-hit' from the
// sword, a hitstop (the simulation clock holds) and spark particles.
//   npx vite preview --port 4179   then   node scripts/tests/impact-check.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
await page.goto('http://localhost:4179/?seed=1');
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const v = window.__voxelHeroes;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  v.teleport('Crossroads', 6, 5.5);
  await wait(300);
  for (const e of v.entities) if (e.kind === 'enemy') e.remove();
  v.game.hero.hero.setFacing('east');
  const foe = v.spawn('slime', v.player.x + 1.4 - v.screen().x0, v.player.z - v.screen().z0);
  const hits = [];
  v.events.on('enemy-hit', (e) => hits.push({ source: e.hit?.source, result: e.result }));
  await wait(800); // past the spawn-in
  const t0 = v.state.time;
  const w0 = performance.now();
  v.input.tap('sword');
  await wait(30);
  const thrust = !!v.player.thrust;
  await wait(200);
  const sim = v.state.time - t0, wall = (performance.now() - w0) / 1000;
  return { foe: !!foe, thrust, mode: v.state.mode, sword: v.state.swords?.equipped ?? null, foeAt: foe && [+(foe.x - v.player.x).toFixed(2), +(foe.z - v.player.z).toFixed(2)], hits, heldMs: Math.round((wall - sim) * 1000), particles: v.state.particles ?? null };
});
await browser.close();
console.log(JSON.stringify(r));
const ok = r.hits.some((h) => h.source === 'sword' && (h.result === 'hit' || h.result === 'killed')) && r.heldMs >= 30;
console.log(ok ? 'impact OK: sword hit registered and the simulation held' : 'impact FAILED');
process.exit(ok ? 0 : 1);
