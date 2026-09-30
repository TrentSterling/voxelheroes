// The camera rules at a wide and a phone-shaped viewport (1280 x 720 and
// 390 x 844), for the player's presets A-D and the fixed dungeon and
// interior cameras. The hero is checked by his model: every vertex of it
// (the sword and the flat contact shadow left out) projected through the
// camera (__voxelHeroes.camera.heroInFrame()), facing each of the four ways.
//   - all of the hero is in frame wherever he stands: over the whole
//     screen, and in its open edge tiles up to a hair short of the edge. At
//     an open south edge he goes on to the next screen as soon as any of him
//     would drop below the frame (the screen's south line), and all of him
//     stays in frame on every tick of that slide too;
//   - follow presets (A, D) take the whole area where the rules below say
//     "screen" (P0: they clamp to the area and change screen with no slide);
//     the interior rig follows the hero inside its room;
//   - the ground at the frame's bottom edge never lies past the screen's
//     south edge outdoors, and the screens south of the current one are
//     not drawn;
//   - on the hero's row the frame's sides stay inside the screen where the
//     frame is narrower than the screen (centred where it is wider), except
//     while he stands within a tile of that edge: then by what it takes to
//     show all of him, the side at most SIDE_ROOM tiles beyond his centre;
//   - walking into a slide, all of him stays in frame on every tick, the
//     camera moves without jumps and lands exactly where the follow rule
//     wants it, so nothing jumps after the slide;
//   - the fixed cameras hold the room centre at 16:9, moving less than a
//     tile only to keep all of him in frame (by a side wall, in a doorway),
//     and follow him across only where the frame is too narrow (the phone).
import { clearFoes } from '../lib/helpers.mjs';

export const description =
  'Camera presets A-D, the dungeon and the interior camera at 1280 x 720 and 390 x 844: all of the hero model in frame (anywhere on a screen, in its edge gaps and doorways, every tick of the slides), no screen to the south at the bottom edge, sides inside the screen, fixed cameras on the room centre, slides that land without a jump.';

const VIEWPORTS = [
  { name: 'wide', width: 1280, height: 720 },
  { name: 'phone', width: 390, height: 844 },
];
const PRESETS = ['A', 'B', 'C', 'D'];
const FACINGS = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 };
const APPROACH = { north: [8, 3], south: [8, 8], east: [13, 5.5], west: [3, 5.5] }; // test fields' gaps
const WHOLE = 1 + 1e-4; // NDC: all of him is in frame while every vertex is within this
// How far beyond the hero's centre the frame's side may reach past a screen
// edge he stands by: his outline (0.67 tile, core/camera.js HERO_OUTLINE)
// plus how much narrower the frame is at his height than on the ground.
const SIDE_ROOM = 1.1;

