// Cairn Crypt door by door: in through the doorway on Cairn Ridge, through
// every door between its 16 x 12 rooms in both directions (walking with the
// arrow keys), and out by the stairs. At every arrival it checks the slide,
// the 'room-enter' event, where the hero stands (inside the room, clear of
// the doorway), the dungeon camera on the room's floor centre, the hero in
// frame, and that only the current room is drawn. On the way: Escape during
// a slide, a save and load in a room, and falling in the crypt, which puts
// the hero back on his feet at its entrance.
import { clearFoes, pushUntilMoving } from '../lib/helpers.mjs';

export const description = "Every door of Cairn Crypt both ways: slides, 'room-enter', landing spots, the dungeon camera on each room centre; in by the doorway and out by the stairs ('area-enter'); pause during a slide, save and load in a room, falling and getting up at the entrance.";

const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;
const TICK = 1 / 60;

const KEYS = { north: 'ArrowUp', south: 'ArrowDown', east: 'ArrowRight', west: 'ArrowLeft' };
// Where to start walking toward each door of a room: on the door's centre
// line (doors are columns 7-8 or rows 5-6), a few tiles in.
const APPROACH = { north: [8, 2.5], south: [8, 9.5], east: [13, 6], west: [3, 6] };
const ROOMS = ['crypt:0,0', 'crypt:1,0', 'crypt:0,1', 'crypt:1,1'];

// Everything about the hero having arrived in a room, as one object.
// shown: the crypt rooms drawn; drawn: every screen drawn, of any area.
const arrival = (t) =>
  t.eval((rooms) => {
    const g = window.__voxelHeroes;
    const s = g.screen();
    const p = g.player;
    const feet = g.camera.project(p.x, 0, p.z);
    const head = g.camera.project(p.x, 1.2, p.z);
    return {
      blocked: g.world.blocked(p.x, p.z, p.r, p),
      r: p.r,
      inFrame: [feet, head].every(([x, y]) => Math.abs(x) < 0.95 && Math.abs(y) < 0.95),
      shown: rooms.filter((k) => g.transitions.shown(k)),
      drawn: [...g.world.screens.keys()].filter((k) => g.transitions.shown(k)),
      rect: Object.values(g.transitions.shownRect() ?? {}).join(), // x0, z0, x1, z1 of what is drawn
      own: [s.x0, s.z0, s.x1, s.z1].join(),
      w: s.w,
      h: s.h,
    };
  }, ROOMS);

// Walk through the door on `dir` of the current room into `to`, and check the
// arrival. land: the expected local spot [x, z] in the new room.
async function throughDoor(t, dir, to, land, { shot, midway = null } = {}) {
  const before = await t.state();
  await clearFoes(t);
  await t.walkTo(...APPROACH[dir]);
  await pushUntilMoving(t, KEYS[dir]);
  let s = await t.state();
  t.expect(s.mode === 'scroll', `${before.screenName} ${dir}: walking into the door gap starts a slide`);
  if (midway) await midway();
  await t.waitFor((st) => st.mode === 'play', { seconds: 3 });
  s = await t.state();
  t.expect(s.screenName === to && s.area === 'crypt', `${before.screenName} ${dir} to ${to}`);

  const leave = (await t.events('screen-leave')).at(-1);
  const enter = (await t.events('room-enter')).at(-1);
  const took = enter.time - leave.time;
  t.expect(enter.screen === to && enter.area === 'Cairn Crypt' && enter.via === 'slide', `  'room-enter' { Cairn Crypt, ${to}, via slide }`);
  t.expect(Math.abs(took - SLIDE_TIME) <= 2 * TICK, `  the slide takes ${took.toFixed(3)} s (SLIDE_TIME ${SLIDE_TIME})`);

  const a = await arrival(t);
  t.expect(near(s.lx, land[0], 0.02) && near(s.lz, land[1], 0.02), `  the hero lands at ${s.lx}, ${s.lz} (expected ${land.join(', ')})`);
  t.expect(
    s.lx - a.r >= 1.5 && s.lx + a.r <= a.w - 1.5 && s.lz - a.r >= 1 && s.lz + a.r <= a.h - 1 && !a.blocked,
    '  inside the room, clear of the walls and the doorway'
  );
  t.expect(s.cam.preset === 'dungeon' && near(s.cam.x, 8) && near(s.cam.z, 6), `  the camera is on the room centre (${s.cam.x}, ${s.cam.z})`);
  t.expect(a.inFrame, '  the hero is in frame');
  t.expect(a.shown.length === 1 && a.shown[0] === s.key, `  only ${to} is drawn (${a.shown.join(', ')})`);
  t.expect(a.rect === a.own, `  shownRect() (the look's room rect) is the room: ${a.rect}`);
  if (shot) {
    await t.step(0.3);
    await t.shot(shot);
  }
}

let SLIDE_TIME = 0.5;

