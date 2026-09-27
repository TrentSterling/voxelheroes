// The camera rules at a wide and a phone-shaped viewport (1280 x 720 and
// 390 x 844), for the player's presets A-D and for the dungeon camera:
//   - the hero is always in frame: all of him (both sides of his feet and of
//     his head) with the presets that follow him; with the fixed dungeon
//     camera at 16:9 his feet and the middle of his head (the room framing
//     is fixed, so his hat may touch the frame's side in a bottom corner);
//   - the ground at the frame's bottom edge never lies past the screen's
//     south edge, and the screens south of the current one are not drawn;
//   - on the hero's row the frame's sides stay inside the screen where the
//     frame is narrower than the screen (centred where it is wider), except
//     by under a tile when the hero stands at that edge (to keep him whole);
//   - slides keep the hero in frame, move the camera without jumps and land
//     exactly where the follow rule wants it, so nothing jumps after them;
//   - the dungeon camera stays on the room centre at 16:9 and follows the
//     hero across only where the frame is too narrow (the phone).
export const description = 'Camera presets A-D and the dungeon camera at 1280 x 720 and 390 x 844: hero in frame, no screen to the south at the bottom edge, sides inside the screen, slides that land without a jump.';

const VIEWPORTS = [
  { name: 'wide', width: 1280, height: 720 },
  { name: 'phone', width: 390, height: 844 },
];
const PRESETS = ['A', 'B', 'C', 'D'];
const KEYS = { north: 'ArrowUp', south: 'ArrowDown', east: 'ArrowRight', west: 'ArrowLeft' };
const APPROACH = { north: [8, 3], south: [8, 8], east: [13, 5.5], west: [3, 5.5] }; // test fields' gaps

const clearFoes = (t) =>
  t.eval(() => {
    for (const e of window.__voxelHeroes.entities) if (e.kind === 'enemy' || e.kind === 'projectile') e.remove();
  });

// Stand the hero on each spot (local x, z) of the current screen in turn,
// run one tick so the camera follows, and check the frame. Spots on tiles
// with an onEnter hook (warps) are skipped. whole: check both sides of the
// hero's head, not just its middle. Returns the problems found and the
// camera subjects (local) seen.
const checkSpots = (t, spots, whole = true) =>
  t.eval(([list, whole]) => {
    const g = window.__voxelHeroes;
    const s = g.screen();
    const p = g.player;
    const { heroHead, heroHalf } = g.camera.rules;
    const head = whole ? [[-heroHalf, heroHead], [heroHalf, heroHead]] : [[0, heroHead]];
    const fails = [];
    const cams = [];
    let checked = 0;
    for (const [lx, lz] of list) {
      if (g.world.tileDefAt(s.x0 + Math.floor(lx), s.z0 + Math.floor(lz))?.onEnter) continue;
      p.x = s.x0 + lx;
      p.z = s.z0 + lz;
      g.update(1 / 60);
      if (g.screen() !== s || g.state.mode !== 'play') {
        fails.push(`${lx},${lz}: left the screen or play (${g.state.mode})`);
        break;
      }
      checked++;
      const at = `${lx},${lz}`;
      cams.push([+(g.camera.target.x - s.x0).toFixed(3), +(g.camera.target.z - s.z0).toFixed(3)]);
      // the hero: both sides of his feet, and his head
      for (const [dx, y] of [[-p.r, 0], [p.r, 0], ...head]) {
        const [nx, ny] = g.camera.project(p.x + dx, y, p.z);
        if (Math.abs(nx) > 1 + 1e-4 || Math.abs(ny) > 1 + 1e-4) fails.push(`${at}: hero out of frame (${nx.toFixed(3)}, ${ny.toFixed(3)} at ${dx}, ${y})`);
      }
      // the bottom edge
      for (const nx of [-1, 0, 1]) {
        const q = g.camera.groundAt(nx, -1);
        if (!q || q.z > s.z1 + 1e-3) fails.push(`${at}: the bottom edge shows ${q ? `z ${(q.z - s.z0).toFixed(3)}` : 'sky'}`);
      }
      // the sides on the hero's row: how far past each screen edge they show
      const [, row] = g.camera.project(p.x, 0, p.z);
      const L = g.camera.groundAt(-1, row);
      const R = g.camera.groundAt(1, row);
      const past = { west: s.x0 - L.x, east: R.x - s.x1 };
      const near = { west: lx <= 1, east: lx >= s.w - 1 };
      if (R.x - L.x >= s.w) {
        if (Math.abs(past.west - past.east) > 1e-3 && !near.west && !near.east)
          fails.push(`${at}: the frame is wider than the screen but not centred (${past.west.toFixed(3)}, ${past.east.toFixed(3)})`);
      } else
        for (const side of ['west', 'east'])
          if (past[side] > (near[side] ? 1 : 1e-3)) fails.push(`${at}: the frame shows ${past[side].toFixed(3)} past the ${side} edge`);
    }
    return { fails, cams, checked };
  }, [spots, whole]);

