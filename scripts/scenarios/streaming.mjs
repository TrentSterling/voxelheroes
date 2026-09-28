// The streamed outdoors (systems/streaming.js): the overworld and the town are one space. Every
// screen within TUNING.stream.radius of the hero's is built (terrain, props, people and foes)
// ahead of him, across area edges; walking over an area edge is a follow change like any other,
// with no fade; the next screen's foes are already standing there before he crosses; a foe left
// hurt on one screen is still there, just as hurt, after he steps away and back; and building
// never takes more than its per-frame budget (plus one step) of a simulated frame.
export const description = "Streamed outdoors: the live ring across area edges, no fade over an area edge, the next screen's foes there before the hero is, foes kept when he steps away and back, and the build budget per frame.";

const TICK = 1 / 60;

// Ticks until nothing is left to build (at most `max`); returns the screens still pending.
const settle = (t, max = 1800) =>
  t.eval(async (max) => {
    const h = window.__voxelHeroes;
    for (let i = 0; i < max && h.world.pending.size; i++) await h.tick();
    return h.world.pending.size;
  }, max);

// Hold the stick (sx, sz) in play until the hero's area-local screen key is `to` (or maxTicks):
// the modes and screen keys seen on the way, and the ticks it took.
const walk = (t, sx, sz, to, maxTicks = 600) =>
  t.eval(
    async ([sx, sz, to, maxTicks]) => {
      const h = window.__voxelHeroes;
      const modes = new Set();
      const keys = [h.state.screenKey];
      let ticks = 0;
      for (; ticks < maxTicks && h.state.screenKey !== to; ticks++) {
        h.player.invT = 10; // nothing on the way stops him
        h.input.setStick(h.state.mode === 'play' ? sx : 0, h.state.mode === 'play' ? sz : 0);
        await h.tick();
        modes.add(h.state.mode);
        if (h.state.screenKey !== keys.at(-1)) keys.push(h.state.screenKey);
      }
      h.input.setStick(0, 0);
      return { ticks, modes: [...modes], keys, at: h.state.screenKey };
    },
    [sx, sz, to, maxTicks]
  );

