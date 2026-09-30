export const description = 'Lift and throw pots with real A input, moving while carrying, enemy damage, walls, room transitions, and clear arrival after regrowth and save/load.';

export default async function (t) {
  await t.track('pot-lifted', 'pot-thrown', 'enemy-hit', 'pot-broken');
  await t.press('Enter');
  const setup = async () => {
    await t.teleport('d1:3,9', 2.5, 3.4);
    await t.step(0.1);
    await t.eval(() => {
      const h = window.__voxelHeroes;
      h.player.invT = 999;
      h.game.hero.hero.setFacing('north');
    });
  };
  const carry = () => t.eval(() => !!window.__voxelHeroes.player.carrying);
  const shot = async (name) => {
    const visible = await t.eval(() => { const root = window.__voxelHeroes.player.hero.root; const visible = root.visible; root.visible = true; return visible; });
    try { await t.shot(name); } finally { await t.eval((visible) => { window.__voxelHeroes.player.hero.root.visible = visible; }, visible); }
  };
  const clear = () => t.eval(() => {
    const h = window.__voxelHeroes;
    return !h.world.blocked(h.player.x, h.player.z, h.player.r, h.player);
  });

  await setup();
  let p = await t.eval(() => {
    const h = window.__voxelHeroes;
    h.render();
    return { armed: h.state.swords.equipped, prompt: h.game.promptHud.promptView(), swings: h.player.swingId };
  });
  t.expect(p.armed === null && p.prompt.some((p) => p.label === 'Lift pot'), 'an unarmed hero sees Lift pot in the canvas');
  await t.tap('sword');
  t.expect(await carry(), 'A lifts the pot, before owning a sword');
  const lifted = await t.eval(() => {
    const h = window.__voxelHeroes;
    h.render();
    const s = h.screen();
    return { tile: h.world.tile(s.x0 + 2, s.z0 + 2), swings: h.player.swingId,
      attached: h.player.carrying.object.parent === h.player.object,
      prompt: h.game.promptHud.promptView() };
  });
  t.expect(lifted.tile === '.' && lifted.attached && lifted.swings === p.swings, 'lifting removes the solid pot and puts its model over the hero, without swinging');
  t.expect(lifted.prompt.some((p) => p.label === 'Throw pot'), 'the action label changes to Throw pot');
  await shot('01-lift');
  const x0 = (await t.state()).x;
  await t.stick(1, 0, 0.3);
  t.expect((await t.state()).x > x0 + 1 && await carry(), 'the hero walks freely while holding the pot');

  await t.eval(() => {
    const h = window.__voxelHeroes;
    h.player.x = h.screen().x0 + 5;
    h.player.z = h.screen().z0 + 6.5;
    const e = h.spawn('skeleton', h.player.x - h.screen().x0 + 2, h.player.z - h.screen().z0);
    e.spawned = true; e.growT = 1; e.think = () => {};
    window.__potTarget = e;
    window.__potHp = e.hp;
    h.game.hero.hero.setFacing('east');
  });
  await t.tap('sword');
  t.expect(!await carry(), 'a second A throws the pot');
  await t.step(0.3);
  const hit = await t.eval(() => ({ before: window.__potHp, after: window.__potTarget.hp, removed: window.__potTarget.removed, stun: window.__potTarget.stunT }));
  t.expect(hit.after < hit.before || hit.removed, `the thrown pot damages a real skeleton (${hit.before} -> ${hit.after})`);
  t.expect((await t.events('enemy-hit')).some((e) => e.damage === 4), 'a pot deals four damage through the shared combat API');
  await t.step(0.3);
  t.expect((await t.events('pot-broken')).length === 1, 'one throw shatters and rolls its loot exactly once');
  await shot('02-impact');

  await setup();
  await t.tap('sword');
  await t.tap('sword');
  await t.step(1);
  t.expect(!await carry() && (await t.eval(() => window.__voxelHeroes.entities.filter((e) => e.type === 'thrown-pot' && !e.removed).length)) === 0, 'a wall stops a throw; no ghost projectile remains');

  await setup();
  await t.tap('sword');
  await t.walkTo(12.5, 6.5);
  await t.eval(() => window.__voxelHeroes.game.hero.hero.setFacing('north'));
  await shot('04-seal-before');
  await t.tap('sword');
  await t.step(0.6);
  const seal = await t.eval(() => {
    const h = window.__voxelHeroes, s = h.screen();
    return { solved: h.state.flags.has(`pot-seal:${s.key}`), chest: h.world.tile(s.x0 + 12, s.z0 + 4) };
  });
  t.expect(seal.solved && seal.chest === 'c', 'a real pot throw rings the bronze seal and reveals a reward chest');
  const pieces0 = await t.eval(() => window.__voxelHeroes.state.heartPieces);
  await t.walkTo(12.5, 5.4);
  await t.stick(0, -1, 0.25);
  for (let i = 0; i < 8 && (await t.state()).mode !== 'play'; i++) { await t.step(0.3); await t.tap('confirm'); }
  t.expect((await t.eval(() => window.__voxelHeroes.state.heartPieces)) === pieces0 + 1, 'solving the physical puzzle awards one permanent heart piece');
  await shot('05-seal-solved');
  const solvedSave = await t.save();
  await t.load(solvedSave);
  t.expect(await t.eval(() => { const h = window.__voxelHeroes, s = h.screen(); return h.state.flags.has(`pot-seal:${s.key}`) && h.world.tile(s.x0 + 12, s.z0 + 4) === 'c'; }), 'the solved puzzle and revealed chest survive save/load');

  // Save while standing on the spot a lifted pot freed. Loading regrows that pot.
  await setup();
  await t.tap('sword');
  await t.eval(() => {
    const h = window.__voxelHeroes, s = h.screen();
    h.player.x = s.x0 + 2.5; h.player.z = s.z0 + 2.5;
  });
  const save = await t.save();
  await t.load(save);
  await t.step(0.1);
  t.expect(!await carry() && await clear(), 'loading a save on a lifted pot releases the held model and lands on clear floor');
  t.expect(await t.eval(() => { const h = window.__voxelHeroes, s = h.screen(); return h.world.tile(s.x0 + 2, s.z0 + 2) === 'v'; }), 'the source pot has regrown, reproducing the previously blocked spawn');
  await shot('03-safe-load');
  await t.teleport('d1:3,9', 2.5, 2.5);
  t.expect(await clear(), 'an arrival explicitly aimed inside an intact pot is corrected');

  await setup();
  await t.tap('sword');
  await t.exit('north');
  t.expect((await t.state()).screenName === 'Map Hall' && await carry(), 'the held pot survives a room transition');
  await t.eval(() => window.__voxelHeroes.game.hero.hero.receiveHit({ damage: 1, ignoreIframes: true, guardable: false, kind: 'hazard', from: null }));
  t.expect(!await carry(), 'taking a hit breaks the held pot and frees the hero hands');

  await setup();
  const combined = await t.eval(async () => {
    const h = window.__voxelHeroes;
    h.state.swords.owned.push('blade-start');
    h.state.swords.equipped = 'blade-start';
    h.state.gear.boots = 'boots-dash';
    h.input.tap('sword'); h.input.tap('dash');
    await h.tick();
    return { carrying: !!h.player.carrying, dashing: !!h.player.dashing };
  });
  t.expect(combined.carrying && !combined.dashing, 'an armed hero pressing lift and dash together lifts without starting a dash');
}
