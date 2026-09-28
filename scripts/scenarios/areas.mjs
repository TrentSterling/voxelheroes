// Travel between areas on the test hedgerows (src/world/areas/test-borders.js):
// Hedgerows (2 x 2 screens) with Far Hedges east of it and Low Fields south
// of it. Walking between screens of one area changes screen: in the default
// camera A, which follows the hero, with no slide once he is 0.5 tile past
// the edge (a hold preset, B or C, slides; see p0.mjs); walking across into
// another area fades to black, fires 'area-enter', holds the black for the
// loading card and fades in. Every crossing is walked with the arrow keys and
// checked for its events, timing and where the hero lands. A cave door leads
// into Hedge Burrow, a 12 x 9 room placed by tile, and its stairs lead out;
// a tunnel warps between two screens of one area without a loading card.
import { pushUntilMoving } from '../lib/helpers.mjs';

export const description = "Walking between areas: slides inside an area in all four directions, fades with 'area-enter' and the loading-card hold into another area in all four directions, landing spots and edge links, a door into a 12 x 9 interior and out, and a warp inside one area.";

const near = (a, b, eps = 0.02) => Math.abs(a - b) <= eps;
const TICK = 1 / 60;

const KEYS = { north: 'ArrowUp', south: 'ArrowDown', east: 'ArrowRight', west: 'ArrowLeft' };
// Start points on the centre line of each gap in the tree border (columns
// 6-9 on the north and south edges, rows 4-6 on the east and west edges).
const APPROACH = { north: [8, 3], south: [8, 8], east: [13, 5.5], west: [3, 5.5] };

// Walk off the current screen through `dir` into screen `to` (a name) of area
// `area` (a name). kind: 'slide' (inside one area: a follow change in camera
// A) or 'fade'.
async function cross(t, tr, dir, to, area, kind, { shot } = {}) {
  if (kind === 'slide' && (await t.eval(() => !!window.__voxelHeroes.camera.lens().follow))) return follow(t, tr, dir, to, area, { shot });
  const before = await t.state();
  const fromName = await t.eval((id) => window.__voxelHeroes.world.areas.get(id).name, before.area);
  const areaEvents = (await t.events('area-enter')).length;
  await t.walkTo(...APPROACH[dir]);
  const [ax, az] = APPROACH[dir];
  await pushUntilMoving(t, KEYS[dir]);
  const started = await t.state();
  t.expect(started.mode === (kind === 'slide' ? 'scroll' : 'warp'), `${before.screenName} ${dir}: ${kind === 'slide' ? 'a slide' : 'a fade'} starts (${started.mode})`);
  await t.waitFor((s) => s.mode === 'play', { seconds: 4 });
  const s = await t.state();
  t.expect(s.screenName === to, `  into ${to}`);

  const enter = (await t.events('room-enter')).at(-1);
  const areas = await t.events('area-enter');
  const via = kind === 'slide' ? 'slide' : 'edge';
  t.expect(enter.screen === to && enter.area === area && enter.via === via, `  'room-enter' { ${area}, ${to}, via ${via} }`);
  if (kind === 'slide') {
    const leave = (await t.events('screen-leave')).at(-1);
    t.expect(areas.length === areaEvents, "  no 'area-enter' inside one area");
    t.expect(Math.abs(enter.time - leave.time - tr.SLIDE_TIME) <= 2 * TICK, `  the slide takes ${(enter.time - leave.time).toFixed(3)} s`);
  } else {
    const a = areas.at(-1);
    t.expect(areas.length === areaEvents + 1 && a.area === area && a.from === fromName && a.via === 'edge', `  'area-enter' { ${area}, from ${fromName}, via edge }`);
    const black = a.time - started.time;
    const hold = enter.time - a.time - tr.FADE_IN;
    t.expect(Math.abs(black - tr.FADE_OUT) <= 2 * TICK, `  it fires when the screen is black, ${black.toFixed(3)} s in`);
    t.expect(Math.abs(hold - tr.AREA_HOLD) <= 2 * TICK, `  the black holds ${hold.toFixed(3)} s for the loading card, then fades in`);
  }
  // SLIDE_STEP tiles in from the edge, level with where the hero walked out.
  const step = tr.SLIDE_STEP;
  const land = { north: [ax, s.size[1] - step], south: [ax, step], east: [step, az], west: [s.size[0] - step, az] }[dir];
  t.expect(near(s.lx, land[0]) && near(s.lz, land[1]), `  the hero lands at ${s.lx}, ${s.lz} (expected ${land.join(', ')})`);
  const view = await t.eval(() => {
    const g = window.__voxelHeroes;
    const p = g.player;
    const [nx, ny] = g.camera.project(p.x, 0, p.z);
    const e = g.camera.expected();
    return { inFrame: Math.abs(nx) < 1 && Math.abs(ny) < 1, off: e.distanceTo(g.camera.target) };
  });
  t.expect(view.inFrame && view.off < 1e-6, '  the hero is in frame and the camera already follows him');
  if (shot) {
    await t.step(0.3);
    await t.shot(shot);
  }
}

