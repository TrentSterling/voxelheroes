// Real-time frames of village life in Mossbrook Square: people strolling, watching and greeting.
//   npx vite preview --port 4179   then   node scripts/art/npc-shots.mjs [out-prefix]
import { chromium } from 'playwright';

const pre = process.argv[2] ?? 'playtest-out/npc';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:4179/?seed=1');
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1);
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
await page.evaluate(() => window.__voxelHeroes.teleport('Mossbrook Square', 8, 4.5));
await page.waitForTimeout(2500);
const where = () => page.evaluate(() => window.__voxelHeroes.entities.filter((e) => e.kind === 'npc').map((n) => `${n.name}@${n.x.toFixed(1)},${n.z.toFixed(1)}:${n.mind.mode}`));
const a = await where();
await page.screenshot({ path: `${pre}-1-square.png` });
await page.waitForTimeout(6000);
const b = await where();
// walk down toward Hettie (10,11) to trigger a greeting
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(700);
await page.keyboard.up('ArrowDown');
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(350);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(250);
await page.screenshot({ path: `${pre}-2-greet.png` });
await browser.close();
console.log('t=2.5s', a.join(' | '));
console.log('t=8.5s', b.join(' | '));
console.log('errors', errors.length, errors.slice(0, 2).join(' | '));
