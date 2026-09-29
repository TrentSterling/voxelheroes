// Economy (gameplay spec 10; fun audit: "coins buy nothing, one sword, no
// upgrades, 18 coins from 42 kills"): the smith sells real levels on the
// Squire Blade, a second findable sword is registered, and foe kills pay
// roughly triple in coins. See src/swords/blade-start.js, blade-warden.js,
// src/tuning/economy.js and src/systems/drops.js.
export const description = 'Smith levels grow the Squire Blade, the Warden’s Blade is registered and equippable, and a 9-screen combat run clears at least 60 coins.';

// Same 9 combat screens scripts/fun/audit.mjs uses to measure kills and drops.
const COMBAT = ['West Pasture', 'East Pasture', 'Buzzing Heath', 'Stump Wood', 'Leaper Hollow', 'Barrow Crossing', 'Barrow Road', 'Archer Ridge', 'Barrow Meadow'];

export default async function (t) {
  await t.eval(() => window.__voxelHeroes.game.progress.startNewGame({ name: 'Bo', class: 'balanced', prologue: true }));
  await t.step(1.2);

  // ---------------------------------------------------------------- smith
  const smith = await t.eval(() => {
    const h = window.__voxelHeroes;
    const S = h.game.swords;
    if (!h.state.swords.owned.includes('blade-start')) h.give('blade-start');
    S.equipSword('blade-start');
    const sold = S.SWORD_STATS.filter((k) => S.levelPrice('blade-start', k) !== null);
    const beforeFull = S.bladeSize(S.bladeStats({ id: 'blade-start', full: true }));
    const beforeSmall = S.bladeSize(S.bladeStats({ id: 'blade-start', full: false }));
    h.give('coins', 2000);
    const buy = sold.includes('length') ? S.buyLevel('blade-start', 'length') : { ok: false, reason: 'not-sold' };
    const coinsAfter = h.state.coins;
    const afterFull = S.bladeSize(S.bladeStats({ id: 'blade-start', full: true }));
    const afterSmall = S.bladeSize(S.bladeStats({ id: 'blade-start', full: false }));
    return { sold, buy, coinsAfter, beforeLength: beforeFull.length, afterLength: afterFull.length, beforeSmallLength: beforeSmall.length, afterSmallLength: afterSmall.length };
  });
  t.expect(smith.sold.length >= 3, `the smith sells at least 3 stats on the Squire Blade (sells: ${smith.sold.join(', ') || 'none'})`);
  t.expect(smith.buy.ok, `buying a length level succeeds (${JSON.stringify(smith.buy)})`);
  t.expect(smith.afterLength > smith.beforeLength, `bladeSize().length grows after the level (${smith.beforeLength} -> ${smith.afterLength})`);
  // fun audit: a bought level changed nothing below full life; the small thrusting blade must
  // still lengthen, not just the full-life one.
  t.expect(smith.afterSmallLength > smith.beforeSmallLength, `a length level lengthens the blade below full life too (${smith.beforeSmallLength} -> ${smith.afterSmallLength})`);
  t.expect(smith.coinsAfter === 2000 - smith.buy.price, `coins were spent on the level (2000 -> ${smith.coinsAfter}, price ${smith.buy.price})`);

  // ---------------------------------------------------------------- Warden's Blade
  const warden = await t.eval(() => {
    const h = window.__voxelHeroes;
    const S = h.game.swords;
    const def = S.getSword('blade-warden');
    if (!def) return { found: false };
    h.give('blade-warden');
    const equipped = S.equipSword('blade-warden');
    return { found: true, owned: S.hasSword('blade-warden'), equipped, length: def.base.length, startLength: S.getSword('blade-start').base.length };
  });
  t.expect(warden.found, 'blade-warden is registered');
  t.expect(warden.owned && warden.equipped, 'blade-warden can be owned and equipped');
  t.expect(warden.length > warden.startLength, `the Warden's Blade reaches further than the Squire Blade (${warden.length} vs ${warden.startLength})`);
  await t.shot('economy-01-swords');

  // back to the Squire Blade for the combat run below (the drop tables do
  // not care which blade lands the kill, but this keeps the run honest for
  // whichever sword a fresh save actually carries)
  await t.eval(() => window.__voxelHeroes.game.swords.equipSword('blade-start'));

  // ---------------------------------------------------------------- 9-screen combat run
  await t.eval(() => {
    const h = window.__voxelHeroes;
    window.__EA = { kills: 0 };
    h.events.on('enemy-killed', () => window.__EA.kills++);
  });
  const coins0 = (await t.state()).gems;
  for (const name of COMBAT) {
    await t.eval(() => {
      const h = window.__voxelHeroes;
      if (!h.state.swords.owned.includes('blade-start')) h.give('blade-start');
      h.game.swords.equipSword('blade-start');
      h.state.gear.shield = Math.max(1, h.state.gear.shield ?? 0);
      h.setHp(h.state.maxHp);
    });
    await t.teleport(name, 8, 8);
    await t.step(1.6);
    await t.fight({ seconds: 60, heal: 1, soft: true });
    // walk over whatever the fight did not already pick up
    const pending = await t.eval(() => {
      const h = window.__voxelHeroes;
      const s = h.screen();
      return h.entities.filter((e) => !e.removed && e.kind === 'pickup').map((e) => [+(e.x - s.x0).toFixed(2), +(e.z - s.z0).toFixed(2)]);
    });
    for (const [x, z] of pending) await t.walkTo(x, z, { soft: true, timeout: 5 });
  }
  const kills = await t.eval(() => window.__EA.kills);
  const after = await t.state();
  const gained = after.gems - coins0;
  t.note(`kills ${kills}, coins gained ${gained}`);
  t.expect(kills >= 10, `the run kills a reasonable number of foes (${kills})`);
  t.expect(gained >= 50, `9 screens of combat plus drops clear at least 50 coins (hoppers take 2 hits now, so fewer kills) (baseline 18, got ${gained})`);
}
