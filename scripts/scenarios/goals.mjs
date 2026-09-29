// A clear next goal, ALttP-style (fun audit): the map button does something, a
// "Next:" line tracks progress, the big banner does not spam every screen
// change within one area, and dying gets the hero back up near the fall
// instead of at Crownhold. See game/objective.js, ui/screens/map.js,
// ui/banner.js and systems/flow.js's continuePoint.
export const description = 'Map (overworld + D1, 17 rooms once the map chest is owned), the objective line, banner discipline and respawn near the fall.';

// Talk an NPC's own onInteract through to its close, tapping confirm every
// few ticks (the same pattern npcs.mjs and d1.mjs use for a real
// conversation): types out, turns pages, and picks the first choice offered.
// No flag is touched directly; whatever the talk sets, it sets for real.
const TALK_SRC = `async (h, type) => {
  const n = h.entities.find((e) => e.type === type);
  if (!n) return { found: false };
  h.player.x = n.x;
  h.player.z = n.z + 1.4;
  n.onInteract(h.player);
  for (let i = 0; i < 600 && h.state.mode === 'dialog'; i++) {
    if (i % 15 === 0) h.input.tap('confirm');
    await h.tick();
  }
  for (let i = 0; i < 10; i++) await h.tick();
  h.render();
  return { found: true, mode: h.state.mode, equipped: h.state.swords.equipped, shield: h.state.gear.shield };
}`;