// Follow a slide that has just started, tick by tick, then ten ticks of
// standing still. worstHero: the hero's feet in NDC (1 is the frame's edge);
// worstStep: the camera's largest move in one tick; after: its largest move
// once play resumed; off: how far it is from where the follow rule wants it.
const followSlide = (t) =>
  t.eval(() => {
    const g = window.__voxelHeroes;
    const p = g.player;
    const out = { ticks: 0, worstHero: 0, worstStep: 0, after: 0, off: 0, mode: '' };
    let last = g.camera.target.clone();
    while (g.state.mode === 'scroll' && out.ticks < 240) {
      g.update(1 / 60);
      out.ticks++;
      const [nx, ny] = g.camera.project(p.x, 0, p.z);
      out.worstHero = Math.max(out.worstHero, Math.abs(nx), Math.abs(ny));
      out.worstStep = Math.max(out.worstStep, last.distanceTo(g.camera.target));
      last = g.camera.target.clone();
    }
    for (let i = 0; i < 10; i++) {
      g.update(1 / 60);
      out.after = Math.max(out.after, last.distanceTo(g.camera.target));
      last = g.camera.target.clone();
    }
    out.off = g.camera.expected().distanceTo(g.camera.target);
    out.mode = g.state.mode;
    return out;
  });

async function slide(t, dir, label) {
  await t.walkTo(...APPROACH[dir]);
  await t.page.keyboard.down(KEYS[dir]);
  try {
    await t.waitFor((s) => s.mode !== 'play', { seconds: 4 });
  } finally {
    await t.page.keyboard.up(KEYS[dir]);
  }
  const f = await followSlide(t);
  const s = await t.state();
  t.expect(
    f.mode === 'play' && f.worstHero <= 1.05 && f.worstStep < 1.2 && f.after < 1e-6 && f.off < 1e-6,
    `  ${label} ${dir} to ${s.screenName}: hero within ${f.worstHero.toFixed(3)} of the frame, camera step at most ${f.worstStep.toFixed(3)}, lands clean`
  );
}

// A grid of spots over a screen of w x h tiles, from r inside each edge.
function grid(w, h, r, x0 = 0, z0 = 0) {
  const xs = [x0 + r, x0 + (w - x0) * 0.25, (x0 + w) / 2, x0 + (w - x0) * 0.75, w - r];
  const zs = [z0 + r, z0 + (h - z0) * 0.25, (z0 + h) / 2, z0 + (h - z0) * 0.75, h - r];
  const out = [];
  for (const z of zs) for (const x of xs) out.push([+x.toFixed(2), +z.toFixed(2)]);
  return out;
}

