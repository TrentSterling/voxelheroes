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
    return n.bubble.emoteEl?.textContent ?? null;
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
      return { status: h.state.errands?.Hettie?.status, mode: h.state.mode, mark: n.bubble.emoteEl?.textContent ?? null };
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
    return n.bubble.emoteEl?.textContent ?? null;
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
}