export default async function rooms(t) {
  await t.track('room-enter', 'area-enter', 'screen-leave', 'warp', 'door-opened');
  const tr = await t.eval(() => ({ ...window.__voxelHeroes.transitions, shown: undefined, shownRect: undefined }));
  SLIDE_TIME = tr.SLIDE_TIME;
  const wall = { ns: 1 + tr.ROOM_STEP, ew: 1.5 + tr.ROOM_STEP }; // landing distance from the edge
  let s;
  let a;

  await t.press('Enter');
  await t.step(1.1);

  // ---------------------------------------------------------------- in by the doorway
  await t.teleport('overworld:1,0', 8.5, 3.5, { yaw: Math.PI });
  await clearFoes(t);
  await t.walkTo(8.5, 2.5);
  await pushUntilMoving(t, 'ArrowUp');
  s = await t.state();
  t.expect(s.mode === 'warp', 'walking into the doorway on Cairn Ridge starts a fade');
  await t.waitFor((st) => st.mode === 'play', { seconds: 3 });
  s = await t.state();
  t.expect(s.screenName === 'Sunken Gate' && near(s.lx, 8) && near(s.lz, 10.4), `down into the Sunken Gate, at ${s.lx}, ${s.lz}`);
  const warp = (await t.events('warp')).at(-1);
  const inArea = (await t.events('area-enter')).at(-1);
  let enter = (await t.events('room-enter')).at(-1);
  t.expect(inArea.area === 'Cairn Crypt' && inArea.from === 'Overworld' && inArea.via === 'warp', "'area-enter' { Cairn Crypt, from Overworld, via warp }");
  t.expect(Math.abs(inArea.time - warp.time - tr.FADE_OUT) <= 2 * TICK, `  it fires at black, ${(inArea.time - warp.time).toFixed(3)} s after the warp starts (FADE_OUT ${tr.FADE_OUT})`);
  t.expect(
    Math.abs(enter.time - inArea.time - (tr.AREA_HOLD + tr.FADE_IN)) <= 2 * TICK,
    `  the loading card has ${(enter.time - inArea.time - tr.FADE_IN).toFixed(3)} s of black (AREA_HOLD ${tr.AREA_HOLD}), then the fade in`
  );
  t.expect(enter.screen === 'Sunken Gate' && enter.via === 'warp', "  'room-enter' { Sunken Gate, via warp } once the fade is done");
  a = await arrival(t);
  t.expect(s.cam.preset === 'dungeon' && near(s.cam.x, 8) && near(s.cam.z, 6) && a.inFrame && !a.blocked, '  dungeon camera on the room centre, the hero in frame');
  t.expect(a.shown.length === 1 && a.shown[0] === 'crypt:0,1', '  only the Sunken Gate is drawn');
  await t.step(0.3);
  await t.shot('01-sunken-gate-from-the-doorway');

  // ---------------------------------------------------------------- every door both ways
  await throughDoor(t, 'north', 'Key Vault', [8, 12 - wall.ns], { shot: '02-key-vault-from-the-south' });
  await throughDoor(t, 'south', 'Sunken Gate', [8, wall.ns], {
    shot: '03-sunken-gate-from-the-north',
    // Input is ignored during a slide (gameplay spec 4.3), Start included.
    midway: async () => {
      await t.press('Escape');
      const m = await t.state();
      t.expect(m.mode === 'scroll' && !m.overlay, '  Escape during the slide is ignored: the slide goes on');
    },
  });
  await t.press('Escape');
  s = await t.state();
  t.expect(s.mode === 'paused' && s.overlay, 'in the room, Escape pauses');
  await t.press('Escape');
  t.expect((await t.state()).mode === 'play', '  and Escape resumes');
  await throughDoor(t, 'east', 'Pillar Hall', [wall.ew, 6], {
    shot: '05-pillar-hall-from-the-west',
    midway: async () => {
      await t.step(SLIDE_TIME / 2);
      const m = await t.state();
      const both = await t.eval((rooms) => rooms.filter((k) => window.__voxelHeroes.transitions.shown(k)), ROOMS);
      t.expect(m.mode === 'scroll' && both.join() === 'crypt:0,1,crypt:1,1', `  halfway through the slide both rooms are drawn (${both.join(', ')})`);
      const rects = await t.eval(() => {
        const g = window.__voxelHeroes;
        const [a, b] = [g.world.screen('crypt:0,1'), g.world.screen('crypt:1,1')];
        const want = [Math.min(a.x0, b.x0), Math.min(a.z0, b.z0), Math.max(a.x1, b.x1), Math.max(a.z1, b.z1)];
        return { got: Object.values(g.transitions.shownRect()).join(), want: want.join() };
      });
      t.expect(rects.got === rects.want, `  and shownRect() covers both (${rects.got})`);
      const camX = await t.eval(() => window.__voxelHeroes.camera.target.x - window.__voxelHeroes.world.screen('crypt:0,1').x0);
      t.expect(camX > 8 + 4 && camX < 8 + 12, `  and the camera is between the room centres (${camX.toFixed(2)} of 8 to 24)`);
      await t.shot('04-mid-slide');
    },
  });

  // ---------------------------------------------------------------- save and load in a room
  // (the M1 rule: a load resumes where the save was made; the gameplay spec's
  // section 11 moves a load made in a dungeon to its entrance)
  const here = await t.state();
  const saved = JSON.parse(JSON.stringify(await t.save()));
  await t.teleport('Mirror Lake');
  await t.load(saved);
  await t.step(0.1);
  s = await t.state();
  a = await arrival(t);
  const loaded = (await t.events('room-enter')).at(-1);
  t.expect(
    s.screenName === 'Pillar Hall' && near(s.lx, here.lx) && near(s.lz, here.lz) && loaded.via === 'load',
    `a save made in the Pillar Hall loads back at ${s.lx}, ${s.lz} ('room-enter' via load)`
  );
  t.expect(
    s.cam.preset === 'dungeon' && near(s.cam.x, 8) && near(s.cam.z, 6) && a.inFrame && a.drawn.join() === 'crypt:1,1',
    `  the dungeon camera on the room centre, the hero in frame, only the Pillar Hall drawn (${a.drawn.join(', ')})`
  );

  await t.give('key');
  s = await t.state();
  t.expect(s.keysByGroup.crypt >= 1, 'a crypt key for the locked door');
  await throughDoor(t, 'north', 'Treasure Chamber', [8, 12 - wall.ns], { shot: '06-treasure-chamber-from-the-south' });
  t.expect((await t.events('door-opened')).length === 1, '  the locked door opened on the way (the key is spent)');
  await throughDoor(t, 'south', 'Pillar Hall', [8, wall.ns], { shot: '07-pillar-hall-from-the-north' });
  await throughDoor(t, 'west', 'Sunken Gate', [16 - wall.ew, 6], { shot: '08-sunken-gate-from-the-east' });

  // ---------------------------------------------------------------- out by the stairs
  await clearFoes(t);
  await t.walkTo(8, 9.5);
  await pushUntilMoving(t, 'ArrowDown');
  s = await t.state();
  t.expect(s.mode === 'warp', 'the stairs in the south doorway start a fade');
  await t.waitFor((st) => st.mode === 'play', { seconds: 3 });
  s = await t.state();
  t.expect(s.screenName === 'Cairn Ridge' && near(s.lx, 8) && near(s.lz, 1.7), `up the stairs to the doorway on Cairn Ridge, at ${s.lx}, ${s.lz}`);
  const outArea = (await t.events('area-enter')).at(-1);
  enter = (await t.events('room-enter')).at(-1);
  t.expect(outArea.area === 'Overworld' && outArea.from === 'Cairn Crypt' && outArea.via === 'warp', "'area-enter' { Overworld, from Cairn Crypt, via warp }");
  t.expect(enter.screen === 'Cairn Ridge' && enter.via === 'warp', "  'room-enter' { Cairn Ridge, via warp }");
  t.expect(s.cam.preset === (await t.eval(() => window.__voxelHeroes.state.settings.camera)), `  the camera is back on the player's choice (${s.cam.preset})`);
  a = await arrival(t);
  t.expect(a.inFrame && a.shown.length === 0, '  the hero is in frame and no crypt room is drawn');
  await t.step(0.3);
  await t.shot('09-back-on-cairn-ridge');

  // ---------------------------------------------------------------- falling in the crypt
  // Falling in a dungeon puts the hero back on his feet at its entrance
  // (the crypt's `entrance`, gameplay spec 6.7), not at the respawn point.
  await t.teleport('crypt:1,1', 8, 6);
  const areasBefore = (await t.events('area-enter')).length;
  await t.setHp(0);
  await t.step(1.5);
  s = await t.state();
  const msg = await t.eval(() => document.getElementById('overlay-msg').textContent);
  t.expect(s.mode === 'dead' && s.overlay && msg.includes('Sunken Gate'), `falling in the Pillar Hall: the game-over panel says "${msg}"`);
  await t.press('Enter');
  await t.step(0.2);
  s = await t.state();
  a = await arrival(t);
  const up = (await t.events('room-enter')).at(-1);
  t.expect(
    s.mode === 'play' && s.screenName === 'Sunken Gate' && near(s.lx, 8) && near(s.lz, 10.4) && s.hp === s.maxHp && up.via === 'respawn',
    `Try again: up at the crypt's entrance in the Sunken Gate (${s.lx}, ${s.lz}) with full health, 'room-enter' via respawn`
  );
  t.expect(
    s.cam.preset === 'dungeon' && near(s.cam.x, 8) && near(s.cam.z, 6) && a.inFrame && a.drawn.join() === 'crypt:0,1' && (await t.events('area-enter')).length === areasBefore,
    `  the dungeon camera on the room centre, only the Sunken Gate drawn (${a.drawn.join(', ')}), no 'area-enter'`
  );
  await t.step(1.1); // past the hero's blink after getting up
  await t.shot('10-up-again-at-the-entrance');

  const route = (await t.events('room-enter')).map((e) => e.screen);
  t.note(`rooms entered: ${route.join(' > ')}`);
}
