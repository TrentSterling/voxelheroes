// The village at 19:30: the dusk tint, the HUD clock and townsfolk gathered in the square.
//   npx vite preview --port 4179   then   node scripts/art/evening-shot.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:4179/?seed=1');
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1);
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const h = window.__voxelHeroes;
  h.teleport('Mossbrook Square', 8, 4.5);
  h.state.clock.min = 19.3 * 60;
});
await page.waitForTimeout(9000);
await page.screenshot({ path: 'playtest-out/evening.png' });
await browser.close();
console.log('playtest-out/evening.png');
