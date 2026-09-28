// Music (src/music/*, core/audio.js music bus, game/music.js): every
// registered track and stinger actually makes sound, the right one plays in
// the right place, switching tracks crossfades instead of cutting, and the
// mute key and the music volume setting are respected. See game/music.js's
// header comment for the public API this drives.
//
// A note on time: t.step() advances the GAME's simulated clock (area-enter,
// entity think()); it does not advance real wall-clock time, and the music
// engine schedules its notes and its crossfade ramps against the real
// AudioContext clock (core/audio.js, same as every sfx). So this file steps
// the sim to make things happen (spawn the boss, fire an event), then uses
// t.page.waitForTimeout (real ms) to give the audio graph time to actually
// ramp before it reads a gain.
export const description =
  "Music: overworld in Barrowfield, town in Mossbrook, dungeon in D1's rooms, boss in the Coil Pit once the serpent wakes, each actually audible; the crossfade between tracks; the victory and item-get stingers; mute (N) and the music volume setting; the cave and title tracks played directly (nothing wires them to an area yet).";

const near = (a, b, eps = 0.02) => Math.abs(a - b) <= eps;

// { id, gain, muted, out }: gain is the playing track's own channel (0..1,
// ramps over the crossfade); out is the master bus gain (0 when muted).
const musicState = (t) =>
  t.eval(() => {
    const g = window.__voxelHeroes.game;
    return { id: g.music.currentMusic(), gain: g.music.currentGain(), muted: g.audio.isMuted(), out: g.audio.outputGain() };
  });

export default async function musicScenario(t) {
  await t.eval(() => window.__voxelHeroes.start());
  await t.step(0.3);
  const fadeMs = 1000 * (await t.eval(() => window.__voxelHeroes.game.tuning.TUNING.load.musicFade));
  const settleMs = fadeMs + 250; // past the crossfade, comfortably

  // Confirms `id` is current and (after letting real time pass for its
  // crossfade-in) clearly audible, not just named.
  async function expectAudible(label, id, { simSeconds = 0.05, waitMs = settleMs } = {}) {
    if (simSeconds) await t.step(simSeconds);
    await t.page.waitForTimeout(waitMs);
    const s = await musicState(t);
    t.expect(s.id === id && s.gain > 0.8, `${label} (${s.id}, gain ${s.gain.toFixed(3)})`);
    return s;
  }

  // ---------------------------------------------------------------- overworld
  await t.teleport('ow-3-2:0,0', 8, 12);
  await expectAudible('Barrowfield plays overworld', 'overworld');

  // ---------------------------------------------------------------- town
  await t.teleport('v1:0,0', 8, 8);
  await expectAudible('Mossbrook plays village', 'village');

  // ---------------------------------------------------------------- dungeon (D1)
  await t.teleport('d1:3,9', 8, 6);
  await expectAudible("D1's Hollow Barrow plays dungeon-1, dungeons/d1.js's own id", 'dungeon-1');

  // ---------------------------------------------------------------- boss arena
  // Walking in plays d1's own dungeon-1 first (d1-boss sets no music of its
  // own); the boss-serpent marker spawns on room-enter and its first
  // think() (systems/flow.js's play tick, so this needs simulated time, not
  // just real time) fires 'boss-intro', switching the loop to 'boss'.
  await t.teleport('d1-boss:0,0', 11, 13.5);
  await expectAudible('the Coil Pit switches to boss once the serpent wakes', 'boss', { simSeconds: 0.5 });

  // 'boss-defeated' stops the fight loop; the reward room's own area-enter
  // (outside this file) would pick the next track back up.
  await t.eval(() => window.__voxelHeroes.game.events.emit('boss-defeated', { id: 'boss-serpent', dungeon: 'd1', refight: false }));
  await t.step(0.1);
  let s = await musicState(t);
  t.expect(s.id === null, `'boss-defeated' stops the boss loop (current: ${s.id})`);

  // ---------------------------------------------------------------- crossfade
  await t.teleport('ow-3-2:0,0', 8, 12);
  await expectAudible('back in Barrowfield, overworld returns', 'overworld');
  await t.eval(() => window.__voxelHeroes.game.music.playMusic('village'));
  const justAfter = await musicState(t); // read before any real time passes: still fading in
  t.expect(justAfter.id === 'village' && justAfter.gain < 0.5, `switching to village starts its fade-in low, not a hard cut (gain ${justAfter.gain.toFixed(3)})`);
  await t.page.waitForTimeout(settleMs);
  const settled = await musicState(t);
  t.expect(settled.id === 'village' && settled.gain > 0.8, `...and reaches full volume after the crossfade (gain ${settled.gain.toFixed(3)})`);

  // ---------------------------------------------------------------- stingers
  const stingerOk = await t.eval(() => {
    try {
      window.__voxelHeroes.game.music.playStinger('item', { duck: 0.3 });
      return true;
    } catch (e) {
      return String(e);
    }
  });
  t.expect(stingerOk === true, `playStinger('item') runs without throwing (${stingerOk})`);
  await t.page.waitForTimeout(150);
  s = await musicState(t);
  t.expect(s.id === 'village', 'a stinger plays over the loop without changing the current track id');

  const itemGetOk = await t.eval(() => {
    try {
      window.__voxelHeroes.game.events.emit('item-get', { id: 'test-item', amount: 1, name: 'Test Item', text: '', source: null, model: null });
      return true;
    } catch (e) {
      return String(e);
    }
  });
  t.expect(itemGetOk === true, "'item-get' fires the item jingle without throwing");

  // ---------------------------------------------------------------- mute and volume
  // Mute/volume set the gain node's .value directly (no ramp), so no real
  // wait is needed to see them take effect.
  await t.press('KeyN');
  let m = await musicState(t);
  t.expect(m.muted && m.out === 0, `N mutes the master bus (muted ${m.muted}, output gain ${m.out})`);
  t.expect(m.id === 'village' && m.gain > 0, '...without stopping the track itself: only the master bus is silent');
  await t.press('KeyN');
  m = await musicState(t);
  t.expect(!m.muted && m.out > 0, 'N again unmutes');

  await t.eval(() => window.__voxelHeroes.game.settings.setSetting('music', 0.35));
  const musicBusGain = await t.eval(() => window.__voxelHeroes.game.audio.musicOutput().gain.value);
  t.expect(near(musicBusGain, 0.35), `the music setting sets the music bus level (${musicBusGain})`);
  await t.eval(() => window.__voxelHeroes.game.settings.setSetting('music', 1));

  // ---------------------------------------------------------------- cave and title (not wired to an area yet)
  await t.eval(() => window.__voxelHeroes.game.music.playMusic('cave'));
  await t.page.waitForTimeout(settleMs);
  s = await musicState(t);
  t.expect(
    s.id === 'cave' && s.gain > 0.8,
    `the cave track plays on its own (${s.id}, gain ${s.gain.toFixed(3)}); world/areas/slice.js's cave-barrow area names no music yet`
  );

  await t.eval(() => window.__voxelHeroes.game.music.playMusic('title'));
  await t.page.waitForTimeout(settleMs);
  s = await musicState(t);
  t.expect(s.id === 'title' && s.gain > 0.8, `the title track plays on its own (${s.id}, gain ${s.gain.toFixed(3)}); ui/screens/title.js calls no playMusic yet`);
}
