// The hero walked behind the Crossroads' south tree row: one shot per build, for the cutaway.
//   node scripts/art/occlusion-shots.mjs <url> <tag>
import { chromium } from 'playwright';

const [url = 'http://localhost:4179/', tag = 'after'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${url}?seed=1`);
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1);
await page.keyboard.press('Enter');
await page.waitForTimeout(2000);
await page.evaluate(() => window.__voxelHeroes.teleport('Crossroads', 8, 5.5));
await page.waitForTimeout(800);
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(650);
await page.keyboard.up('ArrowDown');
await page.waitForTimeout(700);
const z = await page.evaluate(() => window.__voxelHeroes.state && window.__voxelHeroes.player.z);
await page.screenshot({ path: `playtest-out/occl-${tag}.png` });
await browser.close();
console.log(`${tag}: hero z ${z}`);
