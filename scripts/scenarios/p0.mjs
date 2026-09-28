// P0.2 and P0.5 (gameplay spec section 13): the screen framework and cameras.
// A follows the hero and changes screen with no slide past a 0.5-tile dead
// band; B holds and slides in 48 ticks, carrying the hero 1.0 tile in; a load
// takes at most 90 ticks with its card shown on the black, and only the
// current area is built; the dungeon room uses the art bible's standard rig
// on the room centre, and the interior rig follows the hero inside its room.
export const description = 'Camera follow and hold modes, follow changes, slides, loads with cards, one built area, the dungeon and interior rigs.';

const near = (a, b, eps = 0.02) => Math.abs(a - b) <= eps;

// Hold the stick (sx, sz) tick by tick until done(snapshot) or maxTicks;
// returns the ticks run and the modes and screens seen on the way.
const drive = (t, sx, sz, maxTicks, doneSrc) =>
  t.eval(
    async ([sx, sz, maxTicks, doneSrc]) => {
      const h = window.__voxelHeroes;
      const done = new Function('s', `return (${doneSrc});`);
      const modes = new Set();
      const keys = [];
      let ticks = 0;
      let lastKey = h.state.screenKey;
      for (; ticks < maxTicks; ticks++) {
        h.input.setStick(h.state.mode === 'play' ? sx : 0, h.state.mode === 'play' ? sz : 0);
        await h.tick();
        modes.add(h.state.mode);
        if (h.state.screenKey !== lastKey) keys.push({ key: (lastKey = h.state.screenKey), x: +h.player.x.toFixed(3), mode: h.state.mode, tick: ticks + 1 });
        if (done(h.snapshot())) break;
      }
      h.input.setStick(0, 0);
      return { ticks: ticks + 1, modes: [...modes], keys };
    },
    [sx, sz, maxTicks, doneSrc]
  );

