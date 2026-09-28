// A lineup of the dressed townsfolk on open ground, for the art review.
//   npx vite preview --port 4179   then   node scripts/art/townsfolk-lineup.mjs [out.png]
import { chromium } from 'playwright';

const out = process.argv[2] ?? 'playtest-out/townsfolk-lineup.png';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:4179/?seed=1');
await page.waitForFunction(() => window.__voxelHeroes?.version >= 1);
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const h = window.__voxelHeroes;
  h.teleport('Crossroads', 13.5, 6.8);
  for (const e of h.entities) if (e.kind === 'enemy') e.remove();
  const row = [
    ['npc-king'], ['npc-shop'], ['npc-smith'], ['npc-inn'], ['npc-inventor'],
    ['npc', { name: 'Hettie', palette: { extras: ['straw-hat'] } }],
    ['npc', { name: 'Pip', palette: { tunic: 0x4a9a5a, hair: 0xd8a040, cap: 0xd05a3a, kid: true, extras: ['scarf'] } }],
    ['npc', { name: 'Old Tobin', palette: { tunic: 0x5a5a6a, hair: 0xc8c8c8, cap: 0x3a3a44, extras: ['beard', ['hood', 0x6a6a70]] } }],
    ['npc', { name: 'Nell', palette: { tunic: 0xa04a7a, hair: 0x3a2418, cap: 0xe8d8b0, extras: ['bun', ['scarf', 0x3a8a9a]] } }],
    ['npc', { name: 'Guard', palette: { tunic: 0x6a6f7c, cap: 0x3a3a44, extras: ['helm'] } }],
  ];
  row.forEach(([type, opts], i) => {
    const n = h.spawn(type, 3 + i * 1.1, 5.5, { ...(opts ?? {}), wander: 0, yaw: 0 });
    if (n) n.mind.t = 99;
  });
});
await page.waitForTimeout(1500);
await page.screenshot({ path: out, clip: { x: 100, y: 200, width: 1080, height: 340 } });
await browser.close();
console.log(out);
