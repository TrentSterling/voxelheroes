// A clear next goal, ALttP-style (fun audit): the map button does something, a
// "Next:" line tracks progress, the big banner does not spam every screen
// change within one area, and dying gets the hero back up near the fall
// instead of at Crownhold. See game/objective.js, ui/screens/map.js,
// ui/banner.js and systems/flow.js's continuePoint.
export const description = 'Map (overworld + D1, 17 rooms once the map chest is owned), the objective line, banner discipline and respawn near the fall.';

export default async function (t) {
  await t.press('Enter');
  await t.step(0.3);

  // ---------------------------------------------------------------- objective
  const readObjective = () => t.eval(() => document.getElementById('objective')?.textContent ?? null);
  const setFlag = (flag) =>
    t.eval((f) => {
      window.__voxelHeroes.state.flags.add(f);
      window.__voxelHeroes.render();
    }, flag);

  const obj0 = await readObjective();
  t.expect(!!obj0 && /Aldric/.test(obj0), `objective starts pointed at King Aldric ("${obj0}")`);

  await setFlag('overworld:talked:king');
  const obj1 = await readObjective();
  t.expect(obj1 !== obj0 && /Barrow/.test(obj1), `changes once the king is met ("${obj0}" -> "${obj1}")`);

  await setFlag('dungeon:d1:entered');
  const obj2 = await readObjective();
  t.expect(obj2 !== obj1, `changes once D1 is entered ("${obj1}" -> "${obj2}")`);

  // The big key gates the boss step in turn (a real prerequisite, gameplay
  // spec 6.9): give it directly so the boss flag alone is what is under test.
  await t.eval(() => {
    window.__voxelHeroes.game.dungeons.giveBossKey('d1');
    window.__voxelHeroes.render();
  });
  const obj2b = await readObjective();
  t.expect(obj2b !== obj2, `changes once the big key is found ("${obj2}" -> "${obj2b}")`);

  await setFlag('boss:d1');
  const obj3 = await readObjective();
  t.expect(obj3 !== obj2b, `changes once the boss falls ("${obj2b}" -> "${obj3}")`);

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
  const inD1 = await t.teleport('d1:3,9', 8, 10.4);
  t.expect(inD1.area === 'd1', `teleported into the Old Barrow (${JSON.stringify(inD1)})`);
  await t.step(0.2);
  await t.tap('map');
  const before = await t.eval(() => ({
    title: document.querySelector('#map-screen .map-title')?.textContent,
    rooms: document.querySelectorAll('#map-screen .map-room').length,
  }));
  t.expect(before.title === 'Hollow Barrow', `D1's map is titled with the dungeon's name ("${before.title}")`);
  await t.tap('map'); // close

  await t.eval(() => window.__voxelHeroes.game.dungeons.giveMap('d1'));
  await t.tap('map'); // reopen, a fresh render with the map chest owned
  const after = await t.eval(() => document.querySelectorAll('#map-screen .map-room').length);
  t.expect(after === 17, `D1's map lists all 17 rooms once the map chest is owned (before: ${before.rooms}, after: ${after})`);
  await t.shot('goals-02-map-d1');
  await t.tap('map'); // close
}
