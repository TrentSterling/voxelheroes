export const description = 'Sword input buffer: an early follow-up lands, an expired tap does not, damage and menus cancel it, and holding still charges a spin.';

export default async function (t) {
  await t.eval(() => window.__voxelHeroes.game.progress.startNewGame({ prologue: false }));
  await t.teleport('Crossroads', 8, 5.5);
  await t.step(0.3);
  const swings = () => t.eval(() => window.__voxelHeroes.player.swingId);
  const before = await swings();
  await t.tap('sword');
  await t.step(0.12);
  await t.tap('sword');
  await t.step(0.15);
  t.expect(await swings() === before + 2, 'a press just before recovery produces one follow-up swing');
  await t.step(0.6);
  t.expect(await swings() === before + 2, 'the buffer never repeats the attack');

  await t.tap('sword');
  await t.tap('sword');
  await t.step(0.6);
  t.expect(await swings() === before + 3, 'a much earlier tap expires instead of becoming a surprise attack');

  await t.tap('sword');
  await t.step(0.12);
  await t.tap('sword');
  await t.press('Escape');
  await t.step(0.4);
  await t.press('Escape');
  await t.step(0.4);
  t.expect(await swings() === before + 4, 'pausing discards a pending swing');

  await t.eval(() => { const p = window.__voxelHeroes.player; p.lockT = 0.2; p.knockT = 0.2; });
  await t.tap('sword');
  await t.step(0.5);
  t.expect(await swings() === before + 4, 'hit recovery cannot be bypassed by a sword press');

  await t.page.keyboard.down('j');
  await t.step(1.8);
  const charged = await t.eval(() => !!window.__voxelHeroes.player.charge?.ready);
  await t.page.keyboard.up('j');
  await t.step(1 / 60);
  t.expect(charged && (await swings()) === before + 6, 'holding and releasing still produces a charged spin after the initial swing');
  await t.shot('01-charged-spin');
}
