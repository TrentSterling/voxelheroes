// Looking across an area border: the castle road's north edge toward Mossbrook.
//   node scripts/art/border-shot.mjs <url> <out.png>
import { chromium } from 'playwright';

const [url = 'http://localhost:4179/', out = 'playtest-out/border.png'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route(/widget\.json|discord/i, (r) => r.abort());
await page.goto(`${url}?seed=1`);
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1, null, { timeout: 30000 });
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await page.evaluate(() => window.__voxelHeroes.teleport('ow-4-3:1,0', 8, 1.5));
await page.waitForTimeout(3500);
await page.screenshot({ path: out });
await browser.close();
console.log(out);
