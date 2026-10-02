// The title screen as a player first sees it.  node scripts/art/title-shot.mjs [out.png]
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'playtest-out/title.png';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:4179/?seed=1');
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1);
await page.waitForTimeout(2500);
await page.screenshot({ path: out });
await browser.close();
console.log(out);
