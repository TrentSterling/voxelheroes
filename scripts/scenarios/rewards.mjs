export const description = 'A boss killed over solid scenery drops an accessible heart container and coin shower, collected through real movement.';

export default async function (t) {
  await t.eval(() => window.__voxelHeroes.game.progress.startNewGame({ prologue: false }));
  await t.teleport('d1-boss', 11, 13);
  await t.step(3);
  await t.waitFor((s) => s.mode === 'play', { seconds: 5 });
  const r = await t.eval(() => {
    const h = window.__voxelHeroes, s = h.screen();
    const boss = h.entities.find((e) => e.type === 'boss-serpent' && !e.removed);
    if (!boss) return { found: false };
    boss.x = s.x0 + 16.5; boss.z = s.z0 + 10.5;
    const blocked = h.world.blocked(boss.x, boss.z, h.player.r, h.player);
    boss.die();
    const prize = h.entities.find((e) => e.type === 'heart-container' && !e.removed);
    const drops = h.entities.filter((e) => !e.removed && (e.type === 'heart-container' || /^coin-/.test(e.type)));
    return { found: true, blocked, maxHp: h.state.maxHp, drops: drops.length,
      clear: drops.every((e) => !h.world.blocked(e.x, e.z, h.player.r, h.player)),
      prize: { x: prize.x - s.x0, z: prize.z - s.z0 } };
  });
  t.expect(r.found && r.blocked, 'the boss fixture dies directly over a solid arena statue');
  t.expect(r.drops > 1 && r.clear, 'the heart container and every scattered coin land on accessible floor');
  await t.step(0.4);
  await t.walkTo(r.prize.x, r.prize.z);
  await t.step(0.4);
  t.expect((await t.state()).maxHp === r.maxHp + 2, 'walking to the prize collects a permanent heart container');
  await t.shot('01-reward-collected');
}