export default async function (t) {
  const talkTo = (type) => t.eval(([src, ty]) => new Function(`return (${src})`)()(window.__voxelHeroes, ty), [TALK_SRC, type]);

  await t.press('Enter');
  await t.step(0.3);

  // ---------------------------------------------------------------- objective
  const readObjective = () => t.eval(() => document.getElementById('objective')?.textContent ?? null);

  const obj0 = await readObjective();
  t.expect(!!obj0 && /Aldric/.test(obj0), `objective starts pointed at King Aldric ("${obj0}")`);

  // The king, for real (CONTRACTS 8.16): teleport to Crownhold and talk to him, the same
  // conversation the player has, not a flag poked from the test. The prologue (title.js's
  // Start and New adventure) leaves the hero unarmed until this lands.
  await t.teleport('ow-4-3:1,1', 7, 5);
  await t.step(0.2);
  const met = await talkTo('npc-king');
  t.expect(met.found, 'King Aldric stands in Crownhold Courtyard');
  t.expect(met.mode === 'play' && met.equipped === 'blade-start' && met.shield >= 1, `talking to him for real arms the hero (${JSON.stringify(met)})`);
  const obj1 = await readObjective();
  t.expect(obj1 !== obj0 && /Barrow/.test(obj1), `changes once the king is met, for real ("${obj0}" -> "${obj1}")`);

  // Entering D1 for real (world/areas/d1.js's area, reached through the barrow door in
  // play): the teleport crosses the area line the same way walking through the door does,
  // so game/dungeons.js's own onAreaChange listener sets dungeon:d1:entered, not the test.
  const inD1 = await t.teleport('d1');
  t.expect(inD1.area === 'd1', `teleported into the Old Barrow (${JSON.stringify(inD1)})`);
  await t.step(0.2);
  await t.eval(() => window.__voxelHeroes.render());
  const obj2 = await readObjective();
  t.expect(obj2 !== obj1, `changes once D1 is entered, for real ("${obj1}" -> "${obj2}")`);

  // The big key, the boss and the orb each gate the next step in turn (real prerequisites,
  // gameplay spec 6.9): game/dungeons.js's own grant helpers, the ones a chest, a boss burst
  // and the reward chest call in play, so only the objective line itself is under test here
  // (d1.mjs fights the real boss and opens the real reward chest for the rest of D1).
  await t.eval(() => {
    window.__voxelHeroes.game.dungeons.giveBossKey('d1');
    window.__voxelHeroes.render();
  });
  const obj2b = await readObjective();
  t.expect(obj2b !== obj2, `changes once the big key is found ("${obj2}" -> "${obj2b}")`);

  await t.eval(() => {
    window.__voxelHeroes.game.dungeons.defeatBoss('d1');
    window.__voxelHeroes.render();
  });
  const obj3 = await readObjective();
  t.expect(obj3 !== obj2b && /orb/i.test(obj3), `changes once the boss falls, points at the orb ("${obj2b}" -> "${obj3}")`);

  await t.eval(() => {
    window.__voxelHeroes.game.dungeons.completeDungeon('d1');
    window.__voxelHeroes.render();
  });
  const obj4 = await readObjective();
  t.expect(obj4 !== obj3 && !/orb/i.test(obj4), `taking the orb moves the goal past it and never back ("${obj3}" -> "${obj4}")`);

  // The sage, for real: talking to him once the orb is in hand does not touch the open
  // goal (game/objective.js: his own flag only ever gates a spell not yet registered), and
  // does not hang or crash the conversation.
  await t.teleport('d1:3,1', 4, 6);
  await t.step(0.2);
  const sage = await talkTo('npc-sage');
  t.expect(sage.found && sage.mode === 'play', `Sage Oriel waits in the Reward Room and the talk closes cleanly (${JSON.stringify(sage)})`);
  const obj5 = await readObjective();
  t.expect(obj5 === obj4, `the open goal holds after talking to the sage ("${obj4}" -> "${obj5}")`);

  // Back to the overworld before the map checks below: opening the map inside a
  // dungeon draws its rooms (renderDungeon), not the charted overworld.
  await t.teleport('Mossbrook Square', 8, 4.5);
  await t.step(0.2);

  // ---------------------------------------------------------------- map: overworld
  await t.tap('map');
  let open = await t.eval(() => document.getElementById('map-screen')?.hidden === false);
  t.expect(open, 'Map opens over the overworld on the Map button');
  const overworld = await t.eval(() => ({
    cells: document.querySelectorAll('#map-screen .map-cell').length,
    hero: !!document.querySelector('#map-screen .map-mark-hero'),
  }));
  t.expect(overworld.cells > 0 && overworld.hero, `overworld map shows charted screens (${overworld.cells}) and the hero's mark`);
  await t.shot('goals-01-map-overworld');
  await t.tap('map');
  open = await t.eval(() => document.getElementById('map-screen')?.hidden === false);
  t.expect(!open, 'Map closes on a second press of the Map button');

  // ---------------------------------------------------------------- banner discipline
  let s = await t.state();
  const bannerBefore = await t.eval(() => document.getElementById('banner')?.textContent ?? null);
  const sibling = await t.eval(
    (areaId) => {
      const h = window.__voxelHeroes;
      const here = h.screen().key;
      for (const scr of h.world.screens.values()) if (scr.area.id === areaId && scr.key !== here) return { key: scr.key, w: scr.w, h: scr.h };
      return null;
    },
    s.area
  );
  t.expect(!!sibling, `${s.area} has a second screen to cross into for the banner check (${JSON.stringify(sibling)})`);
  if (sibling) {
    await t.teleport(sibling.key, Math.floor(sibling.w / 2), Math.floor(sibling.h / 2));
    const bannerAfter = await t.eval(() => document.getElementById('banner')?.textContent ?? null);
    t.expect(bannerAfter === bannerBefore, `no big banner on a screen change within one area (banner still says "${bannerAfter}")`);
  }

  // ---------------------------------------------------------------- respawn near the fall
  const fell = await t.teleport('ow-3-2');
  t.expect(fell.area === 'ow-3-2', `teleported into Barrowfield, Leaper Hollow's area (${JSON.stringify(fell)})`);
  await t.step(0.2);
  await t.setHp(0);
  await t.step(1.5); // past the game-over panel's delay
  let ds = await t.state();
  const msg = await t.eval(() => document.getElementById('overlay-msg').textContent);
  t.expect(ds.mode === 'dead' && ds.overlay, `falls in ow-3-2 (mode ${ds.mode})`);
  t.expect(/\bcoins?\b/.test(msg) && !/gems?/.test(msg), `the game-over text says coins, not gems ("${msg}")`);
  await t.press('Enter'); // Try again
  await t.step(0.3);
  const up = await t.state();
  t.expect(up.mode === 'play' && up.area === 'ow-3-2', `dying in Leaper Hollow respawns in ow-3-2, not Crownhold (area: "${up.area}")`);

  // ---------------------------------------------------------------- map: D1
  const backInD1 = await t.teleport('d1:3,9', 8, 10.4);
  t.expect(backInD1.area === 'd1', `teleported into the Old Barrow (${JSON.stringify(backInD1)})`);
  await t.step(0.2);
  await t.tap('map');
  const before = await t.eval(() => ({
    title: document.querySelector('#map-screen .map-title')?.textContent,
    rooms: document.querySelectorAll('#map-screen .map-room').length,
  }));
  // The dungeon's registered name (src/dungeons/d1.js), same as the door banner and the
  // objective line use (fun audit CLARITY 2/10, item 2: one name for the barrow everywhere).
  t.expect(before.title === 'The Old Barrow', `D1's map is titled with the dungeon's name ("${before.title}")`);
  await t.tap('map'); // close

  await t.eval(() => window.__voxelHeroes.game.dungeons.giveMap('d1'));
  await t.tap('map'); // reopen, a fresh render with the map chest owned
  const after = await t.eval(() => document.querySelectorAll('#map-screen .map-room').length);
  t.expect(after === 17, `D1's map lists all 17 rooms once the map chest is owned (before: ${before.rooms}, after: ${after})`);
  await t.shot('goals-02-map-d1');
  await t.tap('map'); // close
}