// Walk over a screen line inside one area with a follow camera: the change
// fires in play, no slide and no 'area-enter', with the hero's centre
// followDeadband (0.5) tiles past the edge; the camera follows him through.
async function follow(t, tr, dir, to, area, { shot } = {}) {
  const areaEvents = (await t.events('area-enter')).length;
  await t.walkTo(...APPROACH[dir]);
  const [ax, az] = APPROACH[dir];
  const modes = new Set();
  await t.page.keyboard.down(KEYS[dir]);
  try {
    for (let i = 0; i < 240; i++) {
      await t.step(TICK);
      const st = await t.state();
      modes.add(st.mode);
      if (st.screenName === to) break;
    }
  } finally {
    await t.page.keyboard.up(KEYS[dir]);
  }
  const s = await t.state();
  const enter = (await t.events('room-enter')).at(-1);
  t.expect(s.screenName === to && enter.screen === to && enter.area === area && enter.via === 'follow' && [...modes].every((m) => m === 'play'), `follow change ${dir} into ${to}: 'room-enter' via follow, no slide (modes ${[...modes].join(', ')})`);
  t.expect((await t.events('area-enter')).length === areaEvents, "  no 'area-enter' inside one area");
  const band = 0.5;
  const pos = { north: [ax, s.size[1] - band, 1], south: [ax, band, 1], east: [band, az, 0], west: [s.size[0] - band, az, 0] }[dir];
  const along = pos[2] ? s.lz : s.lx;
  const want = pos[2] ? pos[1] : pos[0];
  t.expect(Math.abs(along - want) <= 0.1, `  the hero's centre is ${Math.abs(along - want).toFixed(3)} from 0.5 tile past the edge when it fires`);
  const off = await t.eval(() => window.__voxelHeroes.camera.expected().distanceTo(window.__voxelHeroes.camera.target));
  t.expect(off < 1e-6, '  the camera follows him through');
  if (shot) {
    await t.step(0.3);
    await t.shot(shot);
  }
}

// Walk into the warp tile ahead with `key` and check the fade into another
// area: 'warp', then 'area-enter' at black, the loading-card hold, then
// 'room-enter' once the fade is done. Returns the snapshot on arrival.
async function takeWarp(t, tr, key, to, area, fromName) {
  await pushUntilMoving(t, key);
  const started = await t.state();
  t.expect(started.mode === 'warp', `${started.screenName}: ${key === 'ArrowUp' ? 'the door starts' : 'the stairs start'} a fade`);
  await t.waitFor((s) => s.mode === 'play', { seconds: 4 });
  const s = await t.state();
  const warp = (await t.events('warp')).at(-1);
  const a = (await t.events('area-enter')).at(-1);
  const enter = (await t.events('room-enter')).at(-1);
  t.expect(s.screenName === to && s.area === area.id, `  into ${to} (${area.name})`);
  t.expect(a.area === area.name && a.from === fromName && a.via === 'warp', `  'area-enter' { ${area.name}, from ${fromName}, via warp }`);
  t.expect(Math.abs(a.time - warp.time - tr.FADE_OUT) <= 2 * TICK, `  it fires at black, ${(a.time - warp.time).toFixed(3)} s in`);
  const hold = enter.time - a.time - tr.FADE_IN;
  t.expect(Math.abs(hold - tr.AREA_HOLD) <= 2 * TICK && enter.screen === to && enter.via === 'warp', `  ${hold.toFixed(3)} s of black for the loading card, then 'room-enter' { ${to}, via warp }`);
  return s;
}

