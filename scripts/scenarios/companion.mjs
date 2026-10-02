export const description = 'Recruit Mira through real conversation choices, follow around terrain and across an edge, safe era arrival, one companion after reload, wrench support after real attacks, charged-spin combination cost/cooldown/walls, dismiss/recruit and phone UI. Combat targets and the Copper Memory grant are disclosed fixtures; input, movement, dialogue and save/load are real.';

export default async function (t) {
  const shot = async name => { await t.eval(() => { window.__voxelHeroes.player.hero.root.visible = true; }); await t.shot(name); };
  const view = () => t.eval(() => window.__voxelHeroes.game.companions.companionView());
  const dismiss = choice => t.eval(async choice => {
    const h = window.__voxelHeroes;
    for (let i = 0; i < 1000 && h.state.mode === 'dialog'; i++) {
      const d = h.game.dialog.dialogView();
      if (d.choices && d.page === d.pages - 1) {
        if (d.choice !== choice) h.input.tap('down'); else h.input.tap('confirm');
      } else if (i % 15 === 0) h.input.tap('confirm');
      await h.tick();
    }
  }, choice);
  const spin = async () => {
    await t.page.keyboard.down('j'); await t.step(1.8);
    const ready = await t.eval(() => !!window.__voxelHeroes.player.charge?.ready);
    await t.page.keyboard.up('j'); await t.step(1 / 60);
    t.expect(ready, 'real held sword input reaches a charged spin');
  };
  await t.eval(() => { const h = window.__voxelHeroes; h.game.audio.setMuted(true); h.game.settings.setSetting('npcVoices', false); });
  await t.press('Enter'); await t.step(1.1);
  t.expect(!(await view()).recruited, 'Mira starts as a town resident');
  await t.eval(() => {
    const h = window.__voxelHeroes, npc = h.entities.find(e => e.type === 'npc-mira'), s = h.screen();
    h.game.hero.hero.place(npc.x - s.x0, npc.z - s.z0 + 1); h.game.hero.hero.setFacing('north');
  });
  await t.tap('sword'); t.expect((await t.state()).mode === 'dialog', 'actual Talk input opens Mira conversation');
  await dismiss(0); await t.step(.1);
  t.expect((await view()).recruited && (await view()).mira?.visible, 'the Travel with Mira choice recruits a visible companion');
  t.expect(await t.eval(() => { const h = window.__voxelHeroes; return h.entities.filter(e => e.kind === 'companion' && !e.removed).length === 1 && h.entities.filter(e => e.type === 'npc-mira').every(e => !e.out && !e.solid && !e.object.visible); }), 'one travelling Mira replaces the resident presentation and collider');
  await shot('01-mira-joins');
  await t.walkTo(7.5,10.5); await t.walkTo(5.5,10.5); await t.step(.6);
  t.expect((await view()).nearby && !(await view()).mira.blocked, 'Mira follows real walking without standing inside terrain');
  await t.teleport('mossbrook-past:1,0',13.5,9.5); await t.step(.2);
  t.expect((await view()).nearby && !(await view()).mira.blocked, 'era arrival places Mira on a safe floor');
  await t.eval(() => { const h = window.__voxelHeroes; h.game.hero.hero.setFacing('east'); });
  await t.hold('ArrowRight',.9); await t.step(1.1);
  t.expect((await t.state()).key === 'mossbrook-past:2,0', 'actual eastward movement enters the workshop');
  await t.step(1);
  t.expect((await view()).nearby && !(await view()).mira.blocked, 'the same Mira follows across the actual room edge');
  await shot('02-mira-workshop');
  await t.teleport('Crossroads',8,5.5); await t.step(.2);
  await t.eval(() => {
    const h = window.__voxelHeroes;
    for (const e of h.entities) if (e.kind === 'enemy') e.remove();
    h.give('blade-start'); h.game.swords.equipSword('blade-start');
    h.player.invT = 999; h.game.hero.hero.setFacing('north');
    const c = h.game.companions.companionView().mira, s = h.screen();
    const e = h.spawn('slime', c.x - s.x0 + .8, c.z - s.z0);
    e.hp = e.maxHp = 999; e.spawned = true; e.growT = 1; e.update = () => {}; window.__companionTarget = e;
    window.__companionHits = [];
    h.events.on('enemy-hit', event => { if (event.entity === e) window.__companionHits.push({ source: event.hit?.source, swing: event.hit?.swingId, damage: event.damage, result: event.result }); });
  });
  const hp = await t.eval(() => window.__companionTarget.hp);
  await t.step(2);
  t.expect(await t.eval(() => window.__companionTarget.hp) === hp, 'Mira does not attack idle enemies or farm a room alone');
  await t.tap('sword'); await t.step(.3);
  t.expect(await t.eval(() => window.__companionHits.some(hit => String(hit.swing).startsWith('mira-') && hit.damage === 1)), 'a real player attack prompts a one-point wrench assist');
  await t.step(.8);
  const beforeUnlock = await t.eval(() => window.__voxelHeroes.state.magic);
  await spin();
  t.expect((await view()).techniqueCount === 0 && await t.eval(() => window.__voxelHeroes.state.magic) === beforeUnlock, 'ordinary charged spin remains free before the Copper Memory unlock');
  await t.step(1);
  await t.eval(() => {
    const h = window.__voxelHeroes; h.game.grants.grant('copper-memory',1,{fanfare:false});
    h.game.hero.hero.place(8,5.5); h.game.hero.hero.setFacing('north'); h.player.invT = 999;
  });
  await t.step(.2);
  t.expect((await view()).unlocked && (await view()).ready, 'actual Copper Memory grant unlocks the combination with two magic gems');
  await shot('03-clockwork-ready');
  await spin();
  t.expect((await view()).techniqueCount === 1 && await t.eval(() => window.__voxelHeroes.state.magic) === 0, 'release triggers one Clockwork Cross and spends exactly two magic');
  t.expect(await t.eval(() => window.__companionHits.some(hit => String(hit.swing).startsWith('clockwork-') && hit.damage === 6)), 'the combination resolves six real spin damage through the normal combat pipeline');
  t.expect((await view()).cooldown > 3.8, 'the combination starts a four-second cooldown');
  await t.step(.2); await shot('04-clockwork-cross');
  await t.step(.8);
  await t.eval(() => window.__voxelHeroes.game.vitals.restoreMagic(2));
  await spin();
  t.expect((await view()).techniqueCount === 1 && await t.eval(() => window.__voxelHeroes.state.magic) === 2, 'another charged release during cooldown keeps its magic and does not repeat the technique');
  await t.step(2);
  await t.eval(() => {
    const h = window.__voxelHeroes, s = h.screen(); h.world.setTile(s.x0 + 9, s.z0 + 5, 'T');
    const e = h.spawn('slime',10.5,5.5); e.hp = e.maxHp = 999; e.spawned = true; e.update = () => {}; window.__wallTarget = e;
  });
  const wallHp = await t.eval(() => window.__wallTarget.hp);
  await spin();
  t.expect((await view()).techniqueCount === 2 && await t.eval(() => window.__wallTarget.hp) === wallHp, 'a ready combination cannot damage an enemy through a solid wall');
  await t.step(1);
  await t.eval(() => { const h = window.__voxelHeroes; for (const e of h.entities) if (e.kind === 'enemy') e.remove(); h.load(h.save()); });
  await t.step(.3);
  t.expect((await view()).recruited && (await view()).mira?.visible && await t.eval(() => window.__voxelHeroes.entities.filter(e => !e.removed && e.kind === 'companion').length) === 1, 'save/load retains recruitment without duplicating Mira');
  await t.teleport('v1:1,1',8,10); await t.step(.3);
  for (const [width,height] of [[320,568],[568,320]]) {
    await t.page.setViewportSize({width,height}); await t.step(.1); await shot(`05-tech-${width}`);
  }
  // Use the real companion conversation to tell her to wait.
  await t.eval(() => { const h = window.__voxelHeroes, c = h.entities.find(e => e.kind === 'companion'), s = h.screen(); h.game.hero.hero.place(c.x - s.x0,c.z - s.z0 + 1); h.game.hero.hero.setFacing('north'); });
  await t.tap('sword'); await dismiss(1); await t.step(.2);
  t.expect(!(await view()).recruited && !(await view()).mira.visible, 'Wait in town dismisses the travelling companion');
  t.expect(await t.eval(() => window.__voxelHeroes.entities.find(e => e.type === 'npc-mira')?.out), 'Mira becomes a visible resident again after dismissal');
  await t.eval(() => window.__voxelHeroes.game.progress.startNewGame()); await t.step(.1);
  t.expect(!(await view()).recruited && !(await view()).unlocked && (await view()).techniqueCount === 0, 'new adventure clears recruitment, technique unlock and runtime combat state');
}
