// Travel between areas on the test hedgerows (src/world/areas/test-borders.js):
// Hedgerows (2 x 2 screens) with Far Hedges east of it and Low Fields south
// of it. Walking between screens of one area slides; walking across into
// another area fades to black, fires 'area-enter', holds the black for the
// loading card and fades in. Every crossing is walked with the arrow keys and
// checked for its events, timing and where the hero lands.
export const description = "Walking between areas: slides inside an area in all four directions, fades with 'area-enter' and the loading-card hold into another area in all four directions, landing spots and edge links.";

const near = (a, b, eps = 0.02) => Math.abs(a - b) <= eps;
const TICK = 1 / 60;

const KEYS = { north: 'ArrowUp', south: 'ArrowDown', east: 'ArrowRight', west: 'ArrowLeft' };
// Start points on the centre line of each gap in the tree border (columns
// 6-9 on the north and south edges, rows 4-6 on the east and west edges).
const APPROACH = { north: [8, 3], south: [8, 8], east: [13, 5.5], west: [3, 5.5] };

async function pushUntilMoving(t, key) {
  await t.page.keyboard.down(key);
  try {
    await t.waitFor((s) => s.mode !== 'play', { seconds: 4 });
  } finally {
    await t.page.keyboard.up(key);
  }
}

// Walk off the current screen through `dir` into screen `to` (a name) of area
// `area` (a name). kind: 'slide' or 'fade'.
async function cross(t, tr, dir, to, area, kind, { shot } = {}) {
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

export default async function areasScenario(t) {
  await t.track('room-enter', 'area-enter', 'screen-leave');
  const tr = await t.eval(() => ({ ...window.__voxelHeroes.transitions, shown: undefined }));
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

  // ---------------------------------------------------------------- slides inside Hedgerows
  const start = await t.teleport('test-hedgerows');
  t.expect(start.name === 'Hedge Corner', 'teleport to the Hedgerows starts in Hedge Corner');
  await t.step(0.3);
  await t.shot('01-hedge-corner');
  await cross(t, tr, 'east', 'Hedge Gate', 'Hedgerows', 'slide');
  await cross(t, tr, 'south', 'Hedge Crossing', 'Hedgerows', 'slide');
  await cross(t, tr, 'west', 'Hedge Hollow', 'Hedgerows', 'slide');
  await cross(t, tr, 'north', 'Hedge Corner', 'Hedgerows', 'slide');

  // ---------------------------------------------------------------- into other areas, all four ways
  await cross(t, tr, 'east', 'Hedge Gate', 'Hedgerows', 'slide');
  await cross(t, tr, 'east', 'Far Hedge North', 'Far Hedges', 'fade', { shot: '02-far-hedge-north' });
  await cross(t, tr, 'south', 'Far Hedge South', 'Far Hedges', 'slide');
  await cross(t, tr, 'west', 'Hedge Crossing', 'Hedgerows', 'fade', { shot: '03-hedge-crossing' });
  await cross(t, tr, 'south', 'Low Field East', 'Low Fields', 'fade', { shot: '04-low-field-east' });
  await cross(t, tr, 'west', 'Low Field West', 'Low Fields', 'slide');
  await cross(t, tr, 'north', 'Hedge Hollow', 'Hedgerows', 'fade', { shot: '05-hedge-hollow' });

  // Halfway through a fade into another area the screen is black and the
  // hero is already on the other side.
  await t.walkTo(...APPROACH.south);
  await pushUntilMoving(t, KEYS.south);
  await t.step(tr.FADE_OUT + tr.AREA_HOLD / 2);
  const mid = await t.state();
  const fade = await t.eval(() => Number(document.getElementById('fade').style.opacity));
  t.expect(mid.mode === 'warp' && mid.screenName === 'Low Field West' && fade === 1, 'during the loading-card hold the screen is black and the hero is already in Low Field West');
  await t.shot('06-loading-hold');
  await t.waitFor((s) => s.mode === 'play', { seconds: 3 });

  const areas = (await t.events('area-enter')).map((e) => `${e.from} > ${e.area}`);
  t.note(`areas entered: ${areas.join(', ')}`);
}