export default async function streaming(t) {
  await t.track('area-enter', 'room-enter', 'warp');
  await t.press('Enter');
  await t.step(1.1);
  await t.eval(() => window.__voxelHeroes.camera.choose('A'));

  // ---------------------------------------------------------------- the ring
  t.expect((await settle(t)) === 0, 'the ring around Mossbrook Square finishes building');
  let st = await t.eval(() => window.__voxelHeroes.world.stream.state());
  const R = st.radius;
  t.expect(R === 2, `the live ring reaches ${R} screens out at the default look`);
  const want = ['v1:1,1', 'v1:0,0', 'v1:2,2', 'ow-4-3:1,0', 'ow-4-3:2,0', 'ow-3-2:2,0', 'ow-3-2:2,2'];
  t.expect(want.every((k) => st.live.includes(k)), `live around the Square, across area edges: ${want.filter((k) => st.live.includes(k)).join(', ')} (${st.live.length} live, ${st.scenery.length} scenery)`);
  t.expect(!st.live.includes('ow-4-3:1,2') && !st.live.includes('ow-3-2:1,1') && st.scenery.includes('ow-3-2:1,1'), '  one ring further out is scenery, and nothing past the radius is live');
  const peopled = await t.eval(() => {
    const h = window.__voxelHeroes;
    return ['v1:1,0', 'v1:0,1', 'ow-3-2:2,1'].map((k) => [k, h.world.stream.bucket(k).length]);
  });
  t.expect(peopled.every(([, n]) => n > 0), `  their people and foes are already out: ${peopled.map(([k, n]) => `${k} ${n}`).join(', ')}`);

  // ---------------------------------------------------------------- West Gate: the next screen's foes are there first
  await t.eval(() => window.__voxelHeroes.teleport('v1:0,1', 4.5, 8, { yaw: -Math.PI / 2 }));
  t.expect((await settle(t)) === 0, 'from West Gate the ring builds out west into Barrowfield');
  const ahead = await t.eval(() => {
    const h = window.__voxelHeroes;
    const foes = h.world.stream.bucket('ow-3-2:2,1').filter((e) => e.kind === 'enemy');
    for (const e of foes) e.__probe = e.__probe ?? Math.random(); // to know them again
    return { n: foes.length, grown: foes.every((e) => e.spawned !== false && e.object.scale.x > 0.99), onStage: h.entities.filter((e) => e.kind === 'enemy').length };
  });
  t.expect(ahead.n > 0 && ahead.grown, `Barrow Road's ${ahead.n} foes stand there, fully grown, before the hero crosses (West Gate's own: ${ahead.onStage})`);

  // ---------------------------------------------------------------- over the area edge: no fade
  await t.eval(() => {
    const h = window.__voxelHeroes;
    h.world.stats.maxFrameMs = 0;
    h.world.stats.maxStepMs = 0;
    h.world.stats.now = 0;
  });
  const areasBefore = (await t.events('area-enter')).length;
  let w = await walk(t, -1, 0, 'ow-3-2:2,1');
  st = await t.state();
  const enter = (await t.events('room-enter')).at(-1);
  t.expect(w.at === 'ow-3-2:2,1' && st.area === 'ow-3-2', `walking west crosses from Mossbrook into Barrowfield (${w.keys.join(' > ')}, ${w.ticks} ticks)`);
  t.expect(w.modes.every((m) => m === 'play'), `  in play the whole way: no fade, no slide (modes ${w.modes.join(', ')})`);
  t.expect((await t.events('area-enter')).length === areasBefore && enter.via === 'follow', `  no 'area-enter' (no loading card); 'room-enter' via ${enter.via}`);
  const met = await t.eval(() => {
    const h = window.__voxelHeroes;
    const foes = h.entities.filter((e) => e.kind === 'enemy');
    return { n: foes.length, same: foes.filter((e) => e.__probe !== undefined).length };
  });
  t.expect(met.n === ahead.n && met.same === ahead.n, `  the foes he meets are the ones that stood there (${met.same} of ${met.n})`);
  const cam = await t.eval(() => window.__voxelHeroes.camera.expected().distanceTo(window.__voxelHeroes.camera.target));
  t.expect(cam < 1e-6, '  and the camera follows him through');

  // ---------------------------------------------------------------- a hurt foe stays hurt
  const hurt = await t.eval(() => {
    const h = window.__voxelHeroes;
    const foe = h.entities.find((e) => e.kind === 'enemy' && e.hp > 1);
    if (!foe) return null;
    foe.hp -= 1;
    foe.__hurt = true;
    return { type: foe.type, hp: foe.hp };
  });
  t.expect(!!hurt, `a ${hurt?.type} on Barrow Road takes a hit (${hurt?.hp} hp left)`);
  w = await walk(t, 1, 0, 'v1:0,1');
  t.expect(w.at === 'v1:0,1' && w.modes.every((m) => m === 'play'), `  the hero steps back east into West Gate (${w.keys.join(' > ')})`);
  const away = await t.eval(() => {
    const h = window.__voxelHeroes;
    const foe = h.world.stream.bucket('ow-3-2:2,1').find((e) => e.__hurt);
    return foe ? { hp: foe.hp, removed: foe.removed, onStage: h.entities.includes(foe) } : null;
  });
  t.expect(away && !away.removed && !away.onStage && away.hp === hurt.hp, `  while he is away it waits on its own screen (${away ? `${away.hp} hp` : 'gone'})`);
  await t.step(0.5);
  w = await walk(t, -1, 0, 'ow-3-2:2,1');
  const back = await t.eval(() => {
    const h = window.__voxelHeroes;
    const foe = h.entities.find((e) => e.__hurt);
    return foe ? { hp: foe.hp, removed: foe.removed } : null;
  });
  t.expect(w.at === 'ow-3-2:2,1' && back && !back.removed && back.hp === hurt.hp, `  back on Barrow Road it is still there with ${back?.hp} hp`);

  // ---------------------------------------------------------------- the budget
  const stats = await t.eval(() => ({ ...window.__voxelHeroes.world.stats, budget: window.__voxelHeroes.world.stream.tuning.budgetMs }));
  t.note(`build time per frame on the walks: max ${stats.maxFrameMs.toFixed(2)} ms (budget ${stats.budget} ms), longest step ${stats.maxStepMs.toFixed(2)} ms, ${stats.steps} steps, ${stats.builds} builds`);
  t.expect(stats.now === 0, `no screen had to be built on the spot while walking (${stats.now})`);
  t.expect(stats.maxStepMs <= 6, `every build step is small (${stats.maxStepMs.toFixed(2)} ms)`);
  t.expect(stats.maxFrameMs <= stats.budget + stats.maxStepMs + 0.5, `no frame spent more than the budget plus one step building (${stats.maxFrameMs.toFixed(2)} ms)`);

  // ---------------------------------------------------------------- south to Crownhold and back, over two more area edges
  await t.eval(() => window.__voxelHeroes.teleport('v1:1,2', 8, 12, { yaw: 0 }));
  await settle(t);
  w = await walk(t, 0, 1, 'ow-4-3:1,0');
  t.expect(w.at === 'ow-4-3:1,0' && w.modes.every((m) => m === 'play'), `south from Mossbrook Lane into Crownhold's Castle Road with no fade (${w.keys.join(' > ')}; ${w.modes.join(', ')})`);
  w = await walk(t, 0, -1, 'v1:1,2');
  t.expect(w.at === 'v1:1,2' && w.modes.every((m) => m === 'play'), `  and back north (${w.keys.join(' > ')})`);
  t.expect((await t.events('area-enter')).length === areasBefore, "  still no 'area-enter'");
  st = await t.eval(() => window.__voxelHeroes.world.stream.state());
  t.expect(!st.live.includes('ow-3-2:0,1'), `  far screens left the ring as he went (${st.live.length} live)`);
  await t.step(0.3);
  await t.shot('streaming-lane');

  // ---------------------------------------------------------------- the 'low' look
  // Weak devices (the watchdog drops to 'low') keep one screen around the hero and no scenery.
  const low = await t.eval(async () => {
    const h = window.__voxelHeroes;
    const was = h.look.get();
    h.look.set('low');
    await h.step(0.1);
    const st = h.world.stream.state();
    const far = st.live.filter((k) => h.world.screenDist(h.screen(), h.world.screen(k)) > 2 && h.world.screen(k).streams);
    h.look.set(was);
    await h.step(0.1);
    return { radius: st.radius, scenery: st.scenery.length, far: far.length, back: h.world.stream.state().radius };
  });
  t.expect(
    low.radius === 1 && low.scenery === 0 && low.far === 0 && low.back === 2,
    `at the 'low' look the ring is 1 screen with no scenery (${low.far} live past it), and 2 again after (${low.back})`
  );
}
