// D1 and the overworld slice (M2 stream 3; gameplay spec 5, 6.1-6.9, the
// compact scope of docs/PLAN.md). A new game with the prologue starts in the
// castle courtyard, where the king arms the hero; the bot walks the road
// (Castle Road, Mossbrook, Barrowfield) to the barrow door, then plays D1:
// the kill-all key room and its lock-in shutters, the map chest, the
// push-block puzzle, the small-key doors, the boomerang after a lock-in
// fight, a boomerang wall switch, the dark room, the blade traps, the second
// kill-all key, the four eyes that open the boss-key room, the antechamber's
// portal switch and the boss door, the boss (its hits through the damage
// API: the bot does not dodge a serpent), the reward room's orb and the
// stairs out. Test-hook shortcuts: enemies the bot cannot reach are struck
// down through the hook, three of the four eyes are lit through their tile
// hook, and the side rooms (red vault) are reached by teleport at the end.
// Every room of D1 must have been entered by then. Screenshots: the village,
// the barrow outside, a D1 room, the boss fight.
import { clearFoes } from '../lib/helpers.mjs';

export const description = 'D1 and the overworld slice: castle start and the king, the road through Mossbrook to the barrow, every D1 room, keys, doors, switches, boomerang, boss, orb.';

const near = (a, b, eps = 0.1) => Math.abs(a - b) <= eps;

const install = (t) =>
  t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const H = (window.__d1 = {});
    H.of = (type) => h.entities.filter((e) => !e.removed && e.type === type);
    // strike down every enemy of the room that counts for its clear
    H.killAll = () => {
      for (const e of h.entities.filter((e) => !e.removed && e.kind === 'enemy' && e.countsForClear !== false)) e.die();
    };
    H.foes = () => h.entities.filter((e) => !e.removed && e.kind === 'enemy' && e.countsForClear !== false).length;
    H.tile = (x, z) => {
      const s = h.screen();
      return h.world.tile(s.x0 + x, s.z0 + z);
    };
    H.solid = (x, z) => {
      const s = h.screen();
      return h.world.isSolid(s.x0 + x, s.z0 + z, h.player);
    };
    H.keys = () => g.keys.keyCount('d1');
    H.flags = () => [...h.state.flags];
    H.safe = () => {
      h.player.invT = 999;
      h.setHp(h.state.maxHp);
    };
  });

const snap = (t) => t.state();

// Walk to the edge `dir`, clear the foes of the next screen, and check its name.
async function go(t, dir, name, { keepFoes = false } = {}) {
  await t.exit(dir);
  await t.waitFor((s) => s.mode === 'play', { seconds: 4 });
  if (!keepFoes) await clearFoes(t);
  await t.eval(() => window.__d1.safe());
  const s = await snap(t);
  t.expect(s.screenName === name, `${dir} to ${name} (${s.screenName})`);
  return s;
}

// Push against a solid tile at local (x, z) from the tile beside it for `seconds`.
// Doors in a room's walls are pushed from the middle of their gap.
async function pushInto(t, x, z, dir, seconds = 0.6) {
  const [dx, dz] = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[dir];
  let at = [x + 0.5 - dx, z + 0.5 - dz];
  if (dir === 'north' && z === 0) at = [8, 1.5];
  if (dir === 'west' && x === 0) at = [2, 6];
  if (dir === 'east' && x === 15) at = [13.5, 6];
  await t.walkTo(...at);
  await t.stick(dx, dz, seconds);
}

async function throwBoomerang(t, x, z, facing) {
  await t.walkTo(x, z);
  await t.eval((f) => {
    const g = window.__voxelHeroes.game;
    g.inventory.selectItem('boomerang');
    g.hero.hero.setFacing(f);
  }, facing);
  await t.tap('item');
  await t.step(1.4);
}

