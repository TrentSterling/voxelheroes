// In-game old vs v2 hero shots through the playtest harness (the real renderer, game camera).
//   npx vite preview --port 4179   (in another shell, after npm run build)
//   node scripts/art/hero-compare.mjs [out-dir]
import { launch } from '../playtest.mjs';

const out = process.argv[2] ?? 'playtest-out/hero-compare';
for (const [tag, q] of [['old', ''], ['v2', '?hero=v2']]) {
  const t = await launch({ url: `http://localhost:4179/${q}`, out });
  await t.press('Enter'); // title -> play
  await t.eval(() => window.__voxelHeroes.teleport('Crossroads', 8, 5.5)); // open ground
  await t.hold('ArrowDown', 0.05); // face the camera
  await t.hold('ArrowRight', 0.25);
  await t.shot(`${tag}-walk`);
  await t.hold('ArrowDown', 0.05);
  await t.shot(`${tag}-stand`);
  await t.close();
}
console.log(`shots in ${out}`);
