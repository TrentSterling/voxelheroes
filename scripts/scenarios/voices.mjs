export const description = 'Recorded NPC voices: real conversations, clip cancellation, subtitle pagination, mute/volume, missing media, stale callbacks and ambient priority using a deterministic media fixture. Actual Opus decoding/playback checked separately.';

export default async function(t) {
  await t.press('Enter'); await t.step(1);
  await t.teleport('v1:1,1', 10.5, 10.4); await t.step(.3);
  await t.eval(() => {
    const h = window.__voxelHeroes; h.game.npcVoices.stopNpcSpeech(); h.game.settings.setSetting('npcVoices', true);
    window.__voiceFixture = { native: window.Audio, records: [], pauses: 0, loads: 0 };
    const f = window.__voiceFixture;
    window.Audio = class extends EventTarget {
      constructor() { super(); this.paused = true; this.currentTime = 0; f.records.push(this); }
      play() { this.paused = false; this.dispatchEvent(new Event('playing')); return Promise.resolve(); }
      pause() { this.paused = true; f.pauses++; }
      removeAttribute(name) { if (name === 'src') this.src = ''; }
      load() { f.loads++; }
    };
  });
  const view = () => t.eval(() => window.__voxelHeroes.game.npcVoices.npcVoiceView());
  const count = () => t.eval(() => window.__voiceFixture.records.length);
  const close = () => t.eval(() => window.__voxelHeroes.setMode('play'));
  const dialog = (text, speaker = 'Hettie', opts = {}) => t.eval(({ text, speaker, opts }) => { window.__voxelHeroes.game.dialog.showDialog(text, { speaker, ...opts }); }, { text, speaker, opts });
  try {
    await t.eval(() => { const h = window.__voxelHeroes; h.entities.find(e => e.name === 'Old Tobin').onInteract(h.player); });
    t.expect(await count() === 1, 'an actual town quest starts exactly one recording');
    t.expect((await view()).last.voice === 'bm_george' && (await view()).last.phase === 'speaking', 'Tobin uses his baked Kokoro cast voice');
    t.expect((await view()).last.volume > 0 && (await view()).last.volume < 1, 'voice uses master and effects levels');
    t.expect((await view()).modelDownloads === 0, 'recorded speech requires no model');
    await t.tap('confirm');
    t.expect(await count() === 1, 'finishing the typewriter does not replay a recording');
    await t.tap('confirm');
    t.expect(await count() === 2, 'next authored quest page starts the next recording');
    t.expect(await t.eval(() => window.__voiceFixture.pauses) === 1, 'next page stops the previous recording');
    await t.shot('01-tobin-recorded-quest');
    await close(); t.expect((await view()).current === null, 'closing the dialog stops its recording');
    await dialog('Welcome to Mossbrook!');
    t.expect((await view()).last.voice === 'bf_emma', 'Hettie has her own consistent cast voice');
    const token = (await view()).last.id;
    await t.eval(() => window.__voiceFixture.records[0].dispatchEvent(new Event('ended')));
    t.expect((await view()).last.id === token && (await view()).last.phase === 'speaking', 'late callbacks from cancelled clips cannot stop the current speaker');
    await t.eval(() => window.__voxelHeroes.game.audio.setVolumes({ master: .4, sfx: .5 }));
    t.expect(Math.abs((await view()).last.volume - .17) < .001 && await t.eval(() => Math.abs(window.__voiceFixture.records.at(-1).volume - .17) < .001), 'changing audio levels updates the playing media element');
    await t.eval(() => window.__voxelHeroes.game.audio.setMuted(true));
    t.expect((await view()).current === null, 'mute stops a recording immediately');
    let before = await count(); await close(); await dialog('Welcome to Mossbrook!');
    t.expect(await count() === before, 'muted conversations create no media or downloads');
    await close(); await t.eval(() => window.__voxelHeroes.game.audio.setMuted(false));
    await t.eval(() => window.__voxelHeroes.game.settings.setSetting('npcVoices', false));
    await dialog('Welcome to Mossbrook!');
    t.expect(await count() === before && await t.eval(() => window.__voxelHeroes.game.dialog.dialogOpen()), 'voices off leaves working silent subtitles');
    await close();
    t.expect(await t.eval(() => { const h = window.__voxelHeroes; h.game.settings.loadSettings(); return h.state.settings.npcVoices; }) === false, 'voice preference survives settings reload');
    await t.eval(() => window.__voxelHeroes.game.settings.setSetting('npcVoices', true));
    await dialog('A written sign has no voice.', 'Signpost');
    t.expect(await count() === before, 'signs do not borrow a character voice');
    await close(); await dialog('An unrecorded future quest.');
    t.expect(await count() === before && (await view()).last.phase === 'unrecorded', 'missing content leaves text available without switching to synthetic speech');
    await close();
    await t.eval(() => { window.__voxelHeroes.state.profile.name = 'I'; });
    await dialog('I saved you a smile, {hero}. Also a biscuit, but I ate that.', 'Pip');
    t.expect((await view()).last.phase === 'speaking' && await t.eval(() => window.__voxelHeroes.game.dialog.dialogView().text.includes('smile, I.')), 'personalized subtitles use the same recording even when the hero name is a common word');
    await close();
    await t.page.setViewportSize({ width: 568, height: 320 });
    await t.page.waitForTimeout(200);
    await t.eval(() => window.__voxelHeroes.render());
    await t.eval(() => { window.__voxelHeroes.state.settings.largeText = true; }); await t.step(.1);
    const long = "Blast the stump, then bring it back. The cellar's bronze seal rings for clay, never steel; I left spare pots by the stairs.";
    before = await count(); await dialog(long, 'Old Tobin', { choices: ["I'll help", 'Not now'] }); await t.tap('confirm');
    const shown = await t.eval(() => window.__voxelHeroes.game.dialog.dialogView());
    t.expect(shown.shown.length < long.length, 'large subtitles split the real quest line into landscape screenfuls');
    await t.tap('confirm');
    t.expect(await count() === before + 1 && (await view()).current !== null, 'continuing a subtitle screenful preserves the same recording');
    await t.shot('02-landscape-voiced-subtitles');
    await close();
    await dialog('Welcome to Mossbrook!');
    await t.eval(() => { const a = window.__voiceFixture.records.at(-1); a.error = { code: 4 }; a.dispatchEvent(new Event('error')); });
    t.expect((await view()).last.phase === 'unavailable' && await t.eval(() => window.__voxelHeroes.game.dialog.dialogOpen()), 'failed media decode never blocks reading');
    await close();
    await t.page.waitForTimeout(5600); // Let any approach greeting's real-time cooldown expire.
    await t.eval(() => window.__voxelHeroes.game.npcVoices.speakNpcBark('Lovely day for it!', 'Pip'));
    t.expect((await view()).current?.ambient === true, 'a nearby reaction can use its baked recording');
    before = await count();
    await t.eval(() => window.__voxelHeroes.game.npcVoices.speakNpcBark('Mind the flowers.', 'Old Tobin'));
    t.expect(await count() === before, 'ambient voices do not overlap');
    await dialog('Welcome to Mossbrook!');
    t.expect((await view()).current?.speaker === 'Hettie' && !(await view()).current.ambient, 'focused conversation takes priority over ambient speech');
    before = await count();
    await t.eval(() => window.__voxelHeroes.game.npcVoices.speakNpcBark('Lovely day for it!', 'Pip'));
    t.expect(await count() === before, 'barks cannot interrupt a conversation');
    await close();
    await t.eval(() => { window.Audio = undefined; }); await dialog('Welcome to Mossbrook!');
    t.expect((await view()).supported === false && await t.eval(() => window.__voxelHeroes.game.dialog.dialogOpen()), 'missing media APIs leave usable text');
    await close();
  } finally {
    await t.eval(() => { const h = window.__voxelHeroes; h.setMode('play'); window.Audio = window.__voiceFixture.native; h.state.settings.largeText = false; h.game.audio.setMuted(false); h.game.audio.setVolumes({ master: 1, sfx: 1 }); h.game.settings.setSetting('npcVoices', true); });
    await t.page.setViewportSize({ width: 1280, height: 720 });
  }
}
