// Real-time frames of the hero's feel: idle, dash rev, dash charge, a thrust landing on a foe, and
// the dev cheat menu.  npx vite preview --port 4179   then   node scripts/art/feel-shots.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:4179/?seed=1&dev=1');
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1);
await page.keyboard.press('Backquote'); // close the cheat menu for the play shots
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
const h = (fn, arg) => page.evaluate(fn, arg);
await h(() => { const v = window.__voxelHeroes; v.teleport('Crossroads', 5, 5.5); v.state.gear.boots = 'boots-dash'; for (const e of v.entities) if (e.kind === 'enemy') e.remove(); });
await page.waitForTimeout(600);
const shot = (n) => page.screenshot({ path: `playtest-out/feel-${n}.png`, clip: { x: 340, y: 180, width: 600, height: 400 } });
// idle after walking
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300); await page.keyboard.up('ArrowRight');
await page.waitForTimeout(700);
const idle = await h(() => window.__voxelHeroes.game.hero.hero.pose?.() ?? null);
await shot('1-idle');
// dash: rev, then charge
await page.keyboard.press('Space');
await page.waitForTimeout(110);
await shot('2-rev');
await page.waitForTimeout(260);
await shot('3-charge');
await page.waitForTimeout(700);
// thrust into a slime
await h(() => { const v = window.__voxelHeroes; v.teleport('Crossroads', 6, 5.5); v.game.hero.hero.setFacing('east'); v.spawn('slime', 7.3, 5.5); });
await page.waitForTimeout(400);
await page.keyboard.press('KeyJ');
await page.waitForTimeout(45);
await shot('4-hit');
// cheat menu
await page.keyboard.press('Backquote');
await page.waitForTimeout(200);
await page.screenshot({ path: 'playtest-out/feel-5-cheats.png', clip: { x: 900, y: 0, width: 380, height: 520 } });
await browser.close();
console.log(`idle pose: ${idle}`);