export default async function cameraScenario(t) {
  await t.press('Enter');
  await t.step(1.1);
  const r = await t.eval(() => window.__voxelHeroes.player.r);

  // From Cairn Ridge the overworld row it is on is drawn, the row south of it
  // (the Crossroads and its neighbours) is not.
  await t.teleport('overworld:1,0', 8, 5.5);
  const drawn = await t.eval(() => [...window.__voxelHeroes.world.screens.keys()].filter((k) => window.__voxelHeroes.transitions.shown(k)).sort());
  t.expect(drawn.join(' ') === 'overworld:0,0 overworld:1,0 overworld:2,0', `from Cairn Ridge only its own row of screens is drawn (${drawn.join(', ')})`);

  for (const vp of VIEWPORTS) {
    await t.page.setViewportSize({ width: vp.width, height: vp.height });
    // The page sees the resize on its next frame.
    await t.page.waitForFunction((a) => Math.abs(window.__voxelHeroes.camera.object.aspect - a) < 1e-3, vp.width / vp.height, { timeout: 10000 }).catch(() => {});
    await t.step(0.1);
    const aspect = await t.eval(() => window.__voxelHeroes.camera.object.aspect);
    t.expect(Math.abs(aspect - vp.width / vp.height) < 1e-3, `${vp.width} x ${vp.height}: the camera aspect follows the window (${aspect.toFixed(3)})`);

    for (const preset of PRESETS) {
      await t.eval((n) => window.__voxelHeroes.camera.choose(n), preset);
      // Cairn Ridge has screens west, east and south of it.
      await t.teleport('overworld:1,0', 8, 5.5);
      await clearFoes(t);
      t.expect((await t.state()).cam.preset === preset, `${vp.name} ${preset}: Cairn Ridge uses the chosen preset`);
      const { fails, checked } = await checkSpots(t, grid(16, 11, r));
      t.expect(fails.length === 0, fails.length ? `${vp.name} ${preset}: ${fails.join('; ')}` : `  ${checked} hero spots on Cairn Ridge: hero in frame, bottom edge and sides inside the screen`);

      // Shots: the hero by the south gap (bottom-edge clamp) and by the east gap (side clamp).
      await t.teleport('overworld:1,0', 8, 10.5, { yaw: 0 });
      await clearFoes(t);
      await t.step(0.2);
      await t.shot(`${vp.name}-${preset}-south-edge`);
      await t.teleport('overworld:1,0', 15.6, 5.5, { yaw: Math.PI / 2 });
      await clearFoes(t);
      await t.step(0.2);
      await t.shot(`${vp.name}-${preset}-east-edge`);

      // Slides in all four directions round the Hedgerows.
      await t.teleport('test-hedgerows:0,0', 8, 5.5);
      await slide(t, 'east', preset);
      await slide(t, 'south', preset);
      await slide(t, 'west', preset);
      await slide(t, 'north', preset);
    }

    // The dungeon camera in the Sunken Gate (16 x 12), whatever the choice.
    await t.eval(() => window.__voxelHeroes.camera.choose('A'));
    await t.teleport('crypt:0,1', 8, 6);
    await clearFoes(t);
    let s = await t.state();
    t.expect(s.cam.preset === 'dungeon', `${vp.name}: the crypt fixes the dungeon camera over the player's A`);
    // The floor the hero can reach: side wall faces at 1.5 and 14.5, north
    // and south faces at 1 and 11.
    const spots = grid(14.5, 11, r, 1.5, 1);
    const { fails, cams, checked } = await checkSpots(t, spots, vp.name === 'phone');
    t.expect(fails.length === 0, fails.length ? `${vp.name} dungeon: ${fails.join('; ')}` : `  ${checked} hero spots in the Sunken Gate: hero in frame, bottom edge inside the room`);
    const centred = cams.filter(([x, z]) => Math.abs(x - 8) < 1e-3 && Math.abs(z - 6) < 1e-3).length;
    if (vp.name === 'wide') t.expect(centred === cams.length, `  at 16:9 the camera stays on the room centre for all ${cams.length} spots`);
    else t.expect(centred < cams.length && cams.every(([, z]) => Math.abs(z - 6) < 1e-3), `  on the phone it follows the hero across (${cams.length - centred} of ${cams.length} spots off centre) and keeps the room's depth`);
    await t.teleport('crypt:0,1', 1.8, 9.5, { yaw: -Math.PI / 2 });
    await clearFoes(t);
    await t.step(0.2);
    await t.shot(`${vp.name}-dungeon-corner`);
    await t.teleport('crypt:0,1', 8, 6);
    await clearFoes(t);
    await t.walkTo(13, 6);
    await t.page.keyboard.down('ArrowRight');
    try {
      await t.waitFor((st) => st.mode !== 'play', { seconds: 4 });
    } finally {
      await t.page.keyboard.up('ArrowRight');
    }
    const f = await followSlide(t);
    s = await t.state();
    t.expect(
      s.screenName === 'Pillar Hall' && f.worstHero <= 1.05 && f.after < 1e-6 && f.off < 1e-6,
      `  the slide into the Pillar Hall keeps the hero in frame (${f.worstHero.toFixed(3)}) and lands clean`
    );
    await clearFoes(t);
    await t.step(0.2);
    await t.shot(`${vp.name}-dungeon-pillar-hall`);
  }
  await t.page.setViewportSize({ width: 1280, height: 720 });
  await t.page.waitForFunction(() => Math.abs(window.__voxelHeroes.camera.object.aspect - 1280 / 720) < 1e-3, null, { timeout: 10000 }).catch(() => {});
}
