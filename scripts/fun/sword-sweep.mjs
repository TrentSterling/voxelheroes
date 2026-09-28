// Fun audit measurement (sword lane): swings per required hit, the number the
// task brief calls out (baseline ~1.8, target <= 1.3). Reuses the standing
// bot pattern from audit2.mjs's boss "head" section: face the nearest
// cardinal (the game's real 4-way attack facing) and tap once ready, against
// a target placed at a random small offset around "adjacent" the way real
// play never lines up perfectly. Runs the same trials twice in one page load,
// TUNING.sword.swipe forced to 0 (the old straight thrust) then left at
// whatever the build ships (systems/sword.js's default is 90), so the
// before/after is the swipe alone, nothing else.
//
//   node scripts/fun/sword-sweep.mjs [--url=http://localhost:4203/] [--trials=60] [--seed=7]
import { launch } from '../playtest.mjs';

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const URL = flags.url ?? 'http://localhost:4203/';
const TRIALS = Number(flags.trials ?? 60);
const SEED = Number(flags.seed ?? 7);
const OUT = flags.out ?? process.env.VH_AUDIT_SCRATCH; // no screenshots taken; only used for launch()'s mkdir

const t = await launch({ url: URL, seed: SEED, ...(OUT ? { out: OUT } : {}) });
await t.eval(() => window.__voxelHeroes.start());
await t.step(1.1);
await t.eval(() => {
  const h = window.__voxelHeroes;
  h.camera.choose('A');
  h.teleport('Crossroads', 8, 5.5);
});

// swipeDeg: TUNING.sword.swipe to force for this pass, or null to leave the build's own default.
// t.eval(fn, arg) forwards exactly one arg (Playwright's page.evaluate), so every input is one object.
const run = (swipeDeg, trials, seed) =>
  t.eval(
    async ({ swipeDeg, trials, seed }) => {
      const h = window.__voxelHeroes;
      const g = h.game;
      const T = g.tuning.TUNING.sword;
      const savedSwipe = T.swipe;
      if (swipeDeg != null) T.swipe = swipeDeg;
      g.swords.equipSword('blade-start');
      h.setHp(h.state.maxHp);
      for (const e of h.entities) if (e.kind === 'enemy' || e.kind === 'projectile') e.remove();
      const s = h.screen();
      const cx = s.x0 + 8, cz = s.z0 + 5.5;
      h.player.x = cx;
      h.player.z = cz;
      // a small xorshift so both passes see the exact same "bot aim" trials
      let rs = seed >>> 0 || 1;
      const rand = () => {
        rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0;
        return rs / 4294967296;
      };
      const target = h.spawn('blob', cx + 1, cz - s.z0);
      target.spawned = true;
      target.growT = 1;
      target.think = () => {}; // stand still: only the facing and the angle vary, as the brief asks
      const hurtOf = target.hurt.bind(target);
      let hitThisTrial = false;
      target.hurt = (hit) => {
        hitThisTrial = true;
        return hurtOf({ ...hit, damage: 0 }); // never dies, so one target serves every trial
      };
      let swings = 0, hits = 0;
      for (let i = 0; i < trials; i++) {
        // "adjacent": 0.9 to 1.5 tiles, any angle around the hero (real aim is never exactly on a
        // facing line); the bot only knows the 4 cardinals, so it faces the nearest one
        const a = rand() * Math.PI * 2;
        const r = 0.9 + rand() * 0.6;
        const tx = cx + Math.sin(a) * r;
        const tz = cz + Math.cos(a) * r;
        target.x = tx;
        target.z = tz;
        const dx = tx - h.player.x, dz = tz - h.player.z;
        g.hero.hero.setFacing(Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'east' : 'west') : (dz > 0 ? 'south' : 'north'));
        hitThisTrial = false;
        h.input.tap('sword');
        swings++;
        for (let k = 0; k < 20; k++) await h.tick();
        if (hitThisTrial) hits++;
        h.player.attackT = 0;
        h.player.thrust = null;
      }
      target.remove();
      T.swipe = savedSwipe;
      return { swings, hits, whiffs: swings - hits, perHit: hits > 0 ? +(swings / hits).toFixed(3) : Infinity };
    },
    { swipeDeg, trials, seed }
  );

const before = await run(0, TRIALS, SEED); // TUNING.sword.swipe: 0 restores the old straight thrust
const after = await run(null, TRIALS, SEED); // whatever the build ships (systems/sword.js default: 90)

console.log('sword-sweep (n =', TRIALS, ')');
console.log('  before (swipe 0, straight thrust):', JSON.stringify(before));
console.log('  after  (swipe, this build):        ', JSON.stringify(after));
console.log(`  swings per required hit: ${before.perHit} -> ${after.perHit} (target <= 1.3)`);

await t.close();
if (!(after.perHit <= 1.3)) {
  console.error('FAIL: swings per required hit did not reach the <= 1.3 target');
  process.exit(1);
}
console.log('PASS');
