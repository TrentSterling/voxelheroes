// Autosave and the title's Continue (systems/autosave.js, game/saves.js,
// ui/screens/title.js): a screen change writes the save (debounced, off
// 'room-enter'), a real page reload picks it back up, Continue resumes there
// with the same coins, and New adventure ignores the save and always starts
// fresh in Mossbrook Square.
export const description =
  'Autosave writes on a screen change; after a real reload the title offers Continue with a saved-area summary, Continue resumes there with the same coins, and New adventure starts fresh in Mossbrook Square regardless.';

export default async function save(t) {
  // ---------------------------------------------------------------- a fresh browser: no save yet
  await t.step(0.3);
  let ov = await t.eval(() => window.__voxelHeroes.game.overlay.overlayView());
  t.expect(ov.button === 'Start adventure' && !ov.secondary, `title: no save yet, so only Start adventure shows (${ov.button})`);

  await t.press('Enter');
  await t.step(0.5);
  let s = await t.state();
  t.expect(s.mode === 'play' && s.screenName === 'Mossbrook Square', 'new game starts in Mossbrook Square');

  // give the hero something to remember, then move to another screen
  await t.eval(() => window.__voxelHeroes.game.vitals.addCoins(37));
  await t.teleport('Cliff Hollow', 8, 8);
  await t.step(1); // past the 0.6 s autosave debounce (systems/autosave.js)
  s = await t.state();
  t.expect(s.area === 'ow-3-2' && s.screenName === 'Cliff Hollow' && s.gems === 37, `moved to Barrowfield with 37 coins, before the reload (${s.screenName}, ${s.gems})`);

  // ---------------------------------------------------------------- a real reload
  await t.page.reload();
  await t.page.waitForFunction(() => window.__voxelHeroes?.version >= 1, null, { timeout: 15000 });
  await t.step(0.3);
  s = await t.state();
  t.expect(s.mode === 'title' && s.screenName === 'Mossbrook Square', 'a reload always boots fresh at the title, in Mossbrook Square (no auto-load)');
  ov = await t.eval(() => window.__voxelHeroes.game.overlay.overlayView());
  t.expect(
    /^Continue/.test(ov.button) && /Barrowfield/.test(ov.button) && ov.secondary === 'New adventure',
    `the title now offers Continue with a summary (the area, Barrowfield) and New adventure beside it (${ov.button} / ${ov.secondary})`
  );

  // ---------------------------------------------------------------- Continue resumes the save
  await t.press('Enter'); // Continue is the primary button once a save exists (ui/screens/title.js)
  await t.step(0.3);
  s = await t.state();
  t.expect(s.mode === 'play' && s.area === 'ow-3-2' && s.screenName === 'Cliff Hollow' && s.gems === 37, `Continue resumes the save: same area and coins (${s.screenName}, ${s.gems})`);

  // ---------------------------------------------------------------- New adventure ignores it
  await t.eval(() => window.__voxelHeroes.newGame()); // back to the title without touching the save
  await t.step(0.3);
  ov = await t.eval(() => window.__voxelHeroes.game.overlay.overlayView());
  t.expect(ov.secondary === 'New adventure', 'back at the title, the same save is still offered');
  await t.eval(() => document.getElementById('start-secondary').click());
  await t.step(0.5);
  s = await t.state();
  t.expect(s.mode === 'play' && s.screenName === 'Mossbrook Square' && s.gems === 0, `New adventure starts fresh in Mossbrook Square, ignoring the save (${s.screenName}, ${s.gems} coins)`);
}
