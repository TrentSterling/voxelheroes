// The M1 smoke play-through. The game starts in Mossbrook Square of the
// overworld slice (M2); one teleport takes the hero to the M1 Crossroads, and
// from there every step is played with the keyboard or the bot helpers (no
// teleports until the extras at the end), so it exercises scrolling, warps,
// combat, pickups, the key, the locked door and the chest.
import { clearFoes } from '../lib/helpers.mjs';

export const description =
  'Title and the Mossbrook start, Crossroads, a fight in Rattlestone Hollow, Cairn Ridge, the crypt (key, locked door, chest) and out by the stairs; then pause, dialog, save/load (tiles saved by place), game over, and loading an M1 save made after the crypt.';

const near = (a, b, eps = 0.1) => Math.abs(a - b) <= eps;

// Global tile key 'tx,tz' of local tile (x, z) in a screen ('crypt:0,0'), as
// flags and tile edits name tiles in play (save data names them by place,
// 'crypt:0,0:7,5').
const tileOf = (t, key, x, z) =>
  t.eval(([k, x, z]) => {
    const s = window.__voxelHeroes.world.screen(k);
    return `${s.x0 + x},${s.z0 + z}`;
  }, [key, x, z]);

export default async function defaultScenario(t) {
  await t.track('screen-enter', 'room-enter', 'area-enter', 'enemy-killed', 'room-cleared', 'pickup', 'door-opened', 'chest-opened', 'warp', 'player-hurt', 'life-changed');
  let s;
  const keyTile = await tileOf(t, 'crypt:0,0', 7, 5); // the small key in the Key Vault
  const doorTiles = [await tileOf(t, 'crypt:1,1', 7, 0), await tileOf(t, 'crypt:1,1', 8, 0)]; // the Pillar Hall's locked door
  const chestTile = await tileOf(t, 'crypt:1,0', 7, 5); // the chest in the Treasure Chamber

  // ---------------------------------------------------------------- title
  await t.step(0.5);
  s = await t.state();
  t.expect(s.mode === 'title' && s.overlay, 'the game opens on the title panel');
  t.expect(s.screenName === 'Mossbrook Square', 'the hero idles in Mossbrook Square behind it');
  await t.shot('01-title');

  await t.press('Enter');
  await t.step(1.1); // past the hero's one-second start blink, so the shot shows him
  s = await t.state();
  t.expect(s.mode === 'play' && !s.overlay, 'Enter starts the game');
  t.expect(s.hp === 6 && s.maxHp === 6 && s.gems === 0 && s.keys === 0, 'a new game has 3 hearts, no gems and no keys');
  t.expect(s.screenName === 'Mossbrook Square' && near(s.lx, 8, 0.01) && near(s.lz, 14, 0.01), 'the hero starts in Mossbrook Square, facing the pond and the stalls');
  // The title now starts every new game through the prologue (fun audit CLARITY
  // 2/10, item 1): unarmed until the king's grants at Crownhold. This M1
  // smoke test is about the old Crossroads-and-crypt map, not that ceremony
  // (d1.mjs and goals.mjs cover talking to the king for real), so it arms the
  // hero directly here (owned + equipped, no grant event) and goes straight
  // to the fight.
  const armed = await t.eval(() => {
    const h = window.__voxelHeroes;
    h.state.swords.owned.push('blade-start');
    h.state.swords.equipped = 'blade-start';
    h.state.gear.shield = 1;
    return { equipped: h.state.swords.equipped, shield: h.state.gear.shield };
  });
  t.expect(armed.equipped === 'blade-start' && armed.shield === 1, `armed for the M1 combat below (${JSON.stringify(armed)})`);
  await t.teleport('Crossroads', 8, 5.5);
  await t.step(0.2);
  s = await t.state();
  t.expect(s.screenName === 'Crossroads', 'the M1 play-through goes on from the Crossroads');
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
    s.screenName === 'Sunken Gate' && near(s.lx, 8) && near(s.lz, 10.4),
    'the doorway in the cliffs leads down into the Sunken Gate, just inside its south doorway'
  );
  t.expect(s.size[0] === 16 && s.size[1] === 12 && s.cam.preset === 'dungeon' && near(s.cam.x, 8, 0.01) && near(s.cam.z, 6, 0.01), 'the crypt is 16 x 12 rooms, seen from the dungeon camera on the room centre');
  const warps = await t.events('warp');
  t.expect(warps.length === 1, "entering the doorway fires one 'warp'");
  let areas = await t.events('area-enter');
  t.expect(areas.length === 1 && areas[0].area === 'Cairn Crypt' && areas[0].from === 'Overworld' && areas[0].via === 'warp', "the warp into the crypt fires 'area-enter' (Overworld to Cairn Crypt)");

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
  t.expect(s.flags.includes(`taken:${keyTile}`), `the key is remembered as taken (taken:${keyTile})`);
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
  t.expect(doorTiles.every((d) => s.flags.includes(`door:${d}`)), `both halves of the door are open (door:${doorTiles.join(', door:')})`);
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
  t.expect(s.flags.includes(`chest:${chestTile}`), `walking into the chest opens it (chest:${chestTile})`);
  const container = (await t.events('life-changed')).find(e => e.reason === 'heart-container');
  t.expect(s.maxHp === 8 && container?.hp === 8 && container.full, 'the chest holds a heart container: 4 hearts, refilled when claimed');
  const chests = await t.events('chest-opened');
  t.expect(chests.length === 1 && chests[0].contents === 'heart-container', "'chest-opened' reports the contents");
  await t.step(0.8);
  await t.shot('10-chest');

  await t.exit('south');
  await t.exit('west');
  s = await t.state();
  t.expect(s.screenName === 'Sunken Gate', 'back through the Pillar Hall to the Sunken Gate');
  await t.walkTo(7.5, 10.5);
  await t.hold('ArrowDown', 0.3);
  await t.waitFor((st) => st.mode === 'play' && st.area === 'overworld', { seconds: 3 });
  s = await t.state();
  t.expect(s.screenName === 'Cairn Ridge' && near(s.lx, 8) && near(s.lz, 1.7), 'the stairs in the south doorway lead back up to the doorway on Cairn Ridge');
  areas = await t.events('area-enter');
  t.expect(areas.length === 2 && areas[1].area === 'Overworld' && areas[1].from === 'Cairn Crypt', "climbing out fires 'area-enter' again (Cairn Crypt to Overworld)");
  const rooms = await t.events('room-enter');
  const cryptRooms = rooms.filter((r) => r.area === 'Cairn Crypt').map((r) => r.screen);
  t.expect(
    cryptRooms.join(' > ') === 'Sunken Gate > Key Vault > Sunken Gate > Pillar Hall > Treasure Chamber > Pillar Hall > Sunken Gate',
    `'room-enter' follows the route through the crypt: ${cryptRooms.join(' > ')}`
  );
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
  const byPlace = ['taken:crypt:0,0:7,5', 'door:crypt:1,1:7,0', 'door:crypt:1,1:8,0', 'chest:crypt:1,0:7,5'];
  t.expect(
    byPlace.every((k) => save.fields.flags.includes(k)) && save.fields.tileEdits['crypt:1,1:7,0'] === '.',
    `  it names the key, door and chest tiles by place, so it survives moving an area (${byPlace.join(', ')})`
  );
  await t.teleport('Whisperwood', 8, 5.5);
  await t.setHp(1);
  await t.load(save);
  await t.step(0.1);
  s = await t.state();
  t.expect(
    s.screenName === 'Cairn Ridge' && near(s.lx, saved.lx) && near(s.lz, saved.lz) && s.hp === saved.hp && s.maxHp === 8,
    'loading puts the hero back where the save was made, with the same health and 4 heart containers'
  );
  t.expect([`taken:${keyTile}`, `door:${doorTiles[0]}`, `chest:${chestTile}`].every((k) => s.flags.includes(k)), 'loading keeps the key, door and chest flags');
  t.expect((await t.eval((d) => window.__voxelHeroes.world.tile(...d.split(',').map(Number)), doorTiles[0])) === '.', 'the opened door is still open after loading');
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
  // Respawn near the fall (systems/flow.js continuePoint, a deliberate change: dying used to send
  // the hero all the way back to the start): the overworld names no entrance of its own, so he gets
  // up wherever he last walked into it this session, Cairn Ridge, the crypt's own door onto it.
  t.expect(s.mode === 'play' && s.screenName === 'Cairn Ridge' && s.hp === s.maxHp, 'Try again: back near the fall, on Cairn Ridge, with full health');
  await t.shot('15-try-again');

  // ---------------------------------------------------------------- an M1 save
  // M1 kept the crypt at screen [0, 10] of one 16 x 11 lattice and named its
  // tiles by global tile: a save made after the crypt, in the Treasure Chamber.
  const m1 = {
    version: 1,
    fields: {
      hp: 8,
      maxHp: 8,
      gems: 0,
      flags: ['taken:7,115', 'door:23,121', 'door:24,121', 'chest:23,115'],
      tileEdits: { '23,121': '.', '24,121': '.' },
      pos: { sx: 1, sy: 10, x: 8, z: 7, yaw: 0 },
    },
  };
  await t.load(m1);
  await t.step(0.1);
  s = await t.state();
  t.expect(s.screenName === 'Treasure Chamber' && near(s.lx, 8) && near(s.lz, 7), `an M1 save made in the crypt resumes in the same room (${s.screenName}, ${s.lx}, ${s.lz})`);
  t.expect(
    [`taken:${keyTile}`, ...doorTiles.map((d) => `door:${d}`), `chest:${chestTile}`].every((k) => s.flags.includes(k)),
    "  its key, door and chest flags land on today's crypt tiles"
  );
  t.expect((await t.eval((d) => window.__voxelHeroes.world.tile(...d.split(',').map(Number)), doorTiles[0])) === '.', '  the Pillar Hall door stays open');
  const opened = (await t.events('chest-opened')).length;
  await clearFoes(t);
  await t.walkTo(7.5, 6.5);
  await t.hold('ArrowUp', 0.3);
  s = await t.state();
  t.expect(s.maxHp === 8 && (await t.events('chest-opened')).length === opened, '  and the chest stays open: no second heart container');

  const hurt = await t.events('player-hurt');
  const kills = await t.events('enemy-killed');
  t.note(`${kills.length} enemies defeated, hero hit ${hurt.length} times, ${(await t.events('room-enter')).length} screens entered`);
}
