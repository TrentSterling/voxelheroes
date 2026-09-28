// Frames of a real area load (iris out, card, iris in) for review.
//   npx vite preview --port 4179   then   node scripts/art/iris-shots.mjs [area=crypt]
import { chromium } from 'playwright';

const area = process.argv[2] ?? 'crypt';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto('http://localhost:4179/?seed=1');
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1);
await page.keyboard.press('Enter');
await page.waitForTimeout(2500);
await page.evaluate((a) => window.__voxelHeroes.transitions.warpTo(a), area);
const t0 = Date.now();
for (const [tag, ms] of [['a-out', 130], ['b-card', 700], ['c-in', 0]]) {
  if (tag === 'c-in') await page.waitForFunction(() => { const f = document.getElementById('fade'); return f.style.background.includes('radial') && window.__voxelHeroes.state.mode === 'warp'; }, null, { polling: 5, timeout: 8000 }).then(() => page.waitForTimeout(150));
  else await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
  await page.screenshot({ path: `playtest-out/iris-${tag}.png` });
}
await browser.close();
console.log('playtest-out/iris-*.png');
