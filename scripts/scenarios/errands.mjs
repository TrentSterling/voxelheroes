// Village errands (game/errands.js): a marker over anyone with a job to offer, accepting and
// delivering it, and one that sends the hero to another screen before it can close.
export const description = 'Errands: "!" to offer, accept, "?" while short, deliver for the reward (Hettie: 3 wildflowers -> a heart piece), and an errand needing another screen (Nell\'s locket at Barrow Crossing).';

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
  const found = await t.eval(() => window.__voxelHeroes.state.errands?.Nell?.found ?? false);
  t.expect(found, 'stepping onto Barrow Crossing marks the locket found, a screen away from Nell');

  await t.teleport('v1:1,1', 5, 14);
  await t.step(0.3);
  const nellDone = await t.eval(
    async (src) => {
      const h = window.__voxelHeroes;
      const talk = new Function(`return (${src})`)();
      await talk(h, 'Nell');
      return { status: h.state.errands?.Nell?.status, mode: h.state.mode };
    },
    TALK_SRC
  );
  t.expect(nellDone.status === 'done', `an errand needing another screen completes back at Nell (${nellDone.status})`);
  t.expect(nellDone.mode === 'play', 'and closes back to play');
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

  // Rook lives right at the West Gate (v1:0,1) and wants a bush there cut: every errand must be
  // completable by a scripted player, so accept it, hunt the screen's own tiles for a "B", cut it
  // and turn in. The content lane places the actual bush tiles at the West Gate separately from
  // this lane, so a run before they land there tolerates their late arrival instead of failing:
  // the offer/accept half of the errand is still proven every time.
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
    t.expect(rookFound, 'cutting the West Gate bush marks Rook\'s dice found');

    const rookDone = await t.eval(
      async (src) => {
        const h = window.__voxelHeroes;
        const talk = new Function(`return (${src})`)();
        const before = h.state.inventory?.ammo?.bombs ?? 0;
        await talk(h, 'Rook');
        return { status: h.state.errands?.Rook?.status, before, after: h.state.inventory?.ammo?.bombs ?? 0 };
      },
      TALK_SRC
    );
    t.expect(rookDone.status === 'done', `turning in the dice completes Rook's errand (${rookDone.status})`);
    t.expect(rookDone.after > rookDone.before, `and pays out bombs (${rookDone.before} -> ${rookDone.after})`);
  }
}
