// Village errands (game/errands.js): a marker over anyone with a job to offer, accepting and
// delivering it, and one that sends the hero to another screen before it can close.
export const description = 'Errands: offer, accept, deliver flowers, physically find Nell\'s locket in a bush, save the find and return for a heart piece.';

// One conversation: open it, answer every page and choice with the first option, let it settle.
const TALK_SRC = `async (h, name) => {
  const n = h.entities.find((e) => e.name === name);
  n.onInteract(h.player);
  for (let i = 0; i < 400 && h.state.mode === 'dialog'; i++) {
    if (i % 20 === 0) h.input.tap('confirm');
    await h.tick();
  }
  for (let i = 0; i < 10; i++) await h.tick();
  return n;
}`;

export default async function (t) {
  await t.press('Enter');
  await t.step(1.1);
  await t.teleport('v1:1,1', 8, 8);
  await t.step(0.3);

  // Hettie has an errand to offer: a persistent "!" over her head, well before any greeting.
  const offer = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const n = h.entities.find((e) => e.name === 'Hettie');
    for (let i = 0; i < 15; i++) await h.tick();
    return n.bubble.mark;
  });
  t.expect(offer === '!', `Hettie shows "!" with an errand to offer (${offer})`);
  await t.shot('errands-01-offer');

  // Accept it (the first choice): the errand goes active, and empty-handed the marker turns to "?".
  const accept = await t.eval(
    async (src) => {
      const h = window.__voxelHeroes;
      const talk = new Function(`return (${src})`)();
      h.state.forage.wildflower = 0;
      await talk(h, 'Hettie');
      const n = h.entities.find((e) => e.name === 'Hettie');
      for (let i = 0; i < 15; i++) await h.tick();
      return { status: h.state.errands?.Hettie?.status, mode: h.state.mode, mark: n.bubble.mark };
    },
    TALK_SRC
  );
  t.expect(accept.status === 'active', `accepting Hettie's errand marks it active (${accept.status})`);
  t.expect(accept.mode === 'play', 'the conversation closes back to play, not stuck in dialog');
  t.expect(accept.mark === '?', `and shows "?" while the three wildflowers are still short (${accept.mark})`);

  // Deliver 3 wildflowers: the errand completes, a heart piece comes with it, and the flowers spend.
  const deliver = await t.eval(
    async (src) => {
      const h = window.__voxelHeroes;
      const talk = new Function(`return (${src})`)();
      h.state.forage.wildflower = 3;
      const before = h.state.heartPieces ?? 0;
      await talk(h, 'Hettie');
      return { status: h.state.errands?.Hettie?.status, before, after: h.state.heartPieces, left: h.state.forage.wildflower };
    },
    TALK_SRC
  );
  t.expect(deliver.status === 'done', `delivering 3 wildflowers completes Hettie's errand (${deliver.status})`);
  t.expect(deliver.after > deliver.before, `and raises heartPieces (${deliver.before} -> ${deliver.after})`);
  t.expect(deliver.left === 0, `the 3 wildflowers are spent, not just counted (${deliver.left} left)`);
  await t.shot('errands-02-hettie-done');

  // Nell's errand needs another screen: her locket is lost out at Barrow Crossing (ow-3-2), a
  // full area away from Mossbrook. Accept it here, find it out there, close it back home.
  const nellAccept = await t.eval(
    async (src) => {
      const h = window.__voxelHeroes;
      const talk = new Function(`return (${src})`)();
      await talk(h, 'Nell');
      return { status: h.state.errands?.Nell?.status };
    },
    TALK_SRC
  );
  t.expect(nellAccept.status === 'active', `Nell's errand accepts (${nellAccept.status})`);

  await t.teleport('ow-3-2:1,1', 8, 8);
  await t.step(0.3);
  t.expect(!(await t.eval(() => window.__voxelHeroes.state.errands?.Nell?.found ?? false)), 'entering Barrow Crossing does not find the locket');
  await t.eval(() => {
    const h = window.__voxelHeroes, s = h.screen();
    for (const e of [...h.entities]) if (e.kind === 'enemy') e.remove();
    h.game.grants.grant('blade-start', 1, { fanfare: false }); h.game.swords.equipSword('blade-start'); h.player.invT = 999;
    h.player.x = s.x0 + 2.5; h.player.z = s.z0 + 10.5;
    h.game.hero.hero.setFacing('north');
  });
  await t.step(1.3);
  await t.tap('sword'); await t.step(0.2);
  const revealed = await t.eval(() => {
    const h = window.__voxelHeroes;
    return { item: h.entities.filter(e => e.type === 'quest-locket').length, found: h.state.errands.Nell.found,
      reveal: h.state.flags.has('errand:Nell:revealed'), tile: h.world.tile(h.screen().x0 + 2, h.screen().z0 + 9), status: h.state.errands.Nell.status };
  });
  t.expect(revealed.item === 1 && revealed.reveal && !revealed.found, `a real sword cut reveals a collectible gold locket without completing the search (${JSON.stringify(revealed)})`);
  await t.step(2.4);
  await t.eval(async () => { const h = window.__voxelHeroes; h.player.x += 2; h.player.z -= 1; await h.tick(); h.player.hero.root.visible = true; });
  await t.shot('errands-03-locket-revealed');
  await t.teleport('ow-3-2:2,1', 8, 8); await t.step(0.2);
  await t.teleport('ow-3-2:1,1', 8, 8); await t.step(0.3);
  t.expect((await t.eval(() => window.__voxelHeroes.entities.filter(e => e.type === 'quest-locket').length)) === 1,
    'leaving and returning preserves exactly one unclaimed locket');
  await t.walkTo(2.5, 9.5, { allowHooks: true }); await t.step(0.3);
  const found = await t.eval(() => ({ found: window.__voxelHeroes.state.errands.Nell.found,
    items: window.__voxelHeroes.entities.filter(e => e.type === 'quest-locket').length }));
  t.expect(found.found && found.items === 0, 'walking onto the gold locket finds it and removes the world object');
  const saved = await t.save(); await t.load(saved);
  t.expect(await t.eval(() => window.__voxelHeroes.state.errands.Nell.found), 'the physical find survives save and load');

  await t.teleport('v1:1,1', 5, 14);
  await t.step(0.3);
  const nellDone = await t.eval(
    async (src) => {
      const h = window.__voxelHeroes;
      const talk = new Function(`return (${src})`)();
      const hearts = h.state.heartPieces;
      await talk(h, 'Nell');
      return { status: h.state.errands?.Nell?.status, mode: h.state.mode, hearts, after: h.state.heartPieces };
    },
    TALK_SRC
  );
  t.expect(nellDone.status === 'done', `an errand needing another screen completes back at Nell (${nellDone.status})`);
  t.expect(nellDone.mode === 'play', 'and closes back to play');
  t.expect(nellDone.after === nellDone.hearts + 1, 'returning the locket pays one permanent heart piece');
  await t.shot('errands-03-nell-done');

  // Rowan's errand is a delivery to Guard Oswin at Crownhold, a second screen away: accepting it
  // shows "!" waiting on Oswin, and talking to him closes Rowan's errand and pays the reward.
  const rowanAccept = await t.eval(
    async (src) => {
      const h = window.__voxelHeroes;
      const talk = new Function(`return (${src})`)();
      await talk(h, 'Rowan');
      return { status: h.state.errands?.Rowan?.status };
    },
    TALK_SRC
  );
  t.expect(rowanAccept.status === 'active', `Rowan's errand accepts (${rowanAccept.status})`);

  await t.teleport('ow-4-3:1,1', 5, 7);
  await t.step(0.3);
  const oswinMark = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const n = h.entities.find((e) => e.name === 'Guard Oswin');
    for (let i = 0; i < 15; i++) await h.tick();
    return n.bubble.mark;
  });
  t.expect(oswinMark === '!', `Guard Oswin shows "!" for the delivery waiting on him (${oswinMark})`);

  const rowanDone = await t.eval(
    async (src) => {
      const h = window.__voxelHeroes;
      const talk = new Function(`return (${src})`)();
      const before = h.state.errands?._smithDiscount ?? 0;
      await talk(h, 'Guard Oswin');
      return { rowan: h.state.errands?.Rowan?.status, before, after: h.state.errands?._smithDiscount ?? 0 };
    },
    TALK_SRC
  );
  t.expect(rowanDone.rowan === 'done', `delivering to Guard Oswin closes Rowan's errand (${rowanDone.rowan})`);
  t.expect(rowanDone.after > rowanDone.before, `and its smith discount is waiting (${rowanDone.before} -> ${rowanDone.after})`);

  // Rook offers a physical dice adventure at West Gate. Cutting ordinary
  // brush cannot complete it; rook-den.mjs proves the full route and reward.
  await t.teleport('v1:0,1', 12, 9);
  await t.step(0.3);
  const rookOffer = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const n = h.entities.find((e) => e.name === 'Rook');
    for (let i = 0; i < 15; i++) await h.tick();
    return n?.bubble.mark ?? null;
  });
  t.expect(rookOffer === '!', `Rook shows "!" with an errand to offer (${rookOffer})`);

  const rookAccept = await t.eval(
    async (src) => {
      const h = window.__voxelHeroes;
      const talk = new Function(`return (${src})`)();
      await talk(h, 'Rook');
      return { status: h.state.errands?.Rook?.status };
    },
    TALK_SRC
  );
  t.expect(rookAccept.status === 'active', `Rook's errand accepts (${rookAccept.status})`);

  const rookBush = await t.eval(() => {
    const h = window.__voxelHeroes;
    const s = h.screen();
    for (let z = 0; z < s.h; z++)
      for (let x = 0; x < s.w; x++)
        if (s.tiles[z][x] === 'B') return { x: s.x0 + x, z: s.z0 + z };
    return null;
  });
  if (!rookBush) {
    t.note('No "B" bush tile at the West Gate yet (the content lane places it separately); Rook\'s offer and accept are proven above.');
  } else {
    await t.eval(({ x, z }) => {
      const h = window.__voxelHeroes;
      h.world.trigger(x, z, 'onSword', { player: h.player, hit: { source: 'sword' } });
    }, rookBush);
    const rookFound = await t.eval(() => window.__voxelHeroes.state.errands?.Rook?.found ?? false);
    t.expect(!rookFound, 'cutting an ordinary West Gate bush cannot pretend Rook\'s stolen dice were recovered');
    t.expect(await t.eval(()=>window.__voxelHeroes.state.errands.Rook.status)==='active','the dice errand stays active until the actual den chest is collected');
    t.note('The rook-den scenario verifies the real den route, dice chest and one-time quiver/bomb turn-in.');
  }
}