// Stand the hero on each spot (local x, z) of screen `key`, facing each of
// the four ways, run one tick so the camera follows, and check the frame.
// A spot at or past the screen's south line (in its open edge tiles) starts
// a slide or a fade: that is followed until play resumes, with all of him
// checked on every tick of a slide and on arrival. Spots on tiles with an
// onEnter hook (warps) are skipped. Returns the problems found (the first
// dozen), the spots with their camera subjects (local), and counts.
const checkSpots = (t, key, spots) =>
  t.eval(
    ([key, list, facings, WHOLE, SIDE_ROOM]) => {
      const g = window.__voxelHeroes;
      const fails = [];
      const fail = (m) => fails.length < 12 && fails.push(m);
      const cams = [];
      const out = { checked: 0, crossed: 0, worst: 0 };
      const look = (at) => {
        const m = g.camera.heroInFrame();
        out.worst = Math.max(out.worst, m.worst);
        if (m.worst > WHOLE) fail(`${at}: ${m.out} of ${m.total} hero vertices out of frame (${m.worst.toFixed(3)} past the ${m.side})`);
      };
      for (const [lx, lz] of list) {
        g.teleport(key, lx, lz);
        const s = g.screen();
        if (g.world.tileDefAt(s.x0 + Math.floor(lx), s.z0 + Math.floor(lz))?.onEnter) continue;
        const line = g.camera.rules.southLine();
        const lens = g.camera.lens();
        const fixed = !!lens.fixed;
        // Follow presets clamp to the area, not the screen (A, D outdoors);
        // in a room they keep the art bible's row clamp instead.
        const follow = !!lens.follow && !fixed;
        const b = follow && !s.area.rooms ? s.areaRect : s;
        const bw = b.x1 - b.x0;
        for (const [face, yaw] of Object.entries(facings)) {
          const at = `${s.name} ${lx},${lz} facing ${face}`;
          g.teleport(key, lx, lz, { yaw });
          for (const e of g.entities) if (e.kind === 'enemy' || e.kind === 'projectile') e.remove();
          // Neighbour screens are live now (streaming), so over ~1,700 spot checks their foes
          // can chip the hero down; this scenario checks framing, not survival.
          g.state.hp = g.state.maxHp;
          g.player.invT = 999; // neighbouring foes must not inject hit shake into framing probes
          g.update(1 / 60);
          if (g.screen() !== s || g.state.mode !== 'play') {
            if (lz < s.h - line - 1e-9) {
              fail(`${at}: left the screen or play (${g.state.mode}) short of the south line (${(s.h - line).toFixed(3)})`);
              continue;
            }
            out.crossed++;
            for (let i = 0; g.state.mode !== 'play' && i < 400; i++) {
              g.update(1 / 60);
              if (g.state.mode === 'scroll') look(`${at}, slide tick ${i + 1}`);
            }
            look(`${at}, arrived in ${g.screen().name}`);
            continue;
          }
          out.checked++;
          cams.push([lx, lz, +(g.camera.target.x - s.x0).toFixed(3), +(g.camera.target.z - s.z0).toFixed(3)]);
          look(at);
          // The bottom edge (a room's camera follows him down into its south doorway).
          if (follow && s.area.rooms) continue; // the room row clamp: checked by the room checks
          if (!(fixed && s.area.rooms && lz > s.h - 1))
            for (const nx of [-1, 0, 1]) {
              const q = g.camera.groundAt(nx, -1);
              if (!q || q.z > b.z1 + 1e-3) fail(`${at}: the bottom edge shows ${q ? `z ${(q.z - s.z0).toFixed(3)}` : 'sky'}`);
            }
          // The sides on the hero's row: how far past each screen edge they show.
          const [, row] = g.camera.project(g.player.x, g.camera.groundY ?? 0, g.player.z);
          const L = g.camera.groundAt(-1, row);
          const R = g.camera.groundAt(1, row);
          const past = { west: b.x0 - L.x, east: R.x - b.x1 };
          const by = { west: g.player.x - b.x0, east: b.x1 - g.player.x }; // how far he stands from each edge
          if (R.x - L.x >= bw) {
            if (!fixed && Math.abs(past.west - past.east) > 1e-3 && by.west > 1 && by.east > 1)
              fail(`${at}: the frame is wider than the screen but not centred (${past.west.toFixed(3)}, ${past.east.toFixed(3)})`);
          } else
            for (const side of ['west', 'east'])
              if (past[side] > (by[side] <= 1 ? Math.max(1e-3, SIDE_ROOM - by[side]) : 1e-3))
                fail(`${at}: the frame shows ${past[side].toFixed(3)} past the ${side} edge`);
        }
      }
      return { fails, cams, ...out };
    },
    [key, spots, FACINGS, WHOLE, SIDE_ROOM]
  );

// Spots in the open tiles along each edge of the current screen: at each of
// `depth[side]` tiles from that edge, and across the tile at `across`.
const edgeSpots = (t, depth, across = [0.5]) =>
  t.eval(
    ([depth, across]) => {
      const s = window.__voxelHeroes.screen();
      const open = (x, z) => window.__vhBot.walkable(x, z, false);
      const out = [];
      const add = (x, z) => out.push([+x.toFixed(2), +z.toFixed(2)]);
      for (const a of across) {
        for (let i = 0; i < s.w; i++) {
          if (open(i, 0)) for (const d of depth.north) add(i + a, d);
          if (open(i, s.h - 1)) for (const d of depth.south) add(i + a, s.h - d);
        }
        for (let j = 0; j < s.h; j++) {
          if (open(0, j)) for (const d of depth.west) add(d, j + a);
          if (open(s.w - 1, j)) for (const d of depth.east) add(s.w - d, j + a);
        }
      }
      return out;
    },
    [depth, across]
  );

