// Usage: npx vite preview --port 4173 & node scripts/playtest-crypt.mjs <outdir>
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SP = process.argv[2];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message + e.stack));
await page.goto('http://localhost:4173/');
await page.waitForTimeout(2000);
await page.click('#start');
const step = (sec) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.__voxelHeroes.update(1 / 60); }, Math.round(sec * 60));
const st = () => page.evaluate(() => { const g = window.__voxelHeroes; return { mode: g.S.mode, sx: g.S.sx, sy: g.S.sy, hp: g.S.hp, maxHp: g.S.maxHp, keys: g.S.keys, x: +g.player.x.toFixed(2), z: +g.player.z.toFixed(2), n: g.enemies.length }; });
const tp = (sx, sy, x, z) => page.evaluate(([sx, sy, x, z]) => { const g = window.__voxelHeroes; g.S.sx = sx; g.S.sy = sy; g.player.x = sx * 16 + x; g.player.z = sy * 11 + z; g.camTarget.copy(g.screenCenter(sx, sy)); }, [sx, sy, x, z]);
const hold = async (k, sec) => { await page.keyboard.down(k); await step(sec); await page.keyboard.up(k); };
const shot = async (n) => { await page.waitForTimeout(700); await page.screenshot({ path: `${SP}/shots/${n}.png` }); };

await step(0.5);
await tp(1, 0, 8, 3.5);
await step(0.2);
await shot('e-ridge');
await hold('ArrowUp', 1.5); await step(1.2);
console.log('into crypt', JSON.stringify(await st()));
await step(1);
await shot('f-gate');
// through top door to key vault
await tp(0, 11, 8, 2); await hold('ArrowUp', 1.2); await step(1.2);
console.log('vault', JSON.stringify(await st()));
await tp(0, 10, 7.5, 6.5); await hold('ArrowUp', 0.3); await step(0.3);
console.log('after key', JSON.stringify(await st()));
await shot('g-vault');
// pillar hall, push locked door
await tp(1, 11, 8, 2); await step(0.2);
await hold('ArrowUp', 0.8); await step(0.3);
console.log('door', JSON.stringify(await st()), await page.evaluate(() => [...window.__voxelHeroes.world.flags]));
await shot('h-hall');
await hold('ArrowUp', 2); await step(1.2);
console.log('treasure room', JSON.stringify(await st()));
await tp(1, 10, 7.5, 7); await hold('ArrowUp', 0.8); await step(0.8);
console.log('chest', JSON.stringify(await st()));
await shot('i-chest');
// exit via stairs
await tp(0, 11, 7.8, 8.3); await hold('ArrowDown', 0.6); await step(1.2);
console.log('out', JSON.stringify(await st()));
console.log('errors', errors);
await browser.close();
