// The M1 smoke play-through. Every step is played with the keyboard or the
// bot helpers (no teleports until the extras at the end), so it exercises
// scrolling, warps, combat, pickups, the key, the locked door and the chest.
export const description =
  'Title, Crossroads, a fight in Rattlestone Hollow, Cairn Ridge, the crypt (key, locked door, chest) and out by the stairs; then pause, dialog, save/load and game over.';

const near = (a, b, eps = 0.1) => Math.abs(a - b) <= eps;

export default async function defaultScenario(t) {
  await t.track('screen-enter', 'enemy-killed', 'room-cleared', 'pickup', 'door-opened', 'chest-opened', 'warp', 'player-hurt');
  let s;

  // ---------------------------------------------------------------- title
  await t.step(0.5);
  s = await t.state();
  t.expect(s.mode === 'title' && s.overlay, 'the game opens on the title panel');
  t.expect(s.screenName === 'Crossroads', 'the hero idles on the Crossroads behind it');
  await t.shot('01-title');

  await t.press('Enter');
  await t.step(1.1); // past the hero's one-second start blink, so the shot shows him
  s = await t.state();
  t.expect(s.mode === 'play' && !s.overlay, 'Enter starts the game');
  t.expect(s.hp === 6 && s.maxHp === 6 && s.gems === 0 && s.keys === 0, 'a new game has 3 hearts, no gems and no keys');
  t.expect(near(s.lx, 8, 0.01) && near(s.lz, 5.5, 0.01), 'the hero starts in the middle of the Crossroads');
  await t.shot('02-crossroads');

  // ---------------------------------------------------------------- Rattlestone Hollow
  await t.hold('ArrowRight', 2.2);
  await t.waitFor((st) => st.mode === 'play' && st.screenName === 'Rattlestone Hollow', { seconds: 2 });
  await t.step(0.8);
  s = await t.state();
  t.expect(s.screenName === 'Rattlestone Hollow', 'holding right walks east and slides into Rattlestone Hollow');
  t.expect(s.enemies === 4, 'Rattlestone Hollow has 4 enemies');
  await t.shot('03-rattlestone-hollow');

  let f = await t.fight({ maxKills: 1 });
  t.expect(f.kills === 1, `the sword brings down the first enemy (${f.swings} swings)`);
  await t.shot('04-fight');
  const first = f;
  f = await t.fight();
  s = await t.state();
  t.expect(s.enemies === 0, `Rattlestone Hollow cleared: ${first.kills + f.kills} kills, ${first.swings + f.swings} swings, ${first.heals + f.heals} top-ups`);
  const cleared = await t.events('room-cleared');
  t.expect(cleared.length === 1 && cleared[0].screen === 'Rattlestone Hollow', "the last kill fires 'room-cleared'");
  await t.step(0.6);
  await t.shot('05-hollow-cleared');

  // ---------------------------------------------------------------- Cairn Ridge
  await t.exit('west');
  s = await t.state();
  t.expect(s.screenName === 'Crossroads', 'back west to the Crossroads');
  await t.exit('north');
  await t.step(0.8);
  s = await t.state();
  t.expect(s.screenName === 'Cairn Ridge', 'north of the Crossroads is Cairn Ridge');
  await t.shot('06-cairn-ridge');
  f = await t.fight();
  t.note(`Cairn Ridge: ${f.kills} kills`);
  await t.walkTo(8.5, 1.5);
  await t.hold('ArrowUp', 0.3);
  await t.waitFor((st) => st.mode === 'play' && st.area === 'crypt', { seconds: 3 });
  s = await t.state();
  t.expect(
    s.screenName === 'Sunken Gate' && near(s.lx, 8) && near(s.lz, 8.4),
    'the doorway in the cliffs leads down into the Sunken Gate'
  );
  const warps = await t.events('warp');
  t.expect(warps.length === 1, "entering the doorway fires one 'warp'");

  // ---------------------------------------------------------------- the crypt
  await t.step(0.6);
  await t.shot('07-sunken-gate');
  await t.fight();
  await t.exit('north');
  s = await t.state();
  t.expect(s.screenName === 'Key Vault', 'north of the Sunken Gate is the Key Vault');
  await t.step(0.6);
  await t.fight();
  await t.walkTo(7.5, 5.5);
  await t.waitFor((st) => st.keys === 1, { seconds: 1 });
  s = await t.state();
  t.expect(s.keys === 1 && s.keysByGroup.crypt === 1, 'the small key is picked up (1 crypt key)');
  t.expect(s.flags.includes('taken:7,115'), 'the key is remembered as taken');
  await t.step(0.3);
  await t.shot('08-key');

  await t.exit('south');
  await t.exit('east');
  s = await t.state();
  t.expect(s.screenName === 'Pillar Hall', 'east of the Sunken Gate is the Pillar Hall');
  await t.step(0.6);
  await t.fight();
  await t.walkTo(8, 1.5);
  await t.hold('ArrowUp', 0.1); // a short push: the door opens on the first frame
  s = await t.state();
  t.expect(s.keys === 0, 'walking into the locked door uses the key');
  t.expect(s.flags.includes('door:23,121') && s.flags.includes('door:24,121'), 'both halves of the door are open');
  t.expect((await t.events('door-opened')).length === 1, "the door fires 'door-opened'");
  await t.step(0.4);
  await t.shot('09-door-open');

  await t.exit('north');
  s = await t.state();
  t.expect(s.screenName === 'Treasure Chamber', 'through the door is the Treasure Chamber');
  await t.step(0.6);
  await t.fight();
  await t.walkTo(7.5, 6.5);
  await t.hold('ArrowUp', 0.3);
  s = await t.state();
  t.expect(s.flags.includes('chest:23,115'), 'walking into the chest opens it');
  t.expect(s.maxHp === 8 && s.hp === 8, 'the chest holds a heart container: 4 hearts, all full');
  const chests = await t.events('chest-opened');
  t.expect(chests.length === 1 && chests[0].contents === 'heart-container', "'chest-opened' reports the contents");
  await t.step(0.8);
  await t.shot('10-chest');

  await t.exit('south');
  await t.exit('west');
  s = await t.state();
  t.expect(s.screenName === 'Sunken Gate', 'back through the Pillar Hall to the Sunken Gate');
  await t.walkTo(7.5, 8.5);
  await t.hold('ArrowDown', 0.3);
  await t.waitFor((st) => st.mode === 'play' && st.area === 'overworld', { seconds: 3 });
  s = await t.state();
  t.expect(s.screenName === 'Cairn Ridge' && near(s.lx, 8) && near(s.lz, 1.7), 'the stairs lead back up to the doorway on Cairn Ridge');
  t.expect(s.keys === 0 && s.maxHp === 8, 'the heart container stays after leaving the crypt');
  await t.step(0.8);
  await t.shot('11-back-outside');

  // ---------------------------------------------------------------- pause
  await t.press('Escape');
  s = await t.state();
  t.expect(s.mode === 'paused' && s.overlay, 'Escape pauses');
  await t.step(1);
  const s2 = await t.state();
  t.expect(
    JSON.stringify(s2.entities) === JSON.stringify(s.entities) && s2.x === s.x && s2.z === s.z,
    'nothing moves while paused'
  );
  await t.shot('12-paused');
  await t.press('Escape');
  t.expect((await t.state()).mode === 'play', 'Escape resumes');

  // ---------------------------------------------------------------- dialog
  await t.eval(() => {
    window.__dialogResult = undefined;
    window.__voxelHeroes
      .showDialog(['These stones were stacked by people who never came back for them.', 'Did you find what the crypt was keeping?'], {
        speaker: 'Old cairn',
        choices: ['I did', 'Not yet'],
      })
      .then((choice) => (window.__dialogResult = choice));
  });
  await t.step(0.1);
  s = await t.state();
  t.expect(s.mode === 'dialog' && s.dialog, 'showDialog opens the dialog box and stops play');
  await t.step(2);
  await t.press('Space');
  await t.step(1.5);
  await t.press('ArrowDown');
  await t.shot('13-dialog');
  await t.press('Space');
  await t.step(0.1);
  t.expect((await t.eval(() => window.__dialogResult)) === 1, 'picking the second answer resolves showDialog with 1');
  t.expect((await t.state()).mode === 'play', 'play resumes after the dialog');

  // ---------------------------------------------------------------- save / load
  const saved = await t.state();
  const save = JSON.parse(JSON.stringify(await t.save()));
  t.expect(save.version >= 1 && save.fields, 'the save data is plain JSON with a version');
  await t.teleport('Whisperwood', 8, 5.5);
  await t.setHp(1);
  await t.load(save);
  await t.step(0.1);
  s = await t.state();
  t.expect(
    s.screenName === 'Cairn Ridge' && near(s.lx, saved.lx) && near(s.lz, saved.lz) && s.hp === saved.hp && s.maxHp === 8,
    'loading puts the hero back where the save was made, with the same health and 4 heart containers'
  );
  t.expect(['taken:7,115', 'door:23,121', 'chest:23,115'].every((k) => s.flags.includes(k)), 'loading keeps the key, door and chest flags');
  t.expect((await t.eval(() => window.__voxelHeroes.world.tile(23, 121))) === '.', 'the opened door is still open after loading');
  t.expect(await t.eval(() => window.__voxelHeroes.saveToSlot(2)), 'the game saves into localStorage slot 2');
  await t.teleport('Mirror Lake');
  t.expect(await t.eval(() => window.__voxelHeroes.loadFromSlot(2)), 'slot 2 loads back');
  await t.step(0.1);
  s = await t.state();
  t.expect(s.screenName === 'Cairn Ridge' && near(s.lx, saved.lx) && near(s.lz, saved.lz), 'loading slot 2 returns to the same spot on Cairn Ridge');

  // ---------------------------------------------------------------- game over
  await t.setHp(0);
  await t.step(1.5);
  s = await t.state();
  t.expect(s.mode === 'dead' && s.overlay, 'at zero health the hero falls and the game-over panel appears');
  await t.shot('14-game-over');
  await t.press('Enter');
  await t.step(1.1);
  s = await t.state();
  t.expect(s.mode === 'play' && s.screenName === 'Crossroads' && s.hp === s.maxHp, 'Try again: back on the Crossroads with full health');
  await t.shot('15-try-again');

  const hurt = await t.events('player-hurt');
  const kills = await t.events('enemy-killed');
  t.note(`${kills.length} enemies defeated, hero hit ${hurt.length} times, ${(await t.events('screen-enter')).length} screens entered`);
}
