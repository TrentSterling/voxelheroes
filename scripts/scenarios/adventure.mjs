export const description = 'Readable guard lunges, sidesteps, shield blocks, warden flanks, interrupted tells, varied dungeon rooms and tool-chain objectives.';

export default async function (t) {
  await t.track('enemy-hit', 'hero-hit');
  await t.eval(() => window.__voxelHeroes.start());
  await t.teleport('d1:3,9', 8, 6);
  await t.step(0.4);
  await t.eval(() => {
    const h = window.__voxelHeroes;
    for (const e of [...h.entities]) if (e.kind === 'enemy' || e.kind === 'pickup') e.remove();
    h.give('blade-start'); h.state.gear.shield = 1; h.setHp(h.state.maxHp);
    h.game.state.setFlag('overworld:talked:king');
    h.player.invT = 0;
    window.__adventure = {
      place(x, z, face = 'east') {
        h.player.stopDash(); h.player.knockT = h.player.lockT = h.player.stallT = h.player.attackT = 0;
        h.player.attackBuffer = 0; h.player.thrust = h.player.charge = null;
        h.player.chargeArmed = false;
        h.player.x = x; h.player.z = z; h.game.hero.hero.setFacing(face);
      },
      foe(type, x, z) {
        h.game.clears.forgetCleared(key => key === h.screen().key);
        const e = h.spawn(type, x, z, { crowned: false, spawnDelay: 0 });
        e.spawned = true; e.growT = 1; e.holder.scale.setScalar(1); return e;
      },
    };
  });
  await t.step(1.2);
  let r = await t.eval(async () => {
    const h = window.__voxelHeroes, a = window.__adventure, s = h.screen();
    a.place(s.x0 + 8, s.z0 + 6, 'west');
    const foe = a.foe('skeleton', 5.5, 6); a.guard = foe;
    for (let i = 0; i < 120 && foe.ai.melee.phase !== 'aim'; i++) await h.tick();
    const start = { x: foe.x, z: foe.z };
    await h.step(0.3); h.render();
    return { phase: foe.ai.melee.phase, cue: foe.cue.visible, pose: foe.mesh.pose,
      held: Math.hypot(foe.x - start.x, foe.z - start.z), harmless: foe.harmless };
  });
  t.expect(r.phase === 'aim' && r.cue && r.pose === 'aim' && r.held < 0.001 && r.harmless, `a raised blade and floor marks give a stationary, harmless wind-up (${JSON.stringify(r)})`);
  await t.shot('01-guard-windup');
  r = await t.eval(async () => {
    const h = window.__voxelHeroes, a = window.__adventure, foe = a.guard;
    const hp = h.state.hp, z = foe.z;
    h.input.setStick(0, 1); await h.step(0.35);
    h.input.setStick(0, 0);
    await h.step(0.45); h.render();
    return { hp, after: h.state.hp, z, afterZ: foe.z, phase: foe.ai.melee.phase, x: foe.x };
  });
  t.expect(r.after === r.hp && Math.abs(r.afterZ - r.z) < 0.01 && r.phase === 'recover', `a sidestep evades the committed lunge and leaves recovery (${JSON.stringify(r)})`);
  await t.shot('02-guard-missed');
  r = await t.eval(async () => {
    const h = window.__voxelHeroes, a = window.__adventure, foe = a.guard;
    a.place(foe.x - 1.6, foe.z, 'east'); h.player.invT = 0; h.setHp(5);
    const hp = foe.hp; h.input.tap('sword'); await h.step(0.18);
    return { hp, after: foe.hp, phase: foe.ai.melee.phase };
  });
  t.expect(r.after < r.hp && r.phase === 'recover', `a real sword counterattack lands during recovery (${JSON.stringify(r)})`);

  r = await t.eval(async () => {
    const h = window.__voxelHeroes, a = window.__adventure, s = h.screen();
    a.guard.remove(); a.place(s.x0 + 8, s.z0 + 6, 'west'); h.setHp(6); h.player.invT = 0;
    const e = a.foe('skeleton', 5.5, 6); a.guard = e;
    h.input.down('guard'); await h.step(1.4); h.input.up('guard');
    return { hp: h.state.hp, knock: e.knockT, stun: e.stunT };
  });
  const hits = await t.events('hero-hit');
  t.expect(r.hp === 6 && hits.some(hit => hit.result === 'blocked'), 'holding a shield toward a lunge blocks it without losing health');

  r = await t.eval(async () => {
    const h = window.__voxelHeroes, a = window.__adventure, s = h.screen();
    a.guard.remove(); a.place(s.x0 + 8, s.z0 + 7.6, 'north'); h.setHp(5);
    const w = a.foe('barrow-warden', 8, 6); a.warden = w; w.yaw = 0; w.think = () => {};
    await h.tick(); const hp = w.hp;
    h.input.tap('sword'); await h.step(0.3);
    return { hp, after: w.hp };
  });
  t.expect(r.after === r.hp, `the warden stops a real sword thrust from the front (${JSON.stringify(r)})`);
  await t.shot('03-warden-front');
  r = await t.eval(async () => {
    const h = window.__voxelHeroes, a = window.__adventure, w = a.warden;
    a.place(w.x, w.z - 1.6, 'south');
    const hp = w.hp; h.input.tap('sword'); await h.step(0.2);
    return { hp, after: w.hp, phase: w.ai.melee.phase };
  });
  t.expect(r.after < r.hp && r.phase === 'recover', 'a real sword thrust from behind bypasses the shield and staggers the warden');

  r = await t.eval(() => {
    const h = window.__voxelHeroes, w = window.__adventure.warden;
    w.ai.melee.phase = 'aim'; w.stunT = w.knockT = 0; w.harmless = true;
    w.cue.visible = true; w.mesh.setPose('aim');
    const hit = h.game.damage.dealDamage(w, { amount: 4, source: 'pot', from: { x: w.x, z: w.z + 2 } });
    return { result: hit.result, phase: w.ai.melee.phase, cue: w.cue.visible, hp: w.hp };
  });
  t.expect(r.result === 'hit' && r.phase === 'recover' && !r.cue, 'a frontal pot hit bypasses steel and cancels the pending lunge');

  await t.teleport('d1:4,6', 8, 9.5);
  await t.eval(() => window.__voxelHeroes.player.invT = 999);
  await t.step(1.3);
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    return { warden: h.entities.filter(e => e.type === 'barrow-warden').length,
      pots: h.screen().tiles.flat().filter(tile => tile === 'v').length,
      shutter: h.world.isSolid(h.screen().x0 + 7, h.screen().z0 + 11) };
  });
  t.expect(r.warden === 1 && r.pots >= 4 && r.shutter, 'the boomerang encounter places a red warden, throwable pots, cover and closed fight shutters');
  await t.eval(() => window.__voxelHeroes.player.hero.root.visible = true);
  await t.shot('04-turning-room');

  r = await t.eval(() => {
    const h = window.__voxelHeroes, g = h.game, read = () => g.objective.objectiveId();
    g.state.setFlag('overworld:talked:king');
    const steps = [read()];
    g.dungeons.giveMap('d1'); steps.push(read());
    g.state.setFlag('dungeon:d1:door:I-4:n'); steps.push(read());
    g.grants.grant('boomerang', 1, { fanfare: false }); steps.push(read());
    g.state.setFlag('dungeon:d1:keytaken:G-4'); steps.push(read());
    g.state.setFlag('dungeon:d1:keytaken:E-3'); steps.push(read());
    g.dungeons.giveBossKey('d1'); steps.push(read());
    return steps;
  });
  t.expect(JSON.stringify(r) === JSON.stringify(['barrow-map', 'barrow-first-keys', 'barrow-tool', 'barrow-eye', 'barrow-bones', 'big-key', 'beat-boss']), `the objective follows map, keys, tool, eyes and boss (${r.join(' > ')})`);
}