// Walk off the current screen through `dir` with the stick from where the
// hero stands, and follow the slide until play resumes, then ten ticks of
// standing still. worst: all of him in NDC on every tick of the walk and the
// slide (1 is the frame's edge), and when it was; worstStep: the camera's
// largest move in one tick; after: its largest move once play resumed; off:
// how far it is from where the follow rule wants it.
const walkOff = (t, dir) =>
  t.eval((dir) => {
    const g = window.__voxelHeroes;
    const [ux, uz] = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[dir];
    const out = { walked: 0, ticks: 0, worst: 0, worstAt: '', worstStep: 0, after: 0, off: 0, started: '', mode: '', screen: '', changed: false, follow: false };
    const from = g.screen();
    const look = (at) => {
      const m = g.camera.heroInFrame().worst;
      if (m > out.worst) {
        out.worst = m;
        out.worstAt = at;
      }
    };
    let last = g.camera.target.clone();
    const moved = () => {
      out.worstStep = Math.max(out.worstStep, last.distanceTo(g.camera.target));
      last = g.camera.target.clone();
    };
    g.input.setStick(ux, uz);
    try {
      while (g.state.mode === 'play' && g.screen() === from && out.walked < 600) {
        g.update(1 / 60);
        out.walked++;
        look(`walking tick ${out.walked}`);
        moved();
      }
    } finally {
      g.input.setStick(0, 0);
    }
    out.started = g.state.mode;
    while (g.state.mode !== 'play' && out.ticks < 400) {
      g.update(1 / 60);
      out.ticks++;
      if (g.state.mode === 'scroll') look(`slide tick ${out.ticks}`);
      moved();
    }
    look('arrived');
    for (let i = 0; i < 10; i++) {
      g.update(1 / 60);
      out.after = Math.max(out.after, last.distanceTo(g.camera.target));
      last = g.camera.target.clone();
    }
    out.off = g.camera.expected().distanceTo(g.camera.target);
    out.mode = g.state.mode;
    out.screen = g.screen().name;
    out.changed = g.screen() !== from;
    out.follow = !!g.camera.lens().follow && !g.camera.lens().fixed && !g.screen().area.rooms;
    return out;
  }, dir);

