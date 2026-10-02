// A charged spin mid-swipe, for the trail.  node scripts/art/spin-shot.mjs [out.png]
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'playtest-out/spin.png';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:4179/?seed=1');
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const h = window.__voxelHeroes;
  h.teleport('Crossroads', 8, 5.5);
  for (const e of h.entities) if (e.kind === 'enemy') e.remove();
  h.setHp(h.state.maxHp);
});
await page.waitForTimeout(600);
await page.keyboard.down('KeyJ');
await page.waitForTimeout(1300);
await page.keyboard.up('KeyJ');
await page.waitForTimeout(140);
await page.screenshot({ path: out, clip: { x: 340, y: 160, width: 600, height: 420 } });
await browser.close();
console.log(out);