export default async function p0(t) {
  await t.track('room-enter', 'area-enter');
  await t.eval(() => window.__voxelHeroes.start());
  await t.step(1.1);
  let s = await t.state();
  t.expect(s.loadedArea === 'ow-4-3', `only the current area is built at the start, the castle's (${s.loadedArea})`);

  // ---------------------------------------------------------------- A: follow
  await t.eval(() => {
    const h = window.__voxelHeroes;
    h.camera.choose('A');
    h.teleport('Crossroads', 14, 5.5);
    for (const e of h.entities) if (e.kind === 'enemy') e.removed = true;
  });
  await t.step(0.2);
  let r = await drive(t, 1, 0, 120, 's.lx >= 1.2 && s.screenName === "Rattlestone Hollow"');
  s = await t.state();
  t.expect(r.keys.length === 1 && !r.modes.includes('scroll'), `camera A: walking over the screen line fires exactly one change, no slide (${JSON.stringify(r.keys)}; modes ${r.modes})`);
  const edge = await t.eval(() => window.__voxelHeroes.screen().x0);
  t.expect(r.keys[0] && near(r.keys[0].x - edge, 0.5, 0.1), `  the change fires 0.5 tile past the edge (hero ${r.keys[0] ? (r.keys[0].x - edge).toFixed(2) : '?'} past)`);
  t.expect(s.mode === 'play', '  and never locks input');
  const cam = await t.eval(() => {
    const h = window.__voxelHeroes;
    return { cx: h.camera.target.x, px: h.player.x };
  });
  t.expect(near(cam.cx, cam.px, 0.01), `  the camera follows the hero across (subject x ${cam.cx.toFixed(2)}, hero ${cam.px.toFixed(2)})`);
  // back west: no change until 0.5 tile past the west edge (the dead band)
  r = await drive(t, -1, 0, 60, 's.lx <= -0.3');
  t.expect(r.keys.length === 0, `  stepping back 0.3 tile over the line changes nothing (${r.keys.length} changes)`);
  r = await drive(t, -1, 0, 60, 's.screenName === "Crossroads"');
  t.expect(r.keys.length === 1, '  0.5 tile past it the hero is back on the Crossroads');
  await drive(t, -1, 0, 120, 's.lx <= 12.5'); // clear of the trees along the line, which hide him from A
  await t.step(0.3);
  await t.shot('p0-overworld-A');

  // ---------------------------------------------------------------- follow: shots and leashes
  // In A a shot flies on past the screen line and dies 20 tiles from the
  // hero; in B it dies at the screen's edge. An enemy stays on its screen
  // while the hero stands in the dead band past its edge.
  const shotRun = (preset) =>
    t.eval(async (preset) => {
      const h = window.__voxelHeroes;
      h.camera.choose(preset);
      h.teleport('Crossroads', 12, 5.5, { yaw: Math.PI / 2 });
      for (const e of h.entities) if (e.kind === 'enemy' || e.kind === 'projectile') e.remove();
      const { Projectile } = h.game.projectile;
      if (!h.api.entityTypes?.().includes?.('p0-bolt')) {
        try {
          h.api.registerEntity('p0-bolt', (o) => new Projectile(o, { owner: 'hero', damage: 0, speed: 8, passWalls: true, range: 100 }));
        } catch {}
      }
      const x1 = h.screen().x1;
      const shot = h.spawn('p0-bolt', 12.5, 5.5, { dir: { x: 1, z: 0 } });
      let last = shot.x;
      for (let i = 0; i < 400 && !shot.removed; i++) {
        last = shot.x;
        await h.tick();
      }
      return { past: +(last - x1).toFixed(2), fromHero: +(last - h.player.x).toFixed(2), removed: shot.removed };
    }, preset);
  let shotA = await shotRun('A');
  t.expect(shotA.removed && shotA.past > 2 && Math.abs(shotA.fromHero - 20) < 0.2, `camera A: a shot flies on past the screen line and dies 20 tiles from the hero (${shotA.fromHero} from him, ${shotA.past} past the line)`);
  const shotB = await shotRun('B');
  t.expect(shotB.removed && shotB.past <= 0.2, `camera B: a shot dies at the screen's edge (${shotB.past} past it)`);
  const leash = await t.eval(async () => {
    const h = window.__voxelHeroes;
    h.camera.choose('A');
    h.teleport('Crossroads', 12, 5.5);
    for (const e of h.entities) if (e.kind === 'enemy' || e.kind === 'projectile') e.remove();
    const s = h.screen();
    h.player.x = s.x1 + 0.3; // in the dead band, still on the Crossroads
    const foe = h.spawn('slime', 14.5, 5.5);
    let maxX = -Infinity;
    for (let i = 0; i < 240; i++) {
      h.player.invT = 10;
      await h.tick();
      maxX = Math.max(maxX, foe.x);
    }
    return { key: h.state.screenKey, was: s.key, past: +(maxX - s.x1).toFixed(3), r: foe.r ?? 0 };
  });
  t.expect(leash.key === leash.was && leash.past <= 1e-3, `  an enemy stays on its screen while the hero is in the dead band (its furthest ${leash.past} past the edge)`);

  // ---------------------------------------------------------------- B: hold and slide
  await t.eval(() => {
    const h = window.__voxelHeroes;
    h.camera.choose('B');
    h.teleport('Crossroads', 14.5, 5.5);
    for (const e of h.entities) if (e.kind === 'enemy') e.removed = true;
  });
  await t.step(0.2);
  r = await drive(t, 1, 0, 120, 's.mode === "scroll"');
  const scroll = await drive(t, 0, 0, 120, 's.mode === "play"');
  s = await t.state();
  t.expect(scroll.ticks === 48, `camera B: the slide takes 48 ticks (${scroll.ticks})`);
  t.expect(s.screenName === 'Rattlestone Hollow' && near(s.lx, 1.0, 0.02), `  and the hero ends 1.0 tile inside (${s.lx})`);

  // ---------------------------------------------------------------- load with a card
  await t.eval(() => {
    const h = window.__voxelHeroes;
    h.camera.choose('A');
    h.teleport('Cairn Ridge', 8.5, 2.5);
    for (const e of h.entities) if (e.kind === 'enemy') e.removed = true;
  });
  await t.step(0.2);
  r = await drive(t, 0, -1, 120, 's.mode === "warp"');
  const mid = await drive(t, 0, 0, 40, 's.loadCard.visible');
  s = await t.state();
  t.expect(s.loadCard.visible && s.loadCard.title === 'Cairn Crypt', `the load shows the crypt's card on the black ("${s.loadCard.title}")`);
  const rest = await drive(t, 0, 0, 120, 's.mode === "play"');
  const total = mid.ticks + rest.ticks; // ticks in mode warp, the one that ends it included
  s = await t.state();
  t.expect(total <= 90, `  the load takes at most 90 ticks (${total})`);
  t.expect(!s.loadCard.visible, '  the card is gone when play resumes');
  const built = await t.eval(() => {
    const h = window.__voxelHeroes;
    let other = 0;
    for (const sc of h.world.screens.values()) if (sc.area.id !== 'crypt') other += sc.meshes.length + sc.props.size;
    return { loaded: h.world.loaded, other };
  });
  t.expect(built.loaded === 'crypt' && built.other === 0, `  only the crypt is built now (${built.other} meshes and props elsewhere)`);

  // ---------------------------------------------------------------- dungeon and interior rigs
  s = await t.state();
  const lens = await t.eval(() => ({ ...window.__voxelHeroes.camera.lens() }));
  t.expect(s.cam.preset === 'dungeon' && near(lens.pitch, 43.055, 1e-6) && near(lens.fov, 37.38, 1e-6) && near(lens.height, 9.865, 1e-6) && near(lens.lead, -0.09, 1e-6), `the dungeon room uses the standard rig (${lens.pitch}, ${lens.fov}, ${lens.height}, ${lens.lead})`);
  t.expect(near(s.cam.x, 8) && near(s.cam.z, 6), `  aimed at the room centre (${s.cam.x}, ${s.cam.z})`);
  await t.eval(() => {
    const h = window.__voxelHeroes;
    for (const e of h.entities) if (e.kind === 'enemy') e.removed = true;
    h.player.x = h.screen().x0 + 8;
    h.player.z = h.screen().z0 + 7;
  });
  await t.step(0.6);
  await t.shot('p0-dungeon-room');

  await t.eval(() => window.__voxelHeroes.teleport('Burrow'));
  await t.step(0.3);
  s = await t.state();
  const ilens = await t.eval(() => ({ ...window.__voxelHeroes.camera.lens() }));
  t.expect(s.cam.preset === 'interior' && near(ilens.pitch, 50.278, 1e-6) && near(ilens.height, 11.986, 1e-6), `the interior uses the art bible's interior rig (${ilens.pitch}, ${ilens.height})`);
  t.expect(s.cam.x >= 0 && s.cam.x <= s.size[0] && s.cam.z >= 0 && s.cam.z <= s.size[1], `  its subject stays in the room (${s.cam.x}, ${s.cam.z})`);
  const frame = await t.eval(() => window.__voxelHeroes.camera.heroInFrame());
  t.expect(frame.out === 0, `  with all of the hero in frame (${frame.out} vertices out)`);
}