// A hold preset (and every room) slides; a follow preset (A, D outdoors)
// changes screen in play, with no slide.
async function slide(t, dir, label, to = null) {
  const f = await walkOff(t, dir);
  t.expect(
    (f.follow ? f.started === 'play' && f.changed : f.started === 'scroll') && f.mode === 'play' && (!to || f.screen === to) && f.worst <= WHOLE && f.worstStep < 1.2 && f.after < 1e-6 && f.off < 1e-6,
    `  ${label} ${dir} to ${f.screen} (${f.follow ? 'follow change' : 'slide'}): all of the hero in frame on all ${f.walked + f.ticks} ticks (worst ${f.worst.toFixed(3)}, ${f.worstAt}), camera step at most ${f.worstStep.toFixed(3)}, lands clean`
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

const report = (t, label, res) =>
  t.expect(
    res.fails.length === 0,
    res.fails.length
      ? `${label}:\n       ${res.fails.join('\n       ')}`
      : `  ${label}: ${res.checked} hero spots x facings in frame, whole (worst ${res.worst.toFixed(3)}), ${res.crossed} went on past the south line`
  );

// The fixed camera of a room holds its centre: at 16:9 it moves under a
// tile, only near the walls; on the phone it follows the hero across. Both
// keep the room's depth unless he is in the south doorway.
function checkRoomCamera(t, vp, name, room, cams) {
  const [cx, cz] = [room.w / 2, room.h / 2];
  const depth = cams.filter(([, lz]) => lz <= room.h - 1.5);
  t.expect(depth.every(([, , , z]) => Math.abs(z - cz) < 1e-3), `  ${vp.name} ${name}: the camera keeps the room's depth (z ${cz}) unless the hero is in the south doorway`);
  const off = cams.filter(([, , x]) => Math.abs(x - cx) >= 1e-3);
  if (vp.name === 'wide') {
    const middle = cams.filter(([lx, lz]) => lx >= 3.5 && lx <= room.w - 3.5 && lz >= 2 && lz <= room.h - 2);
    t.expect(
      cams.every(([, , x]) => Math.abs(x - cx) < 1) && middle.every(([, , x, z]) => Math.abs(x - cx) < 1e-3 && Math.abs(z - cz) < 1e-3),
      `  at 16:9 it stays on the room centre for the middle spots and moves under a tile by the walls (${off.length} of ${cams.length} spots, at most ${Math.max(0, ...off.map(([, , x]) => Math.abs(x - cx))).toFixed(2)})`
    );
  } else t.expect(off.length > 0, `  on the phone it follows the hero across (${off.length} of ${cams.length} spots off centre)`);
}

export default async function cameraScenario(t) {
  await t.press('Enter');
  await t.step(1.1);
  const r = await t.eval(() => window.__voxelHeroes.player.r);
  const OUTDOOR = { north: [0.01, 0.35, 0.7], south: [0.01, 0.2, 0.4, 0.6, 0.8, 1], west: [0.01, 0.35, 0.7], east: [0.01, 0.35, 0.7] };
  const ROOM = { north: [0.01, 0.5, 1], south: [0.01, 0.5, 1], west: [0.01, 0.5, 1, 1.5], east: [0.01, 0.5, 1, 1.5] };

  // From Cairn Ridge in B (a hold preset) its own row of the overworld is
  // drawn, and nothing wholly south of it (the Crossroads row); in A (a
  // follow preset) the camera crosses screen lines, so the whole area is.
  // Either way nothing of another area. (The outdoors streams: the ring
  // around the hero is built over a few frames after a teleport, so the
  // check waits for it.)
  const drawnFrom = async (preset) => {
    await t.eval((n) => window.__voxelHeroes.camera.choose(n), preset);
    await t.teleport('overworld:1,0', 8, 5.5);
    return t.eval(async () => {
      for (let i = 0; i < 1200 && window.__voxelHeroes.world.pending.size; i++) await window.__voxelHeroes.tick();
      const g = window.__voxelHeroes;
      const s = g.screen();
      const keys = [...g.world.screens.keys()].filter((k) => g.transitions.shown(k)).sort();
      const area = [...g.world.screens.values()].filter((o) => o.area === s.area).map((o) => o.key);
      return { keys, south: keys.filter((k) => g.world.screen(k).z0 >= s.z1), all: area.every((k) => keys.includes(k)), others: keys.filter((k) => !area.includes(k)) };
    });
  };
  let drawn = await drawnFrom('B');
  t.expect(
    ['overworld:0,0', 'overworld:1,0', 'overworld:2,0'].every((k) => drawn.keys.includes(k)) && drawn.south.length === 0 && drawn.others.length === 0,
    `B: from Cairn Ridge its own row is drawn and nothing south of it (${drawn.keys.join(', ')})`
  );
  drawn = await drawnFrom('A');
  t.expect(drawn.all && drawn.others.length === 0, `A: from Cairn Ridge every screen of its area is drawn, and nothing else (${drawn.keys.join(', ')})`);

  for (const vp of VIEWPORTS) {
    await t.page.setViewportSize({ width: vp.width, height: vp.height });
    // The page sees the resize on its next frame.
    await t.page.waitForFunction((a) => Math.abs(window.__voxelHeroes.camera.object.aspect - a) < 1e-3, vp.width / vp.height, { timeout: 10000 }).catch(() => {});
    await t.step(0.1);
    const aspect = await t.eval(() => window.__voxelHeroes.camera.object.aspect);
    t.expect(Math.abs(aspect - vp.width / vp.height) < 1e-3, `${vp.width} x ${vp.height}: the camera aspect follows the window (${aspect.toFixed(3)})`);

    for (const preset of PRESETS) {
      await t.eval((n) => window.__voxelHeroes.camera.choose(n), preset);
      // Cairn Ridge has screens west, east and south of it; Hedge Crossing
      // has them on all four sides (two of them in other areas).
      await t.teleport('overworld:1,0', 8, 5.5);
      await clearFoes(t);
      const line = await t.eval(() => window.__voxelHeroes.camera.rules.southLine());
      t.expect((await t.state()).cam.preset === preset, `${vp.name} ${preset}: Cairn Ridge uses the chosen preset (south line ${line.toFixed(3)} tile in)`);
      report(t, `${vp.name} ${preset} Cairn Ridge`, await checkSpots(t, 'overworld:1,0', [...grid(16, 11, r), ...(await edgeSpots(t, OUTDOOR))]));
      await t.teleport('test-hedgerows:1,1', 8, 5.5);
      report(t, `${vp.name} ${preset} Hedge Crossing's gaps`, await checkSpots(t, 'test-hedgerows:1,1', await edgeSpots(t, OUTDOOR)));

      // Shots: the hero on the south line's near side in Cairn Ridge's south
      // gap, facing west (the widest he is), and in the east gap.
      await t.teleport('overworld:1,0', 8.5, 11 - line - 0.01, { yaw: -Math.PI / 2 });
      await clearFoes(t);
      await t.step(0.2);
      await t.shot(`${vp.name}-${preset}-south-edge`);
      await t.teleport('overworld:1,0', 15.99, 5.5, { yaw: Math.PI / 2 });
      await clearFoes(t);
      await t.step(0.2);
      await t.shot(`${vp.name}-${preset}-east-edge`);

      // Slides in all four directions round the Hedgerows.
      await t.teleport('test-hedgerows:0,0', 8, 5.5);
      for (const dir of ['east', 'south', 'west', 'north']) {
        await clearFoes(t);
        await t.walkTo(...APPROACH[dir]);
        await slide(t, dir, preset);
      }
    }

    // The dungeon camera in the crypt's 16 x 12 rooms, whatever the choice.
    await t.eval(() => window.__voxelHeroes.camera.choose('A'));
    await t.teleport('crypt:0,1', 8, 6);
    await clearFoes(t);
    let s = await t.state();
    t.expect(s.cam.preset === 'dungeon', `${vp.name}: the crypt fixes the dungeon camera over the player's A`);
    // The floor the hero can reach (side wall faces at 1.5 and 14.5, north
    // and south faces at 1 and 11), and every doorway.
    const floor = grid(14.5, 11, r, 1.5, 1);
    for (const key of ['crypt:0,1', 'crypt:1,1', 'crypt:0,0']) {
      const room = await t.teleport(key, 8, 6);
      const size = await t.eval(() => ({ w: window.__voxelHeroes.screen().w, h: window.__voxelHeroes.screen().h }));
      const doors = await edgeSpots(t, ROOM, [0.3, 0.5, 0.7]);
      const res = await checkSpots(t, key, [...(key === 'crypt:0,1' ? floor : []), ...doors]);
      report(t, `${vp.name} dungeon ${room.name} (floor${key === 'crypt:0,1' ? '' : ' left out'}, ${doors.length} doorway spots)`, res);
      checkRoomCamera(t, vp, room.name, size, res.cams);
    }
    // (Shots a little north of the south wall, which until the dungeon kit
    // lands is drawn full height and hides a hero right in front of it.)
    await t.teleport('crypt:0,1', 1.8, 9.5, { yaw: -Math.PI / 2 });
    await clearFoes(t);
    await t.step(0.2);
    await t.shot(`${vp.name}-dungeon-corner`);
    await t.teleport('crypt:0,1', 15.99, 6, { yaw: Math.PI / 2 });
    await clearFoes(t);
    await t.step(0.2);
    await t.shot(`${vp.name}-dungeon-east-doorway`);

    // Through the doors both ways, off the doorways' centre lines.
    await t.teleport('crypt:0,1', 8, 6);
    await clearFoes(t);
    await t.walkTo(13, 6.6);
    await slide(t, 'east', 'Sunken Gate', 'Pillar Hall');
    await clearFoes(t);
    await t.step(0.2);
    await t.shot(`${vp.name}-dungeon-pillar-hall`);
    await t.walkTo(3, 5.4);
    await slide(t, 'west', 'Pillar Hall', 'Sunken Gate');
    await clearFoes(t);
    await t.walkTo(7.4, 2.5);
    await slide(t, 'north', 'Sunken Gate', 'Key Vault');
    await clearFoes(t);
    await t.walkTo(8.6, 9.5);
    await slide(t, 'south', 'Key Vault', 'Sunken Gate');

    // The interior rig (art bible 1.8: 50.278, 38.54, 11.986) in the 12 x 9
    // Hedge Burrow: it follows the hero, clamped to the room by frame rows.
    await t.teleport('test-burrow:0,0', 6, 4.5);
    s = await t.state();
    const lens = await t.eval(() => window.__voxelHeroes.camera.lens().height);
    t.expect(s.cam.preset === 'interior' && Math.abs(lens - 11.986) < 1e-6, `${vp.name}: the Burrow uses the interior camera, ${lens.toFixed(3)} high`);
    const res = await checkSpots(t, 'test-burrow:0,0', grid(10.5, 8, r, 1.5, 1));
    report(t, `${vp.name} interior Burrow`, res);
    t.expect(res.cams.every(([, , x, z]) => x >= 0 && x <= 12 && z >= 0 && z <= 9), `  ${vp.name} Burrow: the camera's subject stays inside the room on every spot`);
    await t.teleport('test-burrow:0,0', 1.8, 6.5, { yaw: -Math.PI / 2 });
    await clearFoes(t);
    await t.step(0.2);
    await t.shot(`${vp.name}-interior-corner`);
  }
  await t.page.setViewportSize({ width: 1280, height: 720 });
  await t.page.waitForFunction(() => Math.abs(window.__voxelHeroes.camera.object.aspect - 1280 / 720) < 1e-3, null, { timeout: 10000 }).catch(() => {});
}