export default async function areasScenario(t) {
  await t.track('room-enter', 'area-enter', 'screen-leave', 'warp');
  const tr = await t.eval(() => ({ ...window.__voxelHeroes.transitions, shown: undefined, shownRect: undefined }));
  await t.press('Enter');
  await t.step(1.1);

  // ---------------------------------------------------------------- the links
  const report = await t.eval(() => window.__voxelHeroes.links());
  const links = report.links.filter((l) => l.from.startsWith('test-')).map((l) => `${l.from} ${l.dir} ${l.to} x${l.crossings}`);
  const expected = [
    'test-hedgerows:1,0 east test-far-hedges:0,0 x3',
    'test-hedgerows:1,1 east test-far-hedges:0,1 x3',
    'test-far-hedges:0,0 west test-hedgerows:1,0 x3',
    'test-far-hedges:0,1 west test-hedgerows:1,1 x3',
    'test-hedgerows:0,1 south test-low-fields:0,0 x4',
    'test-hedgerows:1,1 south test-low-fields:1,0 x4',
    'test-low-fields:0,0 north test-hedgerows:0,1 x4',
    'test-low-fields:1,0 north test-hedgerows:1,1 x4',
  ];
  t.expect(
    links.length === expected.length && expected.every((l) => links.includes(l)),
    `the edge report finds the 8 places where the test areas touch and their open tiles:\n       ${links.join('\n       ')}`
  );
  t.expect(report.mismatches.length === 0, 'no edge is open on one side and a wall on the other');

  // ---------------------------------------------------------------- Hedge Corner
  const start = await t.teleport('test-hedgerows');
  t.expect(start.name === 'Hedge Corner', 'teleport to the Hedgerows starts in Hedge Corner');
  await t.step(0.3);
  await t.shot('01-hedge-corner');

  // ---------------------------------------------------------------- a house of another size
  // Hedge Burrow is one room of 12 x 9 tiles, placed by tile (`at`).
  await t.walkTo(8.5, 2.7);
  let s = await takeWarp(t, tr, 'ArrowUp', 'Burrow', { id: 'test-burrow', name: 'Hedge Burrow' }, 'Hedgerows');
  const burrow = await t.eval(() => {
    const g = window.__voxelHeroes;
    const scr = g.screen();
    const p = g.player;
    const feet = g.camera.project(p.x, 0, p.z);
    const head = g.camera.project(p.x, 1.2, p.z);
    return {
      x0: scr.x0,
      z0: scr.z0,
      shown: [...g.world.screens.keys()].filter((k) => g.transitions.shown(k)),
      inFrame: [feet, head].every(([x, y]) => Math.abs(x) < 0.95 && Math.abs(y) < 0.95),
      blocked: g.world.blocked(p.x, p.z, p.r, p),
      want: g.camera.expected().z - scr.z0,
    };
  });
  t.expect(s.size.join() === '12,9' && burrow.x0 === 476 * 16 && burrow.z0 === 0, `  a 12 x 9 room with its corner at tile ${burrow.x0}, ${burrow.z0} (at: [476 * 16, 0])`);
  t.expect(near(s.lx, 6) && near(s.lz, 7.4) && !burrow.blocked, `  the hero stands at ${s.lx}, ${s.lz}, clear of the walls`);
  // The interior rig follows the hero clamped by frame rows (art bible 1.8,
  // section 9); a room smaller than the view is centred between its walls.
  t.expect(s.cam.preset === 'interior' && near(s.cam.x, 6) && near(s.cam.z, burrow.want, 0.01) && s.cam.z > 4 && s.cam.z < 5.5, `  the interior camera centres on the room between its walls (${s.cam.x}, ${s.cam.z})`);
  t.expect(burrow.inFrame && burrow.shown.join() === 'test-burrow:0,0', `  the hero is in frame and only the Burrow is drawn (${burrow.shown.join(', ')})`);
  await t.step(0.3);
  await t.shot('02-burrow');
  s = await takeWarp(t, tr, 'ArrowDown', 'Hedge Corner', { id: 'test-hedgerows', name: 'Hedgerows' }, 'Hedge Burrow');
  t.expect(near(s.lx, 8.5) && near(s.lz, 2.7), `  back out below the cave door, at ${s.lx}, ${s.lz}`);

  // ---------------------------------------------------------------- slides inside Hedgerows
  await cross(t, tr, 'east', 'Hedge Gate', 'Hedgerows', 'slide');
  await cross(t, tr, 'south', 'Hedge Crossing', 'Hedgerows', 'slide');
  await cross(t, tr, 'west', 'Hedge Hollow', 'Hedgerows', 'slide');

  // A tunnel from Hedge Hollow to Hedge Crossing, a warp inside one area:
  // it fades out and back in (WARP_FADE each) with no card and no 'area-enter'.
  const areasBefore = (await t.events('area-enter')).length;
  const warpsBefore = (await t.events('warp')).length;
  await t.walkTo(3.5, 5.7);
  const through = await t.enter(3.5, 4.5); // the bot walks onto the tunnel and waits out the warp
  t.expect(through.moved && through.screen === 'test-hedgerows:1,1' && (await t.events('warp')).length === warpsBefore + 1, 'Hedge Hollow: the tunnel warps (bot enter())');
  s = await t.state();
  const tunnel = (await t.events('warp')).at(-1);
  const out = (await t.events('room-enter')).at(-1);
  const blink = out.time - tunnel.time;
  t.expect(s.screenName === 'Hedge Crossing' && near(s.lx, 8) && near(s.lz, 5.5), `  out in Hedge Crossing at ${s.lx}, ${s.lz}`);
  t.expect((await t.events('area-enter')).length === areasBefore && out.via === 'warp', "  no 'area-enter' (no loading card) inside one area; 'room-enter' via warp");
  t.expect(Math.abs(blink - (2 * tr.WARP_FADE + tr.WARP_HOLD)) <= 2 * TICK, `  the blink takes ${blink.toFixed(3)} s (WARP_FADE ${tr.WARP_FADE} out and in)`);
  await cross(t, tr, 'west', 'Hedge Hollow', 'Hedgerows', 'slide');
  await cross(t, tr, 'north', 'Hedge Corner', 'Hedgerows', 'slide');

  // ---------------------------------------------------------------- into other areas, all four ways
  await cross(t, tr, 'east', 'Hedge Gate', 'Hedgerows', 'slide');
  await cross(t, tr, 'east', 'Far Hedge North', 'Far Hedges', 'fade', { shot: '03-far-hedge-north' });
  await cross(t, tr, 'south', 'Far Hedge South', 'Far Hedges', 'slide');
  await cross(t, tr, 'west', 'Hedge Crossing', 'Hedgerows', 'fade', { shot: '04-hedge-crossing' });
  await cross(t, tr, 'south', 'Low Field East', 'Low Fields', 'fade', { shot: '05-low-field-east' });
  await cross(t, tr, 'west', 'Low Field West', 'Low Fields', 'slide');
  await cross(t, tr, 'north', 'Hedge Hollow', 'Hedgerows', 'fade', { shot: '06-hedge-hollow' });

  // Halfway through a fade into another area the screen is black and the
  // hero is already on the other side.
  await t.walkTo(...APPROACH.south);
  await pushUntilMoving(t, KEYS.south);
  await t.step(tr.FADE_OUT + tr.AREA_HOLD / 2);
  const mid = await t.state();
  const fade = await t.eval(() => Number(document.getElementById('fade').style.opacity));
  t.expect(mid.mode === 'warp' && mid.screenName === 'Low Field West' && fade === 1, 'during the loading-card hold the screen is black and the hero is already in Low Field West');
  await t.shot('07-loading-hold');
  await t.waitFor((s) => s.mode === 'play', { seconds: 3 });

  const areas = (await t.events('area-enter')).map((e) => `${e.from} > ${e.area}`);
  t.note(`areas entered: ${areas.join(', ')}`);
}
