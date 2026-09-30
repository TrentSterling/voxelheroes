export const description = 'Journal button, L shortcut, quest progress/rewards, pagination, pause, save/load, keyboard navigation and phone layouts.';

export default async function(t) {
  await t.press('Enter'); await t.step(1.1);
  await t.eval(() => {
    const h = window.__voxelHeroes;
    h.state.errands.Hettie = { status: 'active', found: false };
    h.state.errands.Nell = { status: 'active', found: true };
    h.state.forage.wildflower = 2; h.render();
  });
  await t.press('KeyL');
  let r = await t.eval(() => window.__voxelHeroes.game.journal.journalView());
  t.expect(r.open && r.entries[0].giver === 'Nell' && r.entries[0].status === 'ready' && r.entries[0].reward === 'A piece of heart',
    'L opens a journal with completed finds ready to return and their permanent reward');
  t.expect(r.entries.some(e => e.giver === 'Hettie' && e.progress === '2 / 3 wildflowers'), 'the journal shows the real inventory count for an accepted quest');
  const position = await t.eval(() => ({ x: window.__voxelHeroes.player.x, z: window.__voxelHeroes.player.z }));
  await t.step(2);
  t.expect(await t.eval(p => window.__voxelHeroes.player.x === p.x && window.__voxelHeroes.player.z === p.z, position), 'the journal holds the solo hero still');
  await t.shot('01-journal-desktop');
  await t.tap('next-item');
  r = await t.eval(() => window.__voxelHeroes.game.journal.journalView());
  t.expect(r.selected === 1 && r.entries[r.selected].giver === 'Hettie', 'item-cycle input pages between tasks');
  await t.press('KeyL');
  t.expect((await t.state()).mode === 'play', 'L closes the journal back to play');
  await t.eval(() => { const h = window.__voxelHeroes; h.render(); h.game.ui.pressUi('journal-open'); h.render(); });
  t.expect(await t.eval(() => window.__voxelHeroes.game.journal.journalView().open), 'the actual canvas Journal button opens it');

  for (const [name, width, height] of [['phone', 390, 844], ['phone-wide', 844, 390]]) {
    await t.page.setViewportSize({ width, height });
    await t.eval(() => window.__voxelHeroes.render());
    const layout = await t.eval(() => {
      const h = window.__voxelHeroes, ui = h.game.ui.uiView();
      return { w: ui.w, h: ui.h, regions: ui.hits.filter(hit => hit.id.startsWith('journal-')) };
    });
    t.expect(layout.regions.length >= 5 && layout.regions.every(hit => hit.x >= 0 && hit.y >= 0 && hit.x + hit.w <= layout.w && hit.y + hit.h <= layout.h),
      `${name}: journal controls stay within the view (${JSON.stringify(layout)})`);
    await t.shot(`02-journal-${name}`);
    await t.eval(() => { const h = window.__voxelHeroes; h.game.ui.pressUi('journal-next'); h.render(); });
    t.expect(await t.eval(() => window.__voxelHeroes.game.journal.journalView().selected === 1), `${name}: the next-task button responds`);
    await t.eval(() => { const h = window.__voxelHeroes; h.game.ui.pressUi('journal-prev'); h.render(); });
  }
  await t.eval(() => window.__voxelHeroes.game.ui.pressUi('journal-close'));
  const saved = await t.save(); await t.load(saved);
  await t.tap('journal');
  r = await t.eval(() => window.__voxelHeroes.game.journal.journalView());
  t.expect(r.entries.some(e => e.giver === 'Hettie' && e.progress === '2 / 3 wildflowers') && r.entries[0].status === 'ready', 'saved quest and inventory progress restore in the journal');
}