export default async function d1(t) {
  await t.track('area-enter', 'dungeon-enter', 'door-opened', 'chest-opened', 'shutters-closed', 'shutters-opened', 'switch-pressed', 'room-cleared', 'block-pushed', 'boss-intro', 'boss-defeated', 'dungeon-complete', 'keys-changed');
  await install(t);
  let s;

  // ---------------------------------------------------------------- a new game in the castle
  await t.step(0.3);
  s = await snap(t);
  t.expect(s.mode === 'title' && s.area === 'ow-4-3' && s.screenName === 'Crownhold Courtyard', 'the title stands over the castle courtyard, where the game starts');
  let r = await t.eval(() => {
    const g = window.__voxelHeroes.game;
    g.progress.startNewGame({ name: 'Bo', class: 'balanced', prologue: true });
    const st = window.__voxelHeroes.state;
    return { equipped: st.swords.equipped, shield: st.gear.shield };
  });
  await t.step(0.5);
  s = await snap(t);
  t.expect(s.mode === 'play' && s.screenName === 'Crownhold Courtyard' && near(s.lx, 8) && near(s.lz, 9) && r.equipped === null, 'a new game (prologue) starts unarmed in the courtyard, before the king');
  await t.walkTo(7.5, 6.7);
  await t.eval(() => window.__voxelHeroes.game.hero.hero.setFacing('north'));
  await t.tap('sword');
  for (let i = 0; i < 12 && (await snap(t)).mode === 'dialog'; i++) {
    await t.step(1.2);
    await t.tap('confirm');
  }
  await t.step(0.5);
  r = await t.eval(() => ({ equipped: window.__voxelHeroes.state.swords.equipped, shield: window.__voxelHeroes.state.gear.shield, mode: window.__voxelHeroes.state.mode }));
  t.expect(r.equipped === 'blade-start' && r.shield >= 1 && r.mode === 'play', `the king arms the hero: blade and shield (${r.equipped}, shield ${r.shield})`);

  // ---------------------------------------------------------------- the road to the barrow
  await t.eval(() => window.__d1.safe());
  await go(t, 'north', 'Castle Road');
  await go(t, 'north', 'Mossbrook Lane');
  s = await snap(t);
  t.expect(s.area === 'v1', 'north of the castle road lies Mossbrook (a load into the village)');
  await go(t, 'north', 'Mossbrook Square');
  r = await t.eval(() => ['npc-shop', 'npc-smith', 'npc-inn'].map((k) => window.__d1.of(k).length));
  t.expect(r.every((n) => n === 1), 'the square has the shopkeeper, the smith and the innkeeper');
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const g = h.game;
    g.vitals.addCoins(30);
    const buy = g.shops.buy('v1-shop', 'bombs');
    return { ok: buy.ok, has: g.inventory.hasItem('bombs'), ammo: g.inventory.ammo('bombs'), boots: h.state.gear.boots };
  });
  t.expect(r.ok && r.has && r.ammo > 0, `Mossbrook's shop sells bombs (${JSON.stringify(r)})`);
  t.expect(r.boots === 'boots-dash', 'the hero has dash boots from the start');
  await t.walkTo(8, 12.5);
  await t.eval(() => window.__voxelHeroes.game.inventory.selectItem('bombs'));
  await t.tap('item');
  r = await t.eval(() => window.__d1.of('bomb').length);
  t.expect(r === 1, 'B places a bomb');
  await t.step(0.5);
  await t.eval(() => window.__voxelHeroes.game.hero.hero.setFacing('north'));
  await t.tap('dash');
  await t.step(0.05);
  r = await t.eval(() => !!window.__voxelHeroes.player.dashing);
  t.expect(r, 'Space dashes');
  await t.step(3);
  await t.walkTo(8, 12.5);
  await t.shot('d1-01-village');
  await go(t, 'west', 'West Gate');
  await go(t, 'west', 'Barrow Road');
  s = await snap(t);
  t.expect(s.area === 'ow-3-2', 'west of Mossbrook is Barrowfield, D1\'s area');
  await go(t, 'west', 'Barrow Crossing');
  await go(t, 'south', 'The Old Barrow');
  await t.walkTo(8, 9.5);
  await t.shot('d1-02-barrow');
  r = await t.enter(8, 7.5);
  s = await snap(t);
  const entered = await t.events('dungeon-enter');
  t.expect(s.area === 'd1' && s.screenName === 'Barrow Mouth' && near(s.lx, 8) && near(s.lz, 10.4) && entered.some((e) => e.id === 'd1'), 'the barrow door leads into D1, just inside the entrance (dungeon-enter d1)');
  await t.eval(() => window.__d1.safe());

  // ---------------------------------------------------------------- J-5: kill-all key, lock-in shutters
  const tab = await t.eval(() => window.__d1.tile(7, 4));
  t.expect(tab === 'T', 'the entrance has a tablet');
  await t.exit('east');
  await t.step(0.6);
  r = await t.eval(() => ({ foes: window.__d1.foes(), shut: window.__d1.solid(0, 5), name: window.__voxelHeroes.screen().name }));
  t.expect(r.name === 'Bone Pit' && r.foes === 3 && r.shut && (await t.events('shutters-closed')).length === 1, `the Bone Pit locks the hero in with 3 skeletons (${JSON.stringify(r)})`);
  const f = await t.fight({ soft: true, seconds: 20 });
  t.note(`Bone Pit: ${f.kills} kills by the blade`);
  await t.eval(() => window.__d1.killAll());
  await t.step(0.3);
  r = await t.eval(() => ({ open: !window.__d1.solid(0, 5), key: window.__d1.of('key').length }));
  t.expect(r.open && r.key === 1 && (await t.events('shutters-opened')).length >= 1, 'clearing it opens the shutters and drops a small key');
  await t.walkTo(8, 6);
  await t.step(0.3);
  t.expect((await t.eval(() => window.__d1.keys())) === 1, 'small key 1 of 4');

  // ---------------------------------------------------------------- I-4: the map; I-3: the push block
  await go(t, 'west', 'Barrow Mouth');
  await go(t, 'north', 'Map Hall');
  await pushInto(t, 8, 4, 'north', 0.3);
  await t.step(1);
  r = await t.eval(() => window.__voxelHeroes.game.dungeons.dungeonProgress('d1'));
  t.expect(r.map, 'the map chest is one room from the entrance');
  await t.shot('d1-03-map-hall');
  await go(t, 'west', 'Block Hall');
  await t.walkTo(4.5, 5.5);
  await t.stick(1, 0, 4.5);
  r = await t.eval(() => ({ key: window.__d1.of('key').length, flag: window.__d1.flags().includes('dungeon:d1:puzzle:I-3') }));
  t.expect(r.flag && r.key === 1 && (await t.events('block-pushed')).length === 5, `pushing the block onto the plate solves the room and drops a key (${JSON.stringify(r)})`);
  await t.walkTo(8, 8);
  await t.step(0.3);
  t.expect((await t.eval(() => window.__d1.keys())) === 2, 'small key 2 of 4');

  // ---------------------------------------------------------------- the first key door, the gazers, the boomerang
  await go(t, 'east', 'Map Hall');
  await pushInto(t, 8, 0, 'north', 0.5);
  r = await t.eval(() => ({ keys: window.__d1.keys(), open: !window.__d1.solid(8, 0), flag: window.__d1.flags().includes('dungeon:d1:door:I-4:n') }));
  t.expect(r.open && r.keys === 1 && r.flag, `a small key opens the Map Hall's north door (${JSON.stringify(r)})`);
  await go(t, 'north', 'Pit Walk');
  await go(t, 'east', 'Gazer Walk');
  await go(t, 'north', 'Turning Room');
  await t.step(0.2);
  await t.eval(() => window.__voxelHeroes.teleport(window.__voxelHeroes.state.screenKey, 8, 9.5)); // (clear of the shutter)
  await t.step(0.5);
  r = await t.eval(() => ({ shut: window.__d1.solid(8, 11), chest: window.__d1.tile(7, 5) }));
  await t.eval(() => window.__d1.killAll());
  await t.step(0.3);
  const chest = await t.eval(() => window.__d1.tile(7, 5));
  t.expect(r.chest === 'h' && chest === 'c', 'the Turning Room shows its chest once its fight is won');
  await pushInto(t, 7, 5, 'south', 0.3);
  await t.step(1);
  r = await t.eval(() => window.__voxelHeroes.game.inventory.hasItem('boomerang'));
  t.expect(r, 'the chest holds the boomerang, the dungeon item');

  // ---------------------------------------------------------------- G-4: the boomerang wall switch
  await go(t, 'south', 'Gazer Walk');
  await go(t, 'west', 'Pit Walk');
  await go(t, 'north', 'Eye Hall');
  await t.eval(() => window.__d1.killAll());
  await throwBoomerang(t, 10.5, 3, 'north');
  r = await t.eval(() => ({ key: window.__d1.of('key').length, flag: window.__d1.flags().includes('dungeon:d1:switches:G-4') }));
  t.expect(r.flag && r.key === 1 && (await t.events('switch-pressed')).length >= 1, `a boomerang throw lights the Eye Hall's wall switch and drops a key (${JSON.stringify(r)})`);
  await t.walkTo(5, 5);
  await t.step(0.3);
  t.expect((await t.eval(() => window.__d1.keys())) === 2, 'small key 3 of 4 (one spent)');

  // ---------------------------------------------------------------- dark room, blades, second kill-all
  await pushInto(t, 0, 5, 'west', 0.5);
  t.expect((await t.eval(() => window.__d1.keys())) === 1, 'the west key door of the Eye Hall takes a key');
  s = await go(t, 'west', 'Dark Hall');
  r = await t.eval(() => window.__voxelHeroes.screen().lighting);
  t.expect(r === 'dark', 'the Dark Hall is a dark room');
  await go(t, 'north', 'Blade Gallery', { keepFoes: true });
  r = await t.eval(() => window.__d1.of('blade-trap').length);
  t.expect(r === 4, 'the Blade Gallery has 4 blade traps');
  await t.eval(() => {
    for (const e of window.__d1.of('blade-trap')) e.remove();
  });
  await go(t, 'north', 'Crossed Bones', { keepFoes: true });
  await t.step(0.5);
  r = await t.eval(() => ({ foes: window.__d1.foes(), shut: window.__d1.solid(15, 5) }));
  t.expect(r.foes > 0 && r.shut, 'Crossed Bones locks the hero in');
  await t.eval(() => window.__d1.killAll());
  await t.step(0.3);
  await t.walkTo(8, 5);
  await t.step(0.3);
  t.expect((await t.eval(() => window.__d1.keys())) === 2, 'small key 4 of 4 from the second kill-all room');

  // ---------------------------------------------------------------- E-4: four eyes, the boss key
  await go(t, 'east', 'Hall of Eyes');
  r = await t.eval(() => {
    const h = window.__voxelHeroes;
    const s = h.screen();
    for (const x of [2, 5, 10]) h.world.trigger(s.x0 + x, s.z0, 'onShot', { projectile: { source: 'boomerang' }, hit: { source: 'boomerang' } });
    return window.__d1.solid(15, 5);
  });
  t.expect(r, 'three eyes lit: the east shutter stays shut');
  await throwBoomerang(t, 13.5, 2, 'north');
  r = await t.eval(() => ({ open: !window.__d1.solid(15, 5), flag: window.__d1.flags().includes('dungeon:d1:switches:E-4') }));
  t.expect(r.open && r.flag, 'the fourth eye, lit by the boomerang within 5 s, opens the way to the boss key');
  await t.shot('d1-04-hall-of-eyes');
  await go(t, 'east', "Warden's Key");
  await pushInto(t, 8, 5, 'north', 0.3);
  await t.step(1);
  t.expect((await t.eval(() => window.__voxelHeroes.game.dungeons.dungeonProgress('d1'))).bossKey, 'the boss key');

  // ---------------------------------------------------------------- the antechamber and the boss door
  await go(t, 'west', 'Hall of Eyes');
  await pushInto(t, 8, 0, 'north', 0.5);
  await go(t, 'north', 'Antechamber');
  await t.walkTo(8.5, 6.5, { allowHooks: true });
  await t.step(0.2);
  t.expect((await t.eval(() => window.__voxelHeroes.game.dungeons.dungeonProgress('d1'))).portal, "the antechamber's floor switch opens the portal");
  r = await t.enter(3.5, 8.5);
  s = await snap(t);
  t.expect(s.screenName === 'Barrow Mouth', 'the portal leads back to the entrance');
  await t.enter(12.5, 8.5);
  s = await snap(t);
  t.expect(s.screenName === 'Antechamber', 'and the entrance portal back to the antechamber');
  await t.eval(() => window.__d1.safe());
  await pushInto(t, 8, 0, 'north', 0.5);
  r = await t.eval(() => window.__d1.flags().includes('dungeon:d1:door:boss'));
  t.expect(r, 'the boss key opens the boss door');
  await t.stick(0, -1, 0.6);
  await t.waitFor((st) => st.area === 'd1-boss' && (st.mode === 'boss-intro' || st.mode === 'play'), { seconds: 6 });
  s = await snap(t);
  t.expect(s.area === 'd1-boss', 'through the boss door: the arena, a load');
  await t.waitFor((st) => st.mode === 'boss-intro', { seconds: 6 });
  await t.step(1.2);
  await t.shot('d1-05-boss-intro');
  await t.waitFor((st) => st.mode === 'play', { seconds: 6 });
  t.expect((await t.events('boss-intro')).length === 1, 'the serpent opens with its intro');

  // ---------------------------------------------------------------- the boss
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const H = window.__d1;
    H.safe();
    const boss = H.of('boss-serpent')[0];
    const out = { segments: boss.segments.length, doorsShut: H.solid(10, 0) && H.solid(10, 15) };
    let n = 0;
    const until = async (pred, max) => {
      for (let i = 0; i < max && !pred(); i++) await h.tick();
    };
    // one real exchange for the screenshot
    await until(() => boss.tail()?.glowing, 240);
    while (boss.segments.length > 3) {
      const tail = boss.tail();
      await until(() => tail.glowing, 240);
      g.damage.dealDamage(tail, { amount: 3, source: 'sword', swingId: `d1-${n++}`, from: h.player });
    }
    return out;
  });
  t.expect(r.segments === 6 && r.doorsShut, `the serpent has 6 segments and the arena doors are shut (${JSON.stringify(r)})`);
  await t.step(0.5);
  await t.shot('d1-06-boss');
  r = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const g = h.game;
    const H = window.__d1;
    const boss = H.of('boss-serpent')[0];
    let n = 100;
    const until = async (pred, max) => {
      for (let i = 0; i < max && !pred(); i++) await h.tick();
    };
    while (boss.segments.length) {
      const tail = boss.tail();
      await until(() => tail.glowing, 240);
      g.damage.dealDamage(tail, { amount: 3, source: 'sword', swingId: `d1-${n++}`, from: h.player });
    }
    for (let i = 0; i < 30 && !boss.removed; i++) g.damage.dealDamage(boss, { amount: 3, source: 'sword', swingId: `d1-h${i}`, from: h.player });
    await h.tick();
    return { dead: boss.removed, container: H.of('heart-container').length, flag: H.flags().includes('boss:d1'), open: !H.solid(10, 0) };
  });
  const beaten = await t.events('boss-defeated');
  t.expect(r.dead && r.flag && r.container === 1 && beaten.some((e) => e.dungeon === 'd1' && !e.refight), `the serpent is beaten: boss:d1, a heart container (${JSON.stringify(r)})`);
  t.expect(r.open, 'the arena doors open');
  const maxHp0 = (await snap(t)).maxHp;
  await t.eval(() => window.__voxelHeroes.player.invT = 0);
  const hc = await t.eval(() => {
    const e = window.__d1.of('heart-container')[0];
    const s = window.__voxelHeroes.screen();
    return { x: e.x - s.x0, z: e.z - s.z0 };
  });
  await t.walkTo(hc.x, hc.z, { soft: true });
  await t.step(1);
  s = await snap(t);
  t.expect(s.maxHp === maxHp0 + 2, `the heart container adds a heart (${maxHp0} -> ${s.maxHp})`);
  await t.step(3);

  // ---------------------------------------------------------------- the reward room and out
  await t.enter(10.5, 0.5);
  s = await snap(t);
  t.expect(s.screenName === 'Reward Room' && s.area === 'd1', 'the arena\'s north door leads to the reward room');
  r = await t.eval(() => window.__d1.of('npc-sage').length);
  t.expect(r === 1, 'the sage waits there');
  await pushInto(t, 8, 4, 'north', 0.3);
  await t.step(1.5);
  const done = await t.events('dungeon-complete');
  r = await t.eval(() => window.__d1.flags().includes('orb:1'));
  t.expect(r && done.some((e) => e.id === 'd1' && e.orb === 1), 'the orb: D1 complete, orb 1');
  await t.enter(8, 11.5);
  s = await snap(t);
  t.expect(s.area === 'ow-3-2' && s.screenName === 'The Old Barrow' && near(s.lx, 8) && near(s.lz, 9), 'the stairs out lead to the barrow door');

  // ---------------------------------------------------------------- the side rooms (hook shortcut)
  await t.teleport('d1:3,6', 8, 2);
  await t.step(0.3);
  await clearFoes(t);
  await pushInto(t, 8, 0, 'north', 0.5);
  await go(t, 'north', "Watchers' Room");
  await t.give('key-red');
  await pushInto(t, 15, 5, 'east', 0.5);
  r = await t.eval(() => !window.__d1.solid(15, 5));
  t.expect(r, 'a red key opens the red lock');
  await go(t, 'east', 'Red Vault');
  const hp0 = await t.eval(() => window.__voxelHeroes.state.heartPieces ?? null);
  await pushInto(t, 8, 5, 'north', 0.3);
  await t.step(1);
  const opened = (await t.events('chest-opened')).map((e) => e.contents);
  t.expect(opened.includes('heart-piece'), `the red vault holds a heart piece (${hp0})`);

  r = await t.eval(() => {
    const rooms = window.__voxelHeroes.game.dungeons.dungeonRooms('d1');
    return { n: rooms.length, missing: rooms.filter((x) => !x.visited).map((x) => x.room ?? x.key) };
  });
  t.expect(r.missing.length === 0, `every room of D1 was entered (${r.n} with the arena; missing: ${r.missing.join(', ') || 'none'})`);
  const doors = (await t.events('door-opened')).map((e) => e.kind ?? 'small');
  t.note(`doors opened: ${doors.join(', ')}; keys-changed ${(await t.events('keys-changed')).length} times`);
}
