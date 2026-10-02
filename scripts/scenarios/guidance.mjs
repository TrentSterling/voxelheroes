export const description = 'Quest tracking, route guidance after both era homecomings, independent completion order, inventory-driven errands, real NPC turn-in, stable journal selection and save compatibility. Story flags and arranged locations are disclosed fixtures; no recorded audio playback.';
export default async function(t) {
  await t.eval(() => {
    const h = window.__voxelHeroes;
    h.game.progress.startNewGame({ prologue: false });
    h.game.audio.setMuted(true); h.game.audio.setVolumes({ master: 0 });
    h.game.settings.setSetting('npcVoices', false); h.player.invT = 999;
    h.game.state.setFlag('era:bell'); h.game.state.setFlag('overworld:talked:king');
  });
  const view = () => t.eval(() => {
    const o = window.__voxelHeroes.game.objective;
    return { ...o.currentStep(), tracked: o.trackedQuestId(), hud: o.objectiveHudText() };
  });
  const pin = id => t.eval(id => window.__voxelHeroes.game.objective.trackQuest(id), id);
  const flags = ids => t.eval(ids => { const h = window.__voxelHeroes; for (const id of ids) h.game.state.setFlag(id); }, ids);
  const place = key => t.teleport(key, 8, 10);
  const expectRoute = async(key, pattern, label) => {
    await place(key); const r = await view();
    t.expect(pattern.test(r.text), label + ': ' + r.text);
  };
  await expectRoute('mossbrook-future:2,0', /First Bloom/, 'A dark archive points to the prerequisite engine');
  await expectRoute('mossbrook-past:2,0', /west.*square.*engine/, 'An unpowered workshop sends the hero back to the square engine');
  await flags(['era:water-restored']);
  await pin('era-bell');
  await expectRoute('mossbrook-future:1,1', /north.*west.*Dawn Seed/, 'A pinned garden route exits the station north before turning west');
  await pin('era-archive');
  await expectRoute('mossbrook-past:1,1', /north.*east.*Workshop/, 'A pinned workshop route exits the station north before turning east');
  await pin(null);
  await expectRoute('mossbrook-future:0,0', /bridge.*seed chest/, 'The repaired engine points across the new garden bridge');
  await expectRoute('mossbrook-past:1,0', /east.*Workshop/, 'The copperwalk points to the actual workshop to the east');
  await expectRoute('mossbrook-past:2,0', /belt thieves.*valve/, 'The workshop points to combat and its valve');
  await flags(['era:dawn-seed']);
  await expectRoute('mossbrook-future:0,0', /Mossbrook \/ today/, 'A garden reward points through the gate to present-day Mira');
  await flags(['era:homecoming']);
  for (const key of ['mossbrook-future:0,0', 'mossbrook-future:1,0', 'mossbrook-future:2,0'])
    await expectRoute(key, /First Bloom/, 'After Mira homecoming the unfinished archive still points to the past workshop');
  await flags(['era:archive-powered']);
  await pin('era-archive');
  await expectRoute('mossbrook-future:1,1', /north.*east.*Archive/, 'The independently pinned archive exits the platform north before turning east');
  await pin(null);
  await expectRoute('mossbrook-past:2,0', /west.*Silent Year/, 'Tuned valves point west to the gate and the future');
  await expectRoute('mossbrook-future:0,0', /east.*Archive/, 'Future square points east to the archive');
  await expectRoute('mossbrook-future:2,0', /sentries.*memory chest/, 'Powered archive points to its guarded memory chest');
  await flags(['era:copper-memory']);
  await pin('era-archive');
  await expectRoute('mossbrook-future:1,1', /north.*west.*Tern/, 'A memory turn-in exits the platform north before turning west to Tern');
  await pin(null);
  await expectRoute('mossbrook-future:2,0', /west.*Tern/, 'Copper Memory points west to Tern');
  await expectRoute('mossbrook-future:0,0', /Talk to Tern.*choir/, 'Copper Memory points to the nearby turn-in');
  await flags(['era:voices-returned']);
  for (const era of ['past', 'future']) for (const x of [0, 1, 2]) {
    await place(`mossbrook-${era}:${x},0`); const r = await view();
    t.expect(r.questId === 'era-return' && /Mossbrook \/ today/.test(r.text) && !/Bring|Defeat|Clear|open.*chest/i.test(r.text),
      `Completed ${era} room ${x} sends the hero home without repeating either reward or turn-in`);
  }
  await t.shot('01-completed-archive-exit');
  await place('v1:1,1');
  t.expect((await view()).id === 'enter-d1', 'Returning to today restores the unfinished campaign goal');
  // Independent order: the choir can return before Mira sees the seed.
  await t.eval(() => window.__voxelHeroes.game.state.clearFlag('era:homecoming'));
  for (const era of ['past', 'future']) for (const x of [0, 1, 2])
    await expectRoute(`mossbrook-${era}:${x},0`, /Mossbrook \/ today/, `Choir-first completion preserves Mira's unfinished homecoming in ${era} ${x}`);
  await place('v1:1,1');
  await t.eval(() => { const h = window.__voxelHeroes; h.game.journal.openJournal('era-bell'); h.render(); h.game.ui.pressUi('journal-track'); h.render(); });
  t.expect((await view()).tracked === 'era-bell' && /Mira/.test((await view()).text), 'The journal Track button pins Mira homecoming to the HUD');
  await t.shot('02-track-homecoming');
  await t.eval(() => window.__voxelHeroes.game.journal.closeJournal());
  await place('mossbrook-future:2,0');
  t.expect((await view()).questId === 'era-bell', 'A chosen garden quest stays pinned when entering the completed archive');
  const saved = await t.save(); await t.load(saved);
  t.expect((await view()).tracked === 'era-bell', 'The personal quest pin survives save and reload');
  t.expect(!await pin('not-a-quest') && (await view()).tracked === 'era-bell', 'An invalid tracking request cannot replace the chosen task');
  t.expect(!await pin('era-archive') && (await view()).tracked === 'era-bell', 'Completed quests cannot be pinned');
  await flags(['era:homecoming']);
  t.expect((await view()).tracked === null && (await view()).questId === 'era-return', 'A shared completion immediately releases the completed pin');
  t.expect((await t.save()).fields.trackedQuest === null, 'Saving a completed pin records automatic guidance');
  // Errand inventory and its real NPC turn-in drive the pinned step.
  await place('v1:1,1');
  await t.eval(() => { const h = window.__voxelHeroes; h.state.errands.Hettie = { status: 'active', found: false }; h.state.forage.wildflower = 2; h.game.objective.trackQuest('errand:Hettie'); h.game.journal.openJournal(); h.render(); });
  let j = await t.eval(() => window.__voxelHeroes.game.journal.journalView());
  t.expect(j.selectedId === 'errand:Hettie' && /2 \/ 3 wildflowers/.test(j.objective), 'Opening the journal selects the pinned inventory-driven errand');
  await t.eval(() => { window.__voxelHeroes.state.forage.wildflower = 3; window.__voxelHeroes.render(); });
  j = await t.eval(() => window.__voxelHeroes.game.journal.journalView());
  t.expect(j.selectedId === 'errand:Hettie' && j.entries[j.selected].status === 'ready' && /Return to Hettie/.test(j.objective),
    'Becoming ready reorders the list while keeping the same selected quest and next step');
  await t.shot('03-flowers-ready');
  await t.eval(() => window.__voxelHeroes.game.journal.closeJournal());
  await t.eval(() => { const h = window.__voxelHeroes; h.entities.find(e => e.name === 'Hettie').onInteract(h.player); });
  await t.eval(async() => { const h = window.__voxelHeroes; for (let i = 0; i < 1200 && h.state.mode === 'dialog'; i++) { if (i % 15 === 0) h.input.tap('confirm'); await h.tick(); } });
  t.expect(await t.eval(() => { const h = window.__voxelHeroes; return h.state.errands.Hettie.status === 'done' && h.state.forage.wildflower === 0; }),
    'The real Hettie conversation consumes three flowers and completes the errand');
  t.expect((await view()).tracked === null && (await view()).id === 'enter-d1', 'Actual NPC turn-in releases the pin and restores campaign guidance');
  await t.shot('04-campaign-after-turn-in');
  await pin('errand:Rook');
  t.expect(/Talk to Rook/.test((await view()).text), 'Tracking an offer tells the player to accept it instead of pretending it was accepted');
  await t.eval(() => { const h = window.__voxelHeroes; h.state.errands.Rook = { status: 'active', found: false, quest: 'rook-dice' }; });
  t.expect(/hunter's bow/.test((await view()).text), 'Accepted Rook quest starts with the physical bow objective');
  await t.eval(() => window.__voxelHeroes.give('bow'));
  t.expect(/both far-bank targets/.test((await view()).text), 'Finding the bow advances tracking to its two-target puzzle');
  await flags(['rook:bridge']);
  t.expect(/dice.*vault/.test((await view()).text), 'Lowering the bridge advances tracking to the dice vault');
  await flags(['errand:rook:dice']);
  t.expect(/Return to Rook/.test((await view()).text), 'Recovering the dice advances tracking to the actual reward turn-in');
  await t.eval(() => { const h = window.__voxelHeroes; h.game.journal.openJournal(); h.render(); h.game.ui.pressUi('journal-auto'); h.render(); });
  t.expect((await view()).tracked === null && (await view()).id === 'enter-d1', 'Auto clears a chosen errand without changing its progress');
  await t.eval(() => window.__voxelHeroes.game.journal.closeJournal());
  const old = await t.save(); delete old.fields.trackedQuest;
  await pin('errand:Rowan'); await t.load(old);
  t.expect((await view()).tracked === null, 'Earlier saves without a quest pin load with automatic guidance');
  for (const invalid of [17, {}, 'not-a-quest']) {
    const bad = structuredClone(old); bad.fields.trackedQuest = invalid; await t.load(bad);
    t.expect((await view()).tracked === null, 'Unknown or malformed saved quest pins fall back to automatic guidance');
  }
  await pin('errand:Rowan');
  await t.eval(() => window.__voxelHeroes.game.progress.startNewGame({ prologue: false }));
  t.expect((await view()).tracked === null && (await view()).id === 'meet-king', 'A new game resets tracking and campaign progress');
}
